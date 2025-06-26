const express = require('express');
const db = require('../db');
const path = require('path');
const router = express.Router();

router.use(express.json());

// Función auxiliar para formatear fecha de manera consistente
function formatDateForPdf(date) {
  if (!date) return new Date().toLocaleDateString('en-US').replace(/\//g, '-');
  
  const dateObj = new Date(date);
  // Asegurar que obtenemos la fecha local, no UTC
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

async function logAccion(usuario, accion, tabla, registro_id, detalles = '') {
  try {
    await db.query(
      'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles) VALUES (?, ?, ?, ?, ?)',
      [usuario, accion, tabla, registro_id, detalles]
    );
  } catch (err) {
    console.error('Error al insertar en audit_log:', err);
  }
}

// Obtener todas las órdenes de trabajo
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM work_orders ORDER BY id DESC LIMIT 100');
    const parsedResults = results.map(order => {
      let parts = [];
      try {
        parts = JSON.parse(order.parts || '[]');
      } catch (e) {
        parts = [];
      }
      let mechanics = [];
      try {
        mechanics = JSON.parse(order.mechanics || '[]');
      } catch (e) {
        mechanics = [];
      }
      let extraOptions = [];
      try {
        extraOptions = JSON.parse(order.extraOptions || '[]');
      } catch { extraOptions = []; }
      return {
        ...order,
        parts,
        mechanics,
        extraOptions
      };
    });
    res.json(parsedResults);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR FETCHING WORK ORDERS');
  }
});

// CREAR ORDEN DE TRABAJO - SIMPLIFICADO EMERGENCIA
router.post('/', async (req, res) => {
  try {
    const fields = req.body;
    const parts = fields.parts || [];
    const extraOptions = fields.extraOptions || [];
    const billToCo = fields.billToCo || '';
    const trailer = fields.trailer || '';
    const mechanic = fields.mechanic || '';
    const mechanicsArr = Array.isArray(fields.mechanics) ? fields.mechanics : [];
    const date = fields.date || new Date();
    const description = fields.description || '';
    const status = fields.status || 'PENDING';
    const idClassic = fields.idClassic || null;

    // Limpia y valida partes
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => ({
            ...part,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, '')),
            qty: Number(part.qty) || 0
          }))
      : [];

    // Calcula totales
    let totalHrsPut = 0;
    if (Array.isArray(fields.mechanics) && fields.mechanics.length > 0) {
      totalHrsPut = fields.mechanics.reduce((sum, m) => sum + (parseFloat(m.hrs) || 0), 0);
    }
    if (!totalHrsPut && fields.totalHrs) {
      totalHrsPut = parseFloat(fields.totalHrs) || 0;
    }
    const laborTotal = totalHrsPut * 60;
    const partsTotal = partsArr.reduce((sum, part) => sum + (Number(part.cost) || 0), 0);
    const subtotal = partsTotal + laborTotal;

    let extra = 0;
    const extras = Array.isArray(extraOptions) ? extraOptions : [];
    
    // SIEMPRE aplicar 5% automático
    extra += subtotal * 0.05;
    
    extras.forEach(opt => {
      if (opt === '15shop') {
        extra += subtotal * 0.15;
      }
      if (opt === '15weld') {
        extra += subtotal * 0.15;
      }
    });

    // Calcula el total final
    let totalLabAndPartsFinal;
    if (
      fields.totalLabAndParts !== undefined &&
      fields.totalLabAndParts !== null &&
      fields.totalLabAndParts !== '' &&
      !isNaN(Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      // Respeta el valor manual del usuario
      totalLabAndPartsFinal = Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      // Usa el cálculo automático
      totalLabAndPartsFinal = subtotal + extra;
    }

    // INSERTAR EN DB SIMPLE
    const query = `
      INSERT INTO work_orders (billToCo, trailer, mechanic, mechanics, date, description, parts, totalHrs, totalLabAndParts, status, idClassic, extraOptions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrsPut, totalLabAndPartsFinal, status, idClassic,
      JSON.stringify(extraOptions || [])
    ];
    const [result] = await db.query(query, values);
    const id = result.insertId;    // RESPONDER INMEDIATAMENTE SIN PROCESOS PESADOS
    const formattedDate = formatDateForPdf(date);
    
    // Generar PDF automáticamente en segundo plano
    try {
      const PDFDocument = require('pdfkit');
      const fs = require('fs');
      
      // Crear PDF
      const pdfName = `${formattedDate}_${fields.idClassic || id}.pdf`;
      const pdfPath = path.join(__dirname, '../pdfs', pdfName);
      
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);
      
      // Contenido del PDF
      doc.fontSize(20).text('WORK ORDER - JET SHOP', 50, 50);
      doc.fontSize(12);
      doc.text(`Order ID: ${fields.idClassic || id}`, 50, 100);
      doc.text(`Bill To: ${billToCo || '-'}`, 50, 120);
      doc.text(`Trailer: ${trailer || '-'}`, 50, 140);
      doc.text(`Date: ${formattedDate}`, 50, 160);
      doc.text(`Mechanic: ${mechanic || '-'}`, 50, 180);
      doc.text(`Description: ${description || ''}`, 50, 200, { width: 400 });
      
      // Mecánicos
      let yPos = 240;
      if (mechanicsArr.length > 0) {
        doc.text('MECHANICS:', 50, yPos);
        yPos += 20;
        mechanicsArr.forEach(mech => {
          if (mech.name && mech.hrs) {
            doc.text(`- ${mech.name}: ${mech.hrs} hrs`, 60, yPos);
            yPos += 15;
          }
        });
        yPos += 10;
      }
      
      // Partes usadas
      if (partsArr.length > 0) {
        doc.text('PARTS USED:', 50, yPos);
        yPos += 20;
        partsArr.forEach(part => {
          if (part.sku && part.qty) {
            doc.text(`- ${part.sku}: ${part.part || ''} (Qty: ${part.qty}, Cost: $${part.cost || '0.00'})`, 60, yPos);
            yPos += 15;
          }
        });
      }
      
      // Total
      yPos += 20;
      doc.fontSize(14).text(`TOTAL: $${totalLabAndPartsFinal.toFixed(2)}`, 50, yPos);
      doc.fontSize(12).text(`Status: ${status || 'PENDING'}`, 50, yPos + 30);
      
      doc.end();
      
      stream.on('finish', () => {
        console.log(`PDF creado automáticamente: ${pdfName}`);
      });
    } catch (pdfError) {
      console.error('Error generando PDF automáticamente:', pdfError);
      // No fallar la operación si el PDF no se puede generar
    }
    
    res.status(201).json({
      id: id,
      message: 'Work Order created successfully',
      pdfUrl: `/pdfs/${formattedDate}_${fields.idClassic || id}.pdf`
    });

  } catch (err) {
    console.error('Error creando WO:', err);
    res.status(500).json({ error: 'Error al crear la orden de trabajo' });
  }
});

// Eliminar orden de trabajo por ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!results || results.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    const oldData = results[0];
    await db.query('DELETE FROM work_orders WHERE id = ?', [id]);
    await logAccion(
      usuario,
      'DELETE',
      'work_orders',
      id,
      JSON.stringify({
        id: oldData.id,
        customer: oldData.billToCo,
        trailer: oldData.trailer,
        date: oldData.date,
        description: oldData.description,
        parts: oldData.parts,
        mechanic: oldData.mechanic,
        status: oldData.status
      })
    );
    res.status(200).send('WORK ORDER DELETED SUCCESSFULLY');
  } catch (err) {
    res.status(500).send('ERROR DELETING WORK ORDER');
  }
});

// EDITAR ORDEN DE TRABAJO - SIMPLIFICADO
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const {
    billToCo,
    trailer,
    mechanic,
    date,
    description,
    parts,
    totalHrs,
    status,
    extraOptions,
    usuario,
    idClassic
  } = fields;

  try {
    // 1. Verifica que la orden exista
    const [oldResults] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }

    // 2. Limpia y valida partes
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => ({
            ...part,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, '')),
            qty: Number(part.qty) || 0
          }))
      : [];

    // 3. Calcula totales
    let totalHrsPut = 0;
    if (Array.isArray(fields.mechanics) && fields.mechanics.length > 0) {
      totalHrsPut = fields.mechanics.reduce((sum, m) => sum + (parseFloat(m.hrs) || 0), 0);
    } 
    if (!totalHrsPut && fields.totalHrs) {
      totalHrsPut = parseFloat(fields.totalHrs) || 0;
    }
    const laborTotal = totalHrsPut * 60;
    const partsTotal = partsArr.reduce((sum, part) => {
      const cost = Number(part.cost) || 0;
      return sum + cost;
    }, 0);
    const subtotal = partsTotal + laborTotal;

    let extra = 0;
    const extras = Array.isArray(extraOptions) ? extraOptions : [];
    
    // SIEMPRE aplicar 5% automático
    extra += subtotal * 0.05;
    
    extras.forEach(opt => {
      if (opt === '15shop') {
        extra += subtotal * 0.15;
      } 
      if (opt === '15weld') {
        extra += subtotal * 0.15;
      }
    });
    
    // Calcula el total final
    let totalLabAndPartsFinal;
    if (
      fields.totalLabAndParts !== undefined &&
      fields.totalLabAndParts !== null &&
      fields.totalLabAndParts !== '' &&
      !isNaN(Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      // Respeta el valor manual del usuario
      totalLabAndPartsFinal = Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      // Usa el cálculo automático
      totalLabAndPartsFinal = subtotal + extra;
    }

    // 4. Actualiza la orden en la base de datos
    const mechanicsArr = Array.isArray(fields.mechanics) ? fields.mechanics : [];
    let updateQuery = `
      UPDATE work_orders SET 
        billToCo = ?, trailer = ?, mechanic = ?, mechanics = ?, date = ?, description = ?, parts = ?, totalHrs = ?, totalLabAndParts = ?, status = ?, extraOptions = ?
    `;
    const updateFields = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrsPut, totalLabAndPartsFinal, status,
      JSON.stringify(extraOptions || [])
    ];
    if (status === 'FINISHED') {
      updateQuery += `, idClassic = ?`;
      updateFields.push(fields.idClassic || null);
    }
    updateQuery += ` WHERE id = ?`;
    updateFields.push(id);    await db.query(updateQuery, updateFields);

    // 5. Generar PDF automáticamente después de actualizar
    try {
      const PDFDocument = require('pdfkit');
      const fs = require('fs');
      
      // Formatear fecha para el PDF usando la función auxiliar
      const formattedDate = formatDateForPdf(date);
      
      // Crear PDF
      const pdfName = `${formattedDate}_${fields.idClassic || id}.pdf`;
      const pdfPath = path.join(__dirname, '../pdfs', pdfName);
      
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);
      
      // Contenido del PDF (mejorado)
      doc.fontSize(20).text('WORK ORDER - JET SHOP', 50, 50);
      doc.fontSize(12);
      doc.text(`Order ID: ${fields.idClassic || id}`, 50, 100);
      doc.text(`Bill To: ${billToCo || '-'}`, 50, 120);
      doc.text(`Trailer: ${trailer || '-'}`, 50, 140);
      doc.text(`Date: ${formattedDate}`, 50, 160);
      doc.text(`Mechanic: ${mechanic || '-'}`, 50, 180);
      doc.text(`Description: ${description || ''}`, 50, 200, { width: 400 });
      
      // Mecánicos
      let yPos = 240;
      if (mechanicsArr.length > 0) {
        doc.text('MECHANICS:', 50, yPos);
        yPos += 20;
        mechanicsArr.forEach(mech => {
          if (mech.name && mech.hrs) {
            doc.text(`- ${mech.name}: ${mech.hrs} hrs`, 60, yPos);
            yPos += 15;
          }
        });
        yPos += 10;
      }
      
      // Partes usadas
      if (partsArr.length > 0) {
        doc.text('PARTS USED:', 50, yPos);
        yPos += 20;
        partsArr.forEach(part => {
          if (part.sku && part.qty) {
            doc.text(`- ${part.sku}: ${part.part || ''} (Qty: ${part.qty}, Cost: $${part.cost || '0.00'})`, 60, yPos);
            yPos += 15;
          }
        });
      }
      
      // Total
      yPos += 20;
      doc.fontSize(14).text(`TOTAL: $${totalLabAndPartsFinal.toFixed(2)}`, 50, yPos);
      doc.fontSize(12).text(`Status: ${status || 'PENDING'}`, 50, yPos + 30);
      
      doc.end();
      
      stream.on('finish', () => {
        console.log(`PDF actualizado automáticamente: ${pdfName}`);
      });
    } catch (pdfError) {
      console.error('Error generando PDF automáticamente:', pdfError);
      // No fallar la operación si el PDF no se puede generar
    }

    res.json({ success: true, id });

  } catch (err) {
    console.error('ERROR UPDATING WORK ORDER:', err);
    res.status(500).send(err?.message || 'ERROR UPDATING WORK ORDER');
  }
});

// Eliminar varias órdenes de trabajo por IDs
router.delete('/', async (req, res) => {
  const { ids, usuario } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).send('YOU MUST PROVIDE AN ARRAY OF IDs TO DELETE');
  }
  const placeholders = ids.map(() => '?').join(',');
  try {
    const [results] = await db.query(
      `SELECT * FROM work_orders WHERE id IN (${placeholders})`,
      ids
    );
    await db.query(
      `DELETE FROM work_orders WHERE id IN (${placeholders})`,
      ids
    );
    for (const id of ids) {
      const oldData = results.find(r => r.id == id);
      await logAccion(
        usuario,
        'DELETE',
        'work_orders',
        id,
        oldData
          ? JSON.stringify({
              id: oldData.id,
              customer: oldData.billToCo,
              trailer: oldData.trailer,
              date: oldData.date,
              description: oldData.description,
              parts: oldData.parts,
              mechanic: oldData.mechanic,
              status: oldData.status
            })
          : 'NO DATA FOUND'
      );
    }
    res.status(200).send(`DELETED ORDERS: ${ids.length}`);
  } catch (err) {
    res.status(500).send('ERROR DELETING WORK ORDERS');
  }
});

// Obtener logs de auditoría
router.get('/audit-log', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM audit_log ORDER BY fecha DESC');
    res.json(results);
  } catch (err) {
    res.status(500).send('Error fetching audit log');
  }
});

// Obtener PDF por ID de orden
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const [results] = await db.query('SELECT date, idClassic FROM work_orders WHERE id = ?', [id]);
    
    if (!results || results.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    
    const order = results[0];
    const fs = require('fs');
    const pdfsDir = path.join(__dirname, '../pdfs');
    
    // Buscar el archivo PDF que contenga el ID de la orden
    const pdfFiles = fs.readdirSync(pdfsDir);
    const matchingPdf = pdfFiles.find(file => 
      file.endsWith(`_${order.idClassic || id}.pdf`)
    );
    
    if (!matchingPdf) {
      console.log(`PDF no encontrado para orden ${id}. Archivos disponibles:`, pdfFiles);
      return res.status(404).send('PDF NOT FOUND - No matching file found');
    }
    
    const pdfPath = path.join(pdfsDir, matchingPdf);
    const fileName = `workorder_${order.idClassic || id}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    // Enviar el archivo
    res.sendFile(pdfPath);
    
  } catch (error) {
    console.error('Error obteniendo PDF:', error);
    res.status(500).send('ERROR GETTING PDF');
  }
});

// Regenerar PDF para una orden existente
router.post('/:id/generate-pdf', async (req, res) => {
  const { id } = req.params;
  try {
    // Obtener datos de la orden
    const [results] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!results || results.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    
    const order = results[0];
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
      // Formatear fecha para el PDF
    const formattedDate = formatDateForPdf(order.date);
    
    // Crear PDF
    const pdfName = `${formattedDate}_${order.idClassic || id}.pdf`;
    const pdfPath = path.join(__dirname, '../pdfs', pdfName);
    
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    
    // Contenido del PDF (mejorado)
    doc.fontSize(20).text('WORK ORDER - JET SHOP', 50, 50);
    doc.fontSize(12);
    doc.text(`Order ID: ${order.idClassic || id}`, 50, 100);
    doc.text(`Bill To: ${order.billToCo || '-'}`, 50, 120);
    doc.text(`Trailer: ${order.trailer || '-'}`, 50, 140);
    doc.text(`Date: ${formattedDate}`, 50, 160);
    doc.text(`Mechanic: ${order.mechanic || '-'}`, 50, 180);
    doc.text(`Description: ${order.description || ''}`, 50, 200, { width: 400 });
    
    // Partes usadas
    let yPos = 240;
    try {
      const parts = JSON.parse(order.parts || '[]');
      if (parts.length > 0) {
        doc.text('PARTS USED:', 50, yPos);
        yPos += 20;
        parts.forEach(part => {
          if (part.sku && part.qty) {
            doc.text(`- ${part.sku}: ${part.part || ''} (Qty: ${part.qty}, Cost: $${part.cost || '0.00'})`, 60, yPos);
            yPos += 15;
          }
        });
      }
    } catch (e) {
      console.error('Error parsing parts:', e);
    }
    
    // Total
    yPos += 20;
    doc.fontSize(14).text(`TOTAL: $${parseFloat(order.totalLabAndParts || 0).toFixed(2)}`, 50, yPos);
    doc.fontSize(12).text(`Status: ${order.status || 'PENDING'}`, 50, yPos + 30);
    
    doc.end();
    
    // Esperar a que termine de escribir
    stream.on('finish', () => {
      console.log(`PDF regenerado: ${pdfName}`);
      res.json({ 
        message: 'PDF regenerated successfully',
        pdfUrl: `/pdfs/${pdfName}`
      });
    });
    
  } catch (err) {
    console.error('Error regenerating PDF:', err);
    res.status(500).json({ error: 'Error regenerating PDF' });
  }
});

module.exports = router;
