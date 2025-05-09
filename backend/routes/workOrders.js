const express = require('express');
const db = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.use(express.json());

// Obtener todas las órdenes de trabajo
router.get('/', (req, res) => {
  db.query('SELECT * FROM work_orders', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error al obtener las órdenes de trabajo');
    } else {
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
    }
  });
});

// Agregar nueva orden de trabajo y generar PDF
router.post('/', (req, res) => {
  const { billToCo, trailer, mechanic, date, description, parts, totalHrs, totalLabAndParts, status, usuario } = req.body;

  // Validar que la fecha no esté vacía
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
  db.query(query, values, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error al agregar la orden de trabajo');
    } else {
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

      console.log('Intentando generar PDF en:', pdfPath);

      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(pdfPath);

      stream.on('error', (err) => {
        console.error('Error al escribir el PDF:', err);
        res.status(500).send('Error al generar el PDF');
      });

      doc.pipe(stream);

      // LOGO
      try {
        doc.image(path.join(__dirname, 'logo.png'), 40, 30, { width: 100 });
      } catch (e) {
        // Si no hay logo, ignora el error
      }
      doc.moveDown(2);

      // TÍTULO
      doc
        .fontSize(22)
        .fillColor('#1976d2')
        .font('Courier-Bold') // <--- CAMBIA AQUÍ
        .text('ORDEN DE TRABAJO', { align: 'center', underline: true });
      doc.moveDown(1);

      // LÍNEA
      doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#1976d2').lineWidth(2).stroke();
      doc.moveDown(1);

      // DATOS GENERALES
      doc.fontSize(12).fillColor('black').font('Courier'); // <--- CAMBIA AQUÍ
      doc.text(`ID: ${result.insertId || ''}`, { continued: true }).text(`   Fecha: ${date}`);
      doc.text(`Cliente: ${billToCo}`);
      doc.text(`Tráiler: ${trailer}`);
      doc.text(`Mecánico: ${mechanic}`);
      doc.text(`Estado: ${status}`);
      doc.moveDown();

      // DESCRIPCIÓN
      doc.font('Courier-Bold').text('Descripción:', { underline: true }); // <--- CAMBIA AQUÍ
      doc.font('Courier').text(description || 'Sin descripción'); // <--- CAMBIA AQUÍ
      doc.moveDown();

      // PARTES
      doc.font('Courier-Bold').text('Partes:', { underline: true }); // <--- CAMBIA AQUÍ
      doc.moveDown(0.5);

      // Encabezado de tabla
      doc
        .font('Courier-Bold')
        .fillColor('#1976d2')
        .text('Parte', 60, doc.y, { continued: true })
        .text('Cantidad', 200, doc.y, { continued: true })
        .text('Costo', 300, doc.y);
      doc.moveDown(0.3);
      doc
        .moveTo(60, doc.y)
        .lineTo(400, doc.y)
        .strokeColor('#1976d2')
        .lineWidth(1)
        .stroke();
      doc.font('Courier').fillColor('#444');

      // Filas de partes
      (parts || []).forEach((p, idx) => {
        doc.text(p.part || '-', 60, doc.y, { continued: true });
        doc.text(p.qty || '-', 200, doc.y, { continued: true });
        doc.text(p.cost || '-', 300, doc.y);
      });
      doc.moveDown(1);

      // Totales
      doc
        .font('Courier-Bold')
        .fillColor('black')
        .text(`Total Horas: `, { continued: true })
        .font('Courier')
        .text(totalHrs || '-');
      doc
        .font('Courier-Bold')
        .text(`Total Mano de Obra y Partes: `, { continued: true })
        .font('Courier')
        .text(totalLabAndParts || '-');

      // Pie de página
      doc.moveDown(2);
      doc
        .fontSize(10)
        .fillColor('#888')
        .text('Generado por el sistema de órdenes de trabajo', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        // REGISTRO EN AUDITORÍA
        logAccion(usuario, 'CREAR', 'work_orders', result.insertId, JSON.stringify(req.body));
        res.status(201).json({
          message: 'Orden de trabajo agregada exitosamente',
          pdfUrl: `/pdfs/${pdfName}`
        });
      });
    }
  });
});

// Eliminar orden de trabajo por ID
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  // 1. Obtén los datos antes de eliminar
  db.query('SELECT * FROM work_orders WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).send('Orden no encontrada');
    }
    const oldData = results[0];
    db.query('DELETE FROM work_orders WHERE id = ?', [id], (err) => {
      if (err) {
        console.error(err);
        res.status(500).send('Error al eliminar la orden de trabajo');
      } else {
        // 2. Guarda los detalles claros en el log
        logAccion(
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
      }
    });
  });
});

// Función para guardar en el log
function logAccion(usuario, accion, tabla, registro_id, detalles = '') {
  db.query(
    'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles) VALUES (?, ?, ?, ?, ?)',
    [usuario, accion, tabla, registro_id, detalles]
  );
}

// Actualizar orden de trabajo
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const { usuario } = req.body;

  // 1. Consulta el estado anterior
  db.query('SELECT * FROM work_orders WHERE id = ?', [id], (err, oldResults) => {
    if (err || oldResults.length === 0) {
      return res.status(404).send('Orden no encontrada');
    }
    const oldData = oldResults[0];

    // 2. Realiza el update (ajusta los campos según tu estructura)
    db.query(
      `UPDATE work_orders SET 
        billToCo = ?, trailer = ?, mechanic = ?, date = ?, description = ?, parts = ?, totalHrs = ?, totalLabAndParts = ?, status = ?
       WHERE id = ?`,
      [
        fields.billToCo, fields.trailer, fields.mechanic, fields.date, fields.description,
        JSON.stringify(fields.parts), fields.totalHrs, fields.totalLabAndParts, fields.status, id
      ],
      (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send('Error al actualizar la orden');
        } else {
          res.status(200).send('Orden actualizada exitosamente');
          // 3. Guarda en detalles el antes y después
          const { usuario, ...rest } = fields;
          logAccion(
            usuario,
            'MODIFICAR',
            'work_orders',
            id,
            JSON.stringify({ antes: oldData, despues: rest })
          );
        }
      }
    );
  });
});

// Servir los PDFs generados
router.use('/pdfs', express.static(path.join(__dirname, '..', 'pdfs')));

// Eliminar varias órdenes de trabajo por IDs
router.delete('/', (req, res) => {
  const { ids, usuario } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).send('Debes enviar un array de IDs');
  }
  const placeholders = ids.map(() => '?').join(',');
  // 1. Obtén los datos antes de eliminar
  db.query(
    `SELECT * FROM work_orders WHERE id IN (${placeholders})`,
    ids,
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al obtener las órdenes antes de eliminar');
      }
      // 2. Elimina las órdenes
      db.query(
        `DELETE FROM work_orders WHERE id IN (${placeholders})`,
        ids,
        (err, result) => {
          if (err) {
            console.error(err);
            res.status(500).send('Error al eliminar las órdenes de trabajo');
          } else {
            // 3. Guarda detalles claros en el log para cada orden
            ids.forEach(id => {
              const oldData = results.find(r => r.id == id);
              logAccion(
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
            });
            res.status(200).send(`Órdenes eliminadas: ${result.affectedRows}`);
          }
        }
      );
    }
  );
});

// Obtener logs de auditoría
router.get('/audit-log', (req, res) => {
  db.query('SELECT * FROM audit_log ORDER BY fecha DESC', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error al obtener el log de auditoría');
    } else {
      res.json(results);
    }
  });
});

module.exports = router;