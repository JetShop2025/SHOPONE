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
    res.status(500).send('Error al obtener las órdenes de trabajo');
  }
});

// Agregar nueva orden de trabajo y generar PDF
router.post('/', async (req, res) => {
  const { billToCo, trailer, mechanic, date, description, parts, totalHrs, totalLabAndParts, status, usuario } = req.body;

  if (!date) {
    return res.status(400).send('El campo fecha es obligatorio');
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
      doc.image(logoPath, doc.page.width - 140, 30, { width: 110 }); // Derecha
    }
    doc.fontSize(22).font('Helvetica-Bold').text('Orden de Trabajo', 40, 40, { align: 'left' });
    doc.moveDown(2);

    // --- DATOS PRINCIPALES ---
    doc.fontSize(12).font('Helvetica');
    doc.text(`ID: ${result.insertId}`, 40, 100);
    doc.text(`Fecha: ${formattedDate}`, 200, 100);
    doc.text(`Cliente: ${billToCo}`, 40, 120);
    doc.text(`Trailer: ${trailer}`, 200, 120);
    doc.text(`Mecánico: ${mechanic}`, 40, 140);
    doc.text(`Estatus: ${status}`, 200, 140);

    doc.moveDown(2);

    // --- DESCRIPCIÓN ---
    doc.font('Helvetica-Bold').text('Descripción:', 40, 170, { underline: true });
    doc.font('Helvetica').text(description || 'Sin descripción', { width: 500, align: 'left' });
    doc.moveDown(1.5);

    // --- PARTES ---
    doc.font('Helvetica-Bold').text('Partes:', { underline: true });
    doc.moveDown(0.5);

    const partsArray = Array.isArray(parts) ? parts : [];
    if (partsArray.length === 0) {
      doc.font('Helvetica').text('Sin partes registradas');
    } else {
      // Encabezados de tabla
      doc.font('Helvetica-Bold').text('No.', 40, doc.y, { continued: true });
      doc.text('Parte', 70, doc.y, { continued: true });
      doc.text('Cantidad', 250, doc.y, { continued: true });
      doc.text('Costo', 350, doc.y);
      doc.moveDown(0.5);

      // Filas de partes
      partsArray.forEach((p, i) => {
        doc.font('Helvetica').text(`${i + 1}`, 40, doc.y, { continued: true });
        doc.text(`${p.part || ''}`, 70, doc.y, { continued: true });
        doc.text(`${p.qty || ''}`, 250, doc.y, { continued: true });
        doc.text(`${p.cost || ''}`, 350, doc.y);
      });
    }
    doc.moveDown(2);

    // --- TOTALES ---
    doc.font('Helvetica-Bold').text(`Total HRS: `, 40, doc.y, { continued: true });
    doc.font('Helvetica').text(`${totalHrs || ''}`, doc.x, doc.y, { continued: true });
    doc.font('Helvetica-Bold').text(`   Total LAB & PRTS: `, doc.x + 20, doc.y, { continued: true });
    doc.font('Helvetica').text(`${totalLabAndParts || ''}`, doc.x, doc.y);

    doc.end();
    // --- FIN DEL BLOQUE COMPLETO DE GENERACIÓN DEL PDF ---

    stream.on('finish', async () => {
      await logAccion(usuario, 'CREAR', 'work_orders', result.insertId, JSON.stringify(req.body));
      res.status(201).json({
        message: 'Orden de trabajo agregada exitosamente',
        pdfUrl: `/pdfs/${pdfName}`
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al agregar la orden de trabajo');
  }
});

// Eliminar orden de trabajo por ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!results || results.length === 0) {
      return res.status(404).send('Orden no encontrada');
    }
    const oldData = results[0];
    await db.query('DELETE FROM work_orders WHERE id = ?', [id]);
    await logAccion(
      usuario,
      'ELIMINAR',
      'work_orders',
      id,
      JSON.stringify({
        id: oldData.id,
        cliente: oldData.billToCo,
        trailer: oldData.trailer,
        fecha: oldData.date,
        descripcion: oldData.description,
        partes: oldData.parts,
        mecanico: oldData.mechanic,
        status: oldData.status
      })
    );
    res.status(200).send('Orden de trabajo eliminada exitosamente');
  } catch (err) {
    res.status(500).send('Error al eliminar la orden de trabajo');
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
      return res.status(404).send('Orden no encontrada');
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
      'MODIFICAR',
      'work_orders',
      id,
      JSON.stringify({ antes: oldData, despues: rest })
    );
    res.status(200).send('Orden actualizada exitosamente');
  } catch (err) {
    res.status(500).send('Error al actualizar la orden');
  }
});

// Eliminar varias órdenes de trabajo por IDs
router.delete('/', async (req, res) => {
  const { ids, usuario } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).send('Debes enviar un array de IDs');
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
        'ELIMINAR',
        'work_orders',
        id,
        oldData
          ? JSON.stringify({
              id: oldData.id,
              cliente: oldData.billToCo,
              trailer: oldData.trailer,
              fecha: oldData.date,
              descripcion: oldData.description,
              partes: oldData.parts,
              mecanico: oldData.mechanic,
              status: oldData.status
            })
          : 'No se encontró información previa'
      );
    }
    res.status(200).send(`Órdenes eliminadas: ${ids.length}`);
  } catch (err) {
    res.status(500).send('Error al eliminar las órdenes de trabajo');
  }
});

// Obtener logs de auditoría
router.get('/audit-log', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM audit_log ORDER BY fecha DESC');
    res.json(results);
  } catch (err) {
    res.status(500).send('Error al obtener el log de auditoría');
  }
});

// Servir los PDFs generados
router.use('/pdfs', express.static(path.join(__dirname, '..', 'pdfs')));

module.exports = router;