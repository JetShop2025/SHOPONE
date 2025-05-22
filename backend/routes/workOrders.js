const express = require('express');
const db = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.use(express.json());

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
    const [results] = await db.query('SELECT * FROM work_orders');
    const parsedResults = results.map(order => {
      let parts = [];
      try {
        parts = JSON.parse(order.parts || '[]');
      } catch (e) {
        parts = [];
      }
      return {
        ...order,
        parts
      };
    });
    res.json(parsedResults);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR FETCHING WORK ORDERS');
  }
});

// Agregar nueva orden de trabajo y generar PDF
router.post('/', async (req, res) => {
  const { billToCo, trailer, mechanic, date, description, parts, totalHrs, totalLabAndParts, status, usuario } = req.body;

  if (!date) {
    return res.status(400).send('The date field is required');
  }

  const query = `
    INSERT INTO work_orders (billToCo, trailer, mechanic, date, description, parts, totalHrs, totalLabAndParts, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    billToCo, trailer, mechanic, date, description,
    JSON.stringify(parts),
    totalHrs, totalLabAndParts, status
  ];

  try {
    const [result] = await db.query(query, values);

    // Calcula partes y labor
    const partsArr = Array.isArray(parts) ? parts : [];
    const partsTotal = partsArr.reduce((sum, p) => {
      const val = Number((p.cost || '').toString().replace(/[^0-9.]/g, ''));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    const laborTotal = Number(totalHrs) * 60 || 0;
    const subtotal = partsTotal + laborTotal;

    // Calcula extras
    let extra = 0;
    let extraLabels = [];
    let extraArr = [];
    const extras = Array.isArray(req.body.extraOptions) ? req.body.extraOptions : [];
    extras.forEach(opt => {
      if (opt === '5') {
        extra += subtotal * 0.05;
        extraLabels.push('5% Extra');
        extraArr.push(subtotal * 0.05);
      } else if (opt === '15shop') {
        extra += subtotal * 0.15;
        extraLabels.push('15% Shop Miscellaneous');
        extraArr.push(subtotal * 0.15);
      } else if (opt === '15weld') {
        extra += subtotal * 0.15;
        extraLabels.push('15% Welding Supplies');
        extraArr.push(subtotal * 0.15);
      }
    });

    // Formatea la fecha a MM-DD-YYYY
    const jsDate = new Date(date);
    const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jsDate.getDate()).padStart(2, '0');
    const yyyy = jsDate.getFullYear();
    const formattedDate = `${mm}-${dd}-${yyyy}`;

    // Genera el nombre del PDF como MM-DD-YYYY_ID.pdf
    const pdfName = `${formattedDate}_${result.insertId || Date.now()}.pdf`;
    const pdfPath = path.join(__dirname, '..', 'pdfs', pdfName);

    // Asegúrate de que la carpeta 'pdfs' exista
    if (!fs.existsSync(path.join(__dirname, '..', 'pdfs'))) {
      fs.mkdirSync(path.join(__dirname, '..', 'pdfs'));
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(pdfPath);

    stream.on('error', (err) => {
      console.error('Error al escribir el PDF:', err);
      res.status(500).send('Error al generar el PDF');
    });

    doc.pipe(stream);

    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      console.log('Logo encontrado:', logoPath);
      doc.image(logoPath, 40, 30, { width: 120 });
    } else {
      console.log('Logo NO encontrado:', logoPath);
    }

    doc.fontSize(22).fillColor('#1976d2').text('INVOICE', 0, 40, { align: 'right' });
    doc.moveDown(2);

    // --- DATOS DE LA ORDEN ---
    doc.fontSize(10).fillColor('#333');
    doc.text(`Order ID: ${result.insertId}`, { align: 'right' });
    doc.text(`Date: ${formattedDate}`, { align: 'right' });
    doc.text(`Bill To: ${billToCo}`, { align: 'right' });
    doc.text(`Trailer: ${trailer}`, { align: 'right' });
    doc.moveDown(2);

    // --- TABLA DE PARTES ---
    doc.fontSize(12).fillColor('#1976d2').text('PARTS', { underline: true });
    doc.moveDown(0.5);

    // Encabezados de tabla
    const tableTop = doc.y;
    const col = [40, 70, 170, 350, 410, 470]; // X positions for columns

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('No.', col[0], tableTop);
    doc.text('SKU', col[1], tableTop);
    doc.text('Descripción', col[2], tableTop);
    doc.text('Qty', col[3], tableTop, { width: 40, align: 'right' });
    doc.text('Unit', col[4], tableTop, { width: 50, align: 'right' });
    doc.text('Total', col[5], tableTop, { width: 60, align: 'right' });

    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);

    // ... después de doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);

    // Dibuja fondo y líneas de encabezado
    doc.rect(col[0] - 2, tableTop - 2, col[5] + 60 - col[0] + 4, 20).fillAndStroke('#e3f2fd', '#1976d2');
    doc.fillColor('#1976d2').font('Helvetica-Bold').fontSize(10);
    doc.text('No.', col[0], tableTop);
    doc.text('SKU', col[1], tableTop);
    doc.text('Descripción', col[2], tableTop);
    doc.text('Qty', col[3], tableTop, { width: 40, align: 'right' });
    doc.text('Unit', col[4], tableTop, { width: 50, align: 'right' });
    doc.text('Total', col[5], tableTop, { width: 60, align: 'right' });
    doc.fillColor('#333').font('Helvetica').fontSize(10);

    let y = tableTop + 20;
    (parts || []).forEach((p, i) => {
      doc.text(i + 1, col[0], y);
      doc.text(p.sku || '', col[1], y);
      doc.text(p.part || '', col[2], y, { width: 170 });
      doc.text(p.qty || '', col[3], y, { width: 40, align: 'right' });
      doc.text(
        Number(p.unitPrice || p.precio || p.price || p.costTax || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        col[4], y, { width: 50, align: 'right' }
      );
      const totalPart = Number(p.qty || 0) * Number(p.unitPrice || p.precio || p.price || p.costTax || 0);
      doc.text(
        totalPart.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        col[5], y, { width: 60, align: 'right' }
      );
      // Línea separadora
      doc.moveTo(col[0], y + 14).lineTo(col[5] + 60, y + 14).strokeColor('#e0e0e0').stroke();
      y += 18;
    });

    doc.moveDown(2);

    // --- TOTALES ---
    const fmt = v => Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const rightCol = 410;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1976d2');
    doc.text('Subtotal Parts:', rightCol, y + 10, { width: 120, align: 'right' });
    doc.font('Helvetica').fillColor('#333').text(fmt(partsTotal), rightCol + 120, y + 10, { width: 80, align: 'right' });

    doc.font('Helvetica-Bold').fillColor('#1976d2').text('Labor (HRS x $60):', rightCol, y + 28, { width: 120, align: 'right' });
    doc.font('Helvetica').fillColor('#333').text(fmt(laborTotal), rightCol + 120, y + 28, { width: 80, align: 'right' });

    let yTot = y + 46;
    (extraLabels || []).forEach((label, idx) => {
      doc.font('Helvetica-Bold').fillColor('#1976d2').text(`${label}:`, rightCol, yTot, { width: 120, align: 'right' });
      doc.font('Helvetica').fillColor('#333').text(fmt(extraArr[idx]), rightCol + 120, yTot, { width: 80, align: 'right' });
      yTot += 18;
    });

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1976d2');
    doc.text('TOTAL LAB & PARTS:', rightCol, yTot + 10, { width: 120, align: 'right' });
    doc.text(fmt(partsTotal + laborTotal + extra), rightCol + 120, yTot + 10, { width: 80, align: 'right' });

    doc.end();
    // --- FIN DEL BLOQUE COMPLETO DE GENERACIÓN DEL PDF ---

    stream.on('finish', async () => {
      await logAccion(usuario, 'CREATE', 'work_orders', result.insertId, JSON.stringify(req.body));
      res.status(201).json({
        message: 'WORK ORDER CREATED SUCCESSFULLY',
        id: result.insertId,
        pdfUrl: `/pdfs/${pdfName}`
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR CREATING WORK ORDER');
  }
});

// backend/routes/workOrders.js
router.post('/', async (req, res) => {
  // ... tus campos ...
  const [result] = await db.query(
    'INSERT INTO work_orders (...) VALUES (?, ?, ...)',
    [/* tus valores */]
  );
  res.status(200).json({ id: result.insertId }); // <-- esto es clave
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

// Actualizar orden de trabajo
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const { usuario } = req.body;

  try {
    const [oldResults] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    const oldData = oldResults[0];

    await db.query(
      `UPDATE work_orders SET 
        billToCo = ?, trailer = ?, mechanic = ?, date = ?, description = ?, parts = ?, totalHrs = ?, totalLabAndParts = ?, status = ?
       WHERE id = ?`,
      [
        fields.billToCo, fields.trailer, fields.mechanic, fields.date, fields.description,
        JSON.stringify(fields.parts), fields.totalHrs, fields.totalLabAndParts, fields.status, id
      ]
    );
    const { usuario, ...rest } = fields;
    await logAccion(
      usuario,
      'UPDATE',
      'work_orders',
      id,
      JSON.stringify({ before: oldData, after: rest })
    );
    res.status(200).send('WORK ORDER UPDATED SUCCESSFULLY');
  } catch (err) {
    res.status(500).send('ERROR UPDATING WORK ORDER');
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

// Servir los PDFs generados
router.use('/pdfs', express.static(path.join(__dirname, '..', 'pdfs')));

module.exports = router;