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

// Función para generar PDF profesional en formato Invoice
async function generateProfessionalPDF(order, id) {
  const PDFDocument = require('pdfkit');
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      
      // Capturar el PDF en memoria
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      // HEADER - Logo y título
      doc.fontSize(18).fillColor('#2E8B57').text('JET SHOP, LLC', 50, 50);
      doc.fontSize(30).fillColor('#4169E1').text('INVOICE', 320, 50);
      
      // Información de la empresa
      doc.fontSize(10).fillColor('#000000');
      doc.text('740 EL CAMINO REAL', 50, 80);
      doc.text('GREENFIELD, CA 93927', 50, 95);
      
      // Recuadros principales
      // Customer Info Box
      doc.rect(50, 140, 280, 100).stroke();
      doc.fontSize(12).fillColor('#4169E1').text('Customer:', 60, 150);
      doc.fontSize(11).fillColor('#000000').text(order.billToCo || 'N/A', 60, 170);
      doc.text('Trailer:', 60, 190);
      doc.text(order.trailer || 'N/A', 120, 190);
      
      // Invoice Info Box
      doc.rect(350, 140, 200, 100).stroke();
      doc.fontSize(12).fillColor('#4169E1').text('Date:', 360, 150);
      doc.fontSize(11).fillColor('#000000').text(formatDateForPdf(order.date), 420, 150);
      doc.fontSize(12).fillColor('#4169E1').text('Invoice #:', 360, 170);
      doc.fontSize(11).fillColor('#000000').text(String(order.idClassic || id), 430, 170);
      
      // Mecánicos
      const mechanics = Array.isArray(order.mechanics) ? order.mechanics : (order.mechanics ? JSON.parse(order.mechanics) : []);
      if (mechanics.length > 0) {
        doc.fontSize(12).fillColor('#4169E1').text('Mechanics:', 360, 190);
        let mechText = mechanics.map(m => `${m.name || 'N/A'} (${m.hrs || '0'})`).join(', ');
        doc.fontSize(11).fillColor('#000000').text(mechText, 430, 190, { width: 100 });
      }
      
      doc.fontSize(12).fillColor('#4169E1').text('ID CLASSIC:', 360, 210);
      doc.fontSize(11).fillColor('#000000').text(String(order.idClassic || id), 430, 210);
      
      // Descripción
      doc.fontSize(12).fillColor('#4169E1').text('Description:', 50, 260);
      doc.fontSize(11).fillColor('#000000').text(order.description || '', 50, 280, { width: 500 });
      
      // Tabla de partes
      let yPos = 330;
      
      // Header de la tabla
      doc.rect(50, yPos, 500, 25).fillAndStroke('#E6E6FA', '#000000');
      doc.fontSize(10).fillColor('#000000');
      doc.text('No.', 60, yPos + 8);
      doc.text('SKU', 100, yPos + 8);
      doc.text('DESCRIPTION', 180, yPos + 8);
      doc.text('U/M', 320, yPos + 8);
      doc.text('QTY', 360, yPos + 8);
      doc.text('UNIT COST', 400, yPos + 8);
      doc.text('TOTAL', 460, yPos + 8);
      doc.text('INVOICE', 510, yPos + 8);
      
      yPos += 25;
      
      // Partes
      const parts = Array.isArray(order.parts) ? order.parts : (order.parts ? JSON.parse(order.parts) : []);
      let subtotalParts = 0;
      
      parts.forEach((part, index) => {
        if (part.sku && part.qty) {
          doc.rect(50, yPos, 500, 20).stroke();
          
          const unitCost = Number(part.cost) || 0;
          const qty = Number(part.qty) || 0;
          const total = unitCost * qty;
          subtotalParts += total;
          
          doc.fontSize(9).fillColor('#000000');
          doc.text(String(index + 1), 60, yPos + 6);
          doc.text(part.sku || '', 100, yPos + 6);
          doc.text(part.part || part.description || '', 180, yPos + 6, { width: 130 });
          doc.text('EA', 320, yPos + 6);
          doc.text(String(qty), 360, yPos + 6);
          doc.text(`$${unitCost.toFixed(2)}`, 400, yPos + 6);
          doc.text(`$${total.toFixed(2)}`, 460, yPos + 6);
          doc.text('Ver Invoice', 510, yPos + 6);
          
          yPos += 20;
        }
      });
      
      // Totales
      yPos += 20;
      
      // Calcular labor
      const totalHours = mechanics.reduce((sum, m) => sum + (Number(m.hrs) || 0), 0);
      const laborTotal = totalHours * 60;
      
      doc.fontSize(12).fillColor('#4169E1');
      doc.text(`Subtotal Parts: $${subtotalParts.toFixed(2)}`, 350, yPos);
      doc.text(`Labor: $${laborTotal.toFixed(2)}`, 350, yPos + 20);
      
      // Total final
      const grandTotal = Number(order.totalLabAndParts) || (subtotalParts + laborTotal);
      doc.fontSize(14).fillColor('#FF0000');
      doc.text(`TOTAL LAB & PARTS: $${grandTotal.toFixed(2)}`, 320, yPos + 50);
      
      // Terms & Conditions
      doc.fontSize(10).fillColor('#000000');
      doc.text('TERMS & CONDITIONS:', 50, yPos + 100);
      doc.text('This estimate is not a final bill. pricing could change if job specifications change.', 50, yPos + 120);
      doc.text('I accept this estimate without any changes', 50, yPos + 150);
      doc.text('I accept this estimate with the handwritten changes', 50, yPos + 170);
      
      // Signature lines
      doc.text('NAME: ________________________', 50, yPos + 200);
      doc.text('SIGNATURE: ________________________', 300, yPos + 200);
      
      // Footer
      doc.fontSize(12).fillColor('#4169E1');
      doc.text('Thanks for your business!', 50, yPos + 240);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
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
    
    // Generar PDF automáticamente en segundo plano y guardarlo en la base de datos
    setTimeout(async () => {
      try {
        // Obtener los datos completos de la orden recién creada
        const [orderData] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
        if (orderData && orderData.length > 0) {
          const pdfBuffer = await generateProfessionalPDF(orderData[0], id);
          await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
          console.log(`PDF creado y guardado en BD para orden ${id}`);
        }
      } catch (pdfError) {
        console.error('Error generando PDF automáticamente:', pdfError);
      }
    }, 1000);
    
    res.status(201).json({
      id: id,
      message: 'Work Order created successfully',
      pdfUrl: `/work-orders/${id}/pdf`
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

    // 5. Generar PDF automáticamente después de actualizar y guardarlo en la base de datos
    setTimeout(async () => {
      try {
        // Obtener los datos actualizados
        const [orderData] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
        if (orderData && orderData.length > 0) {
          const pdfBuffer = await generateProfessionalPDF(orderData[0], id);
          await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
          console.log(`PDF actualizado y guardado en BD para orden ${id}`);
        }
      } catch (pdfError) {
        console.error('Error generando PDF automáticamente:', pdfError);
      }
    }, 1000);

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

// Obtener PDF por ID de orden (desde base de datos)
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const [results] = await db.query('SELECT pdf_file, idClassic FROM work_orders WHERE id = ?', [id]);
    
    if (!results || results.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    
    const order = results[0];
    
    // Si no hay PDF en la base de datos, generar uno nuevo
    if (!order.pdf_file) {
      console.log(`PDF no encontrado para orden ${id}, generando nuevo PDF...`);
      
      // Obtener datos completos de la orden para generar PDF
      const [fullOrder] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
      if (!fullOrder || fullOrder.length === 0) {
        return res.status(404).send('WORK ORDER DATA NOT FOUND');
      }
      
      try {
        // Generar PDF profesional
        const pdfBuffer = await generateProfessionalPDF(fullOrder[0], id);
        
        // Guardar PDF en la base de datos
        await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
        
        // Enviar el PDF generado
        const fileName = `workorder_${order.idClassic || id}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.send(pdfBuffer);
        
        console.log(`PDF generado y guardado para orden ${id}`);
        return;
        
      } catch (pdfError) {
        console.error('Error generando PDF:', pdfError);
        return res.status(500).send('ERROR GENERATING PDF');
      }
    }
    
    // Enviar PDF existente desde la base de datos
    const fileName = `workorder_${order.idClassic || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(order.pdf_file);
    
  } catch (error) {
    console.error('Error obteniendo PDF:', error);
    res.status(500).send('ERROR GETTING PDF');
  }
});

// Regenerar PDF para una orden existente
// Regenerar PDF para una orden existente (guardado en base de datos)
router.post('/:id/generate-pdf', async (req, res) => {
  const { id } = req.params;
  try {
    // Obtener datos de la orden
    const [results] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!results || results.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    
    const order = results[0];
    
    try {
      // Generar PDF profesional
      const pdfBuffer = await generateProfessionalPDF(order, id);
      
      // Guardar PDF en la base de datos
      await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
      
      console.log(`PDF regenerado y guardado en BD para orden ${id}`);
      res.json({ 
        message: 'PDF regenerated successfully and saved to database',
        pdfUrl: `/work-orders/${id}/pdf`
      });
      
    } catch (pdfError) {
      console.error('Error generando PDF:', pdfError);
      res.status(500).json({ error: 'Error generating PDF' });
    }
    
  } catch (err) {
    console.error('Error regenerating PDF:', err);
    res.status(500).json({ error: 'Error regenerating PDF' });
  }
});

module.exports = router;
