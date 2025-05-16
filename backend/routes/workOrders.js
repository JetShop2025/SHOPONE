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

    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(pdfPath);

    stream.on('error', (err) => {
      console.error('Error al escribir el PDF:', err);
      res.status(500).send('Error al generar el PDF');
    });

    doc.pipe(stream);

    // --- LOGO EN LA PARTE SUPERIOR DERECHA ---
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width - 150, 30, { width: 110 });
    }

    // --- TÍTULO ---
    doc.fontSize(22).font('Helvetica-Bold').text('WORK ORDER', 40, 40, { align: 'left' });
    doc.moveDown(1.5);

    // --- LÍNEA DE SEPARACIÓN ---
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#1976d2').lineWidth(2).stroke();
    doc.moveDown(1);

    // --- DATOS PRINCIPALES ---
    doc.fontSize(12).font('Helvetica');
    doc.text(`ID: ${result.insertId}`, 40, doc.y, { continued: true });
    doc.text(`   DATE: ${formattedDate}`, doc.x, doc.y);
    doc.text(`BILL TO CO: ${billToCo}`, 40, doc.y, { continued: true });
    doc.text(`   Trailer: ${trailer}`, doc.x, doc.y);
    doc.text(`MECHANIC: ${mechanic}`, 40, doc.y, { continued: true });
    doc.text(`   STATUS: ${status}`, doc.x, doc.y);
    doc.moveDown(1);

    // --- LÍNEA DE SEPARACIÓN ---
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#b0c4de').lineWidth(1).stroke();
    doc.moveDown(1);

    // --- DESCRIPCIÓN ---
    doc.font('Helvetica-Bold').text('DESCRIPTION:', 40, doc.y, { underline: true });
    doc.font('Helvetica').text(description || 'NO DESCRIPTION', { width: doc.page.width - 80, align: 'left' });
    doc.moveDown(1);

    // --- PARTES (TABLA) ---
    doc.font('Helvetica-Bold').text('Parts:', 40, doc.y, { underline: true }); // Antes: 'Partes:'
    doc.moveDown(0.5);

    const partsArray = Array.isArray(parts) ? parts : [];
    if (partsArray.length === 0) {
      doc.font('Helvetica').text('NO PARTS REGISTERED', 40, doc.y); // Antes: 'NO PARTS REGISTRERED'
    } else {
      // Encabezados de tabla
      const tableTop = doc.y + 5;
      const col1 = 40, col2 = 80, col3 = 320, col4 = 400, col5 = 480;
      doc.rect(col1, tableTop, doc.page.width - 80, 22).fill('#e3f2fd').stroke();
      doc.fillColor('#1976d2').font('Helvetica-Bold').fontSize(12);
      doc.text('No.', col2, tableTop + 6, { width: 30, align: 'center' });
      doc.text('Part', col3, tableTop + 6, { width: 80, align: 'center' }); // Antes: 'Parte'
      doc.text('Qty', col4, tableTop + 6, { width: 60, align: 'center' }); // Antes: 'Cantidad'
      doc.text('Cost', col5, tableTop + 6, { width: 60, align: 'center' }); // Antes: 'Costo'
      doc.fillColor('#333').font('Helvetica').fontSize(11);

      let y = tableTop + 22;
      partsArray.forEach((p, i) => {
        doc.rect(col1, y, doc.page.width - 80, 20).strokeColor('#e3eaf2').lineWidth(0.5).stroke();
        doc.text(`${i + 1}`, col2, y + 5, { width: 30, align: 'center' });
        doc.text(`${p.part || ''}`, col3, y + 5, { width: 80, align: 'center' });
        doc.text(`${p.qty || ''}`, col4, y + 5, { width: 60, align: 'center' });
        doc.text(`${p.cost || ''}`, col5, y + 5, { width: 60, align: 'center' });
        y += 20;
      });
      doc.y = y + 10;
    }

    doc.moveDown(1.5);

    // --- TOTALES ---
    doc.font('Helvetica-Bold').fontSize(12).text(`TOTAL HRS: `, 40, doc.y, { continued: true });
    doc.font('Helvetica').text(`${totalHrs || ''}`, doc.x, doc.y, { continued: true });
    doc.font('Helvetica-Bold').text(`   TOTAL LAB & PARTS: `, doc.x + 20, doc.y, { continued: true });
    doc.font('Helvetica').text(`${totalLabAndParts || ''}`, doc.x, doc.y);

    doc.end();
    // --- FIN DEL BLOQUE COMPLETO DE GENERACIÓN DEL PDF ---

    stream.on('finish', async () => {
      await logAccion(usuario, 'CREATE', 'work_orders', result.insertId, JSON.stringify(req.body));
      res.status(201).json({
        message: 'WORK ORDER CREATED SUCCESSFULLY',
        pdfUrl: `/pdfs/${pdfName}`
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR CREATING WORK ORDER');
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