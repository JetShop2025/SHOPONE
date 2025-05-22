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
    doc.pipe(stream);

    // LOGO
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 30, { width: 100 });
    }

    // TALLER Y DIRECCIÓN
    doc.fontSize(9).fillColor('#333').text('JET SHOP, LLC.', 400, 40, { align: 'right' });
    doc.text('740 EL CAMINO REAL', { align: 'right' });
    doc.text('GREENFIELD, CA 93927', { align: 'right' });

    // TÍTULO
    doc.fontSize(22).fillColor('#222').font('Helvetica-Bold').text('JET SHOP', 0, 90, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(14).fillColor('#222').font('Helvetica').text('INVOICE', { align: 'center' });
    doc.moveDown(0.5);

    // LÍNEA NEGRA
    doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(3).strokeColor('#222').stroke();
    doc.moveDown(1);

    // CAJAS DE INFORMACIÓN
    const yInfo = doc.y + 10;
    doc.fontSize(10).fillColor('#222').font('Helvetica-Bold');
    doc.rect(40, yInfo, 230, 18).fillAndStroke('#e3e3e3', '#222');
    doc.rect(330, yInfo, 230, 18).fillAndStroke('#e3e3e3', '#222');
    doc.fillColor('#222').text('DATE', 45, yInfo + 4);
    doc.text('INVOICE #', 335, yInfo + 4);

    doc.font('Helvetica').fillColor('#000');
    doc.rect(40, yInfo + 18, 230, 40).stroke();
    doc.rect(330, yInfo + 18, 230, 40).stroke();
    doc.text(formattedDate, 45, yInfo + 24);
    doc.text(result.insertId, 335, yInfo + 24);

    doc.font('Helvetica-Bold').fillColor('#222');
    doc.rect(40, yInfo + 58, 230, 18).fillAndStroke('#e3e3e3', '#222');
    doc.rect(330, yInfo + 58, 230, 18).fillAndStroke('#e3e3e3', '#222');
    doc.fillColor('#222').text('CUSTOMER INFORMATION', 45, yInfo + 62);
    doc.text('REPAIR ORDER', 335, yInfo + 62);

    doc.font('Helvetica').fillColor('#000');
    doc.rect(40, yInfo + 76, 230, 40).stroke();
    doc.rect(330, yInfo + 76, 230, 40).stroke();
    doc.text(`TRAILER: ${trailer}`, 45, yInfo + 82);
    doc.text(`${description || ''}`, 335, yInfo + 82);

    doc.moveDown(7);

    // TABLA DE PARTES
    const tableTop = doc.y + 10;
    const col = [40, 90, 250, 340, 390, 460, 520]; // Ajusta según ancho de página

    // Encabezado de tabla
    doc.rect(col[0], tableTop, col[6] - col[0], 20).fillAndStroke('#b3d1f7', '#222');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#222');
    doc.text('PART NO', col[0] + 2, tableTop + 5, { width: col[1] - col[0] - 4, align: 'center' });
    doc.text('DESCRIPTION', col[1] + 2, tableTop + 5, { width: col[2] - col[1] - 4, align: 'center' });
    doc.text('QTY', col[2] + 2, tableTop + 5, { width: col[3] - col[2] - 4, align: 'center' });
    doc.text('U/M', col[3] + 2, tableTop + 5, { width: col[4] - col[3] - 4, align: 'center' });
    doc.text('PRICE', col[4] + 2, tableTop + 5, { width: col[5] - col[4] - 4, align: 'center' });
    doc.text('TOTAL', col[5] + 2, tableTop + 5, { width: col[6] - col[5] - 4, align: 'center' });

    // Filas de partes
    let y = tableTop + 20;
    const maxRows = 15;
    (partsArr.length ? partsArr : Array(maxRows).fill({})).slice(0, maxRows).forEach((p, i) => {
      doc.rect(col[0], y, col[6] - col[0], 18).strokeColor('#b3d1f7').stroke();
      doc.font('Helvetica').fontSize(10).fillColor('#000');
      doc.text(p.sku || '-', col[0] + 2, y + 4, { width: col[1] - col[0] - 4, align: 'center' });
      doc.text(p.part || '-', col[1] + 2, y + 4, { width: col[2] - col[1] - 4, align: 'center' });
      doc.text(p.qty || '-', col[2] + 2, y + 4, { width: col[3] - col[2] - 4, align: 'center' });
      doc.text('-', col[3] + 2, y + 4, { width: col[4] - col[3] - 4, align: 'center' }); // U/M
      doc.text(
        p.unitPrice
          ? Number(p.unitPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
          : '$0.00',
        col[4] + 2, y + 4, { width: col[5] - col[4] - 4, align: 'center' }
      );
      doc.text(
        p.qty && p.unitPrice
          ? (Number(p.qty) * Number(p.unitPrice)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
          : '$0.00',
        col[5] + 2, y + 4, { width: col[6] - col[5] - 4, align: 'center' }
      );
      y += 18;
    });

    // Línea final de tabla
    doc.rect(col[0], y, col[6] - col[0], 0.5).fillAndStroke('#222', '#222');

    // SUBTOTAL, TAX, TOTAL
    y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#222');
    doc.text('SUBTOTAL:', col[4], y, { width: col[5] - col[4], align: 'right' });
    doc.font('Helvetica').text(partsTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), col[5], y, { width: col[6] - col[5], align: 'center' });

    y += 16;
    doc.font('Helvetica-Bold').text('TAX:', col[4], y, { width: col[5] - col[4], align: 'right' });
    doc.font('Helvetica').text('$0.00', col[5], y, { width: col[6] - col[5], align: 'center' });

    y += 16;
    doc.font('Helvetica-Bold').text('TOTAL:', col[4], y, { width: col[5] - col[4], align: 'right' });
    doc.font('Helvetica').fillColor('#d32f2f').text((partsTotal + laborTotal + extra).toLocaleString('en-US', { style: 'currency', currency: 'USD' }), col[5], y, { width: col[6] - col[5], align: 'center' });

    // TÉRMINOS Y FIRMAS
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#222').text('TERMS & CONDITIONS:', 40, doc.y);
    doc.font('Helvetica').fontSize(8).fillColor('#222').text('This estimate is not a final bill, pricing could change if job specifications change.', 40, doc.y + 12);

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(9).text('I accept this estimate without any changes □', 40, doc.y + 10);
    doc.text('I accept this estimate with the handwritten changes □', 40, doc.y + 24);

    doc.moveDown(2);
    doc.text('NAME: ____________________________    SIGNATURE: ____________________________', 40, doc.y + 10);
    doc.font('Helvetica-BoldOblique').fontSize(12).fillColor('#222').text('Thanks for your business!', 40, doc.y + 30);

    doc.end();

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