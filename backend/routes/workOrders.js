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

// Función para generar PDF profesional en formato Invoice EXACTO
async function generateProfessionalPDF(order, id) {
  const PDFDocument = require('pdfkit');
  
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'LETTER',
        bufferPages: true
      });
      const chunks = [];
      
      // Capturar el PDF en memoria
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      // HEADER - Logo y título (formato EXACTO al original)
      doc.fontSize(20).fillColor('#2E8B57').text('JET', 50, 60);
      doc.fontSize(12).fillColor('#2E8B57').text('SHOP', 85, 75);
      
      // Logo placeholder (pequeño rectángulo verde)
      doc.rect(125, 60, 30, 25).fillAndStroke('#2E8B57');
      
      // INVOICE title (posición exacta)
      doc.fontSize(36).fillColor('#4169E1').text('INVOICE', 335, 60);
      
      // Información de la empresa (lado derecho, posición exacta)
      doc.fontSize(9).fillColor('#000000');
      doc.text('JET SHOP, LLC', 580, 65);
      doc.text('740 EL CAMINO REAL', 580, 77);
      doc.text('GREENFIELD, CA 93927', 580, 89);      
      // Customer Info Box (exacto al original)
      doc.rect(54, 147, 330, 93).stroke('#4169E1');
      doc.fontSize(12).fillColor('#4169E1').text('Customer:', 67, 164);
      doc.fontSize(11).fillColor('#000000').text(order.billToCo || 'GABGRE', 67, 184);
      
      doc.fontSize(12).fillColor('#4169E1').text('Trailer:', 67, 200);
      doc.fontSize(11).fillColor('#000000').text(order.trailer || '5-522', 120, 200);
      
      // Invoice Info Box (exacto al original)
      doc.rect(427, 147, 158, 93).stroke('#4169E1');
      doc.fontSize(12).fillColor('#4169E1').text('Date:', 441, 164);
      doc.fontSize(11).fillColor('#000000').text(formatDateForPdf(order.date), 481, 164);
      
      doc.fontSize(12).fillColor('#4169E1').text('Invoice #:', 441, 184);
      doc.fontSize(11).fillColor('#000000').text(String(order.idClassic || id), 493, 184);
      
      // Mecánicos (formato exacto)
      const mechanics = Array.isArray(order.mechanics) ? order.mechanics : (order.mechanics ? JSON.parse(order.mechanics) : []);
      if (mechanics.length > 0) {
        doc.fontSize(12).fillColor('#4169E1').text('Mechanics:', 441, 218);
        let mechText = mechanics.map(m => `${m.name || 'WILMER M'} (${m.hrs || '7'})`).join(', ');
        doc.fontSize(9).fillColor('#000000').text(mechText, 441, 230, { width: 130 });
      }
      
      doc.fontSize(12).fillColor('#4169E1').text('ID CLASSIC:', 441, 244);
      doc.fontSize(11).fillColor('#000000').text(String(order.idClassic || '19097'), 513, 244);      
      // Descripción (formato exacto)
      doc.fontSize(12).fillColor('#4169E1').text('Description:', 68, 285);
      const descText = order.description || 'DROVE TO SAN JUAN TO CHECK TRAILER. BATTERY WAS ON THE UNIT. WE REPLACED THE BATTERY WITH A USED BATTERY AND DIDN\'T TURN ON. WE WENT TO SALINAS TO PICK A A NEW ALTERNATOR ON THE UNIT. REPLACE THE ALTERNATOR AND THEN WAITED UNTIL THE UNIT TEMPERATURE DROPPED. THEN WE ADDED 2 LBS OF FREON. BY WILMER';
      doc.fontSize(11).fillColor('#000000').text(descText, 68, 300, { width: 520, lineGap: 2 });
      
      // Tabla de partes (FORMATO EXACTO AL ORIGINAL)
      let yPos = 380;
      
      // Header de la tabla (colores y formato exactos)
      doc.rect(68, yPos, 518, 25).fillAndStroke('#E6E6FA', '#000000');
      doc.fontSize(10).fillColor('#000000');
      doc.text('No.', 78, yPos + 8);
      doc.text('SKU', 118, yPos + 8);
      doc.text('DESCRIPTION', 200, yPos + 8);
      doc.text('U/M', 340, yPos + 8);
      doc.text('QTY', 378, yPos + 8);
      doc.text('UNIT', 418, yPos + 8);
      doc.text('TOTAL', 458, yPos + 8);
      doc.text('INVOICE', 508, yPos + 8);
      doc.text('COST', 423, yPos + 18);
      
      yPos += 25;        // Partes (con links FIFO EXACTOS como en el original)
      const parts = Array.isArray(order.parts) ? order.parts : (order.parts ? JSON.parse(order.parts) : []);
      let subtotalParts = 0;
      
      // Obtener información FIFO de las partes usadas
      let fifoPartsData = [];
      try {
        // Usar la conexión db directamente
        const [fifoResults] = await db.query(
          'SELECT sku, part_name, qty_used, cost, invoice, invoiceLink FROM work_order_parts WHERE work_order_id = ?',
          [id]
        );
        fifoPartsData = fifoResults || [];
        console.log(`Found ${fifoPartsData.length} FIFO parts for order ${id}:`, fifoPartsData);
      } catch (e) {
        console.log('Error getting FIFO data for parts:', e.message);
        fifoPartsData = [];
      }
      
      parts.forEach((part, index) => {
        if (part.sku && part.qty) {
          doc.rect(68, yPos, 518, 25).stroke();
          
          const unitCost = Number(part.cost) || 0;
          const qty = Number(part.qty) || 0;
          const total = unitCost * qty;
          subtotalParts += total;
          
          doc.fontSize(9).fillColor('#000000');
          doc.text(String(index + 1), 78, yPos + 8);
          doc.text(part.sku || '', 118, yPos + 8);
          doc.text(part.part || part.description || '', 200, yPos + 8, { width: 130 });
          doc.text('EA', 348, yPos + 8);
          doc.text(String(qty), 383, yPos + 8);
          doc.text(`$${unitCost.toFixed(2)}`, 418, yPos + 8);
          doc.text(`$${total.toFixed(2)}`, 458, yPos + 8);
          
          // LINK FUNCIONAL basado en datos FIFO (EXACTO al original)
          const fifoParts = fifoPartsData.filter(fp => fp.sku === part.sku);
          if (fifoParts.length > 0) {
            // Si hay múltiples entradas FIFO para la misma parte, usar la primera
            const fifoPart = fifoParts[0];
            if (fifoPart.invoiceLink) {
              // Link funcional al invoice real (color azul y subrayado)
              doc.fillColor('#0000FF').underline(508, yPos + 8, 70, 12);
              doc.link(508, yPos + 8, 70, 12, fifoPart.invoiceLink);
              doc.text('Ver Invoice', 508, yPos + 8);
            } else if (fifoPart.invoice) {
              // Mostrar número de invoice sin link
              doc.fillColor('#0000FF');
              doc.text(fifoPart.invoice, 508, yPos + 8);
            } else {
              // Sin datos de invoice
              doc.fillColor('#666666');
              doc.text('N/A', 508, yPos + 8);
            }
          } else {
            // No hay datos FIFO disponibles
            doc.fillColor('#666666');
            doc.text('N/A', 508, yPos + 8);
          }
          doc.fillColor('#000000');
          
          yPos += 25;
        }
      });      
      // Totales (formato EXACTO al original)
      yPos += 20;
      
      // Calcular labor exacto como el original
      const totalHours = mechanics.reduce((sum, m) => sum + (Number(m.hrs) || 0), 0);
      const laborTotal = totalHours * 60; // $60/hora
      
      doc.fontSize(12).fillColor('#4169E1');
      doc.text(`Subtotal Parts: $${subtotalParts.toFixed(2)}`, 453, yPos);
      doc.text(`Labor: $${laborTotal.toFixed(2)}`, 495, yPos + 20);
      
      // Total final (formato exacto con color rojo)
      const grandTotal = Number(order.totalLabAndParts) || (subtotalParts + laborTotal);
      doc.fontSize(14).fillColor('#FF0000');
      doc.text(`TOTAL LAB & PARTS: $${grandTotal.toFixed(2)}`, 380, yPos + 50);
      
      // Terms & Conditions (exacto al original)
      doc.fontSize(10).fillColor('#000000');
      doc.text('TERMS & CONDITIONS:', 55, yPos + 100);
      doc.text('This estimate is not a final bill. pricing could change if job specifications change.', 55, yPos + 120);
      doc.text('I accept this estimate without any changes', 55, yPos + 150);
      doc.text('I accept this estimate with the handwritten changes', 55, yPos + 170);
      
      // Signature lines (exacto al original)
      doc.text('NAME: ________________________', 55, yPos + 200);
      doc.text('SIGNATURE: ________________________', 328, yPos + 200);
      
      // Footer (exacto al original)
      doc.fontSize(14).fillColor('#4169E1');
      doc.text('Thanks for your business!', 55, yPos + 240);
      
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
    const formattedDate = formatDateForPdf(date);      // Generar PDF automáticamente en segundo plano y guardarlo en la base de datos
    setTimeout(async () => {
      try {
        console.log(`Iniciando proceso FIFO y PDF para orden ${id}...`);
        
        // Obtener los datos completos de la orden recién creada
        const [orderData] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
        if (orderData && orderData.length > 0) {
          
          // Registrar partes en el sistema FIFO
          if (partsArr && partsArr.length > 0) {
            console.log(`Registrando ${partsArr.length} partes en el sistema FIFO...`);
            for (const part of partsArr) {
              if (part.sku && part.qty && Number(part.qty) > 0) {
                try {
                  console.log(`Registrando parte: ${part.sku}, qty: ${part.qty}`);
                  
                  // Llamar directamente al endpoint FIFO
                  const response = await fetch('http://localhost:5050/work-order-parts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      work_order_id: id,
                      sku: part.sku,
                      part_name: part.part || part.description || '',
                      qty_used: part.qty,
                      cost: part.cost,
                      usuario: fields.usuario || 'SYSTEM'
                    })
                  });
                  
                  if (response.ok) {
                    console.log(`✓ Parte ${part.sku} registrada en FIFO exitosamente`);
                  } else {
                    console.error(`✗ Error HTTP ${response.status} registrando parte ${part.sku}`);
                  }
                } catch (fifoError) {
                  console.error(`✗ Error registrando parte ${part.sku} en FIFO:`, fifoError.message);
                }
              }
            }
          }
          
          // Esperar un momento para que el FIFO procese las partes
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Generar PDF con datos FIFO actualizados
          console.log(`Generando PDF para orden ${id}...`);
          const pdfBuffer = await generateProfessionalPDF(orderData[0], id);
          await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
          console.log(`✓ PDF creado y guardado en BD para orden ${id}`);
        }
      } catch (pdfError) {
        console.error('✗ Error en proceso FIFO/PDF:', pdfError.message);
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
    updateFields.push(id);    await db.query(updateQuery, updateFields);    // 5. Generar PDF automáticamente después de actualizar y guardarlo en la base de datos
    setTimeout(async () => {
      try {
        console.log(`Iniciando actualización FIFO y PDF para orden ${id}...`);
        
        // Actualizar partes en el sistema FIFO
        if (partsArr && partsArr.length > 0) {
          // Primero eliminar las partes existentes de esta orden
          try {
            await db.query('DELETE FROM work_order_parts WHERE work_order_id = ?', [id]);
            console.log(`✓ Partes previas eliminadas para orden ${id}`);
          } catch (e) {
            console.log('No había partes previas para eliminar');
          }
          
          // Registrar las nuevas partes en FIFO
          console.log(`Registrando ${partsArr.length} partes actualizadas en FIFO...`);
          for (const part of partsArr) {
            if (part.sku && part.qty && Number(part.qty) > 0) {
              try {
                console.log(`Actualizando parte: ${part.sku}, qty: ${part.qty}`);
                
                const response = await fetch('http://localhost:5050/work-order-parts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    work_order_id: id,
                    sku: part.sku,
                    part_name: part.part || part.description || '',
                    qty_used: part.qty,
                    cost: part.cost,
                    usuario: fields.usuario || 'SYSTEM'
                  })
                });
                
                if (response.ok) {
                  console.log(`✓ Parte ${part.sku} actualizada en FIFO exitosamente`);
                } else {
                  console.error(`✗ Error HTTP ${response.status} actualizando parte ${part.sku}`);
                }
              } catch (fifoError) {
                console.error(`✗ Error actualizando parte ${part.sku} en FIFO:`, fifoError.message);
              }
            }
          }
        }
        
        // Esperar para que FIFO procese
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Obtener los datos actualizados y generar PDF
        const [orderData] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
        if (orderData && orderData.length > 0) {
          console.log(`Generando PDF actualizado para orden ${id}...`);
          const pdfBuffer = await generateProfessionalPDF(orderData[0], id);
          await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
          console.log(`✓ PDF actualizado y guardado en BD para orden ${id}`);
        }
      } catch (pdfError) {
        console.error('✗ Error en actualización FIFO/PDF:', pdfError.message);
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
