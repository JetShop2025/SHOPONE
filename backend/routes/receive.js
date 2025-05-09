// backend/routes/receive.js
const express = require('express');
const multer = require('multer');
const db = require('../db');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.use(express.json());

function logAccion(usuario, accion, tabla, registro_id, detalles = '') {
  db.query(
    'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles) VALUES (?, ?, ?, ?, ?)',
    [usuario, accion, tabla, registro_id, detalles],
    (err) => {
      if (err) {
        console.error('Error al insertar en audit_log:', err);
      }
    }
  );
}

// Agregar recepción
router.post('/', upload.single('invoice'), (req, res) => {
  const {
    sku, category, item, provider, brand, um,
    destino_trailer, qty, costTax, totalPOClassic, usuario
  } = req.body;
  const invoice = req.file ? `/uploads/${req.file.filename}` : '';

  db.query(
    `INSERT INTO receives
      (sku, category, item, provider, brand, um, destino_trailer, invoice, qty, costTax, totalPOClassic, estatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
    [
      sku, category, item, provider, brand, um,
      destino_trailer, invoice, qty, costTax, totalPOClassic
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al agregar recepción');
      }
      // EXCLUIR usuario del log
      const { usuario, ...rest } = req.body;
      logAccion(usuario, 'CREAR', 'receives', result.insertId, JSON.stringify(rest));
      res.sendStatus(200);
    }
  );
});

// Obtener recepciones (puedes filtrar por trailer y estatus)
router.get('/', (req, res) => {
  const { destino_trailer, estatus } = req.query;
  let sql = `
    SELECT r.*, i.part 
    FROM receives r
    LEFT JOIN inventory i ON r.sku = i.sku
    WHERE 1=1
  `;
  const params = [];
  if (destino_trailer) {
    sql += ' AND r.destino_trailer = ?';
    params.push(destino_trailer);
  }
  if (estatus) {
    sql += ' AND r.estatus = ?';
    params.push(estatus);
  }
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).send('Error al obtener recepciones');
    res.json(results);
  });
});

// Marcar como USADO
router.put('/:id/use', (req, res) => {
  db.query(
    'UPDATE receives SET estatus = "USADO" WHERE id = ?',
    [req.params.id],
    err => {
      if (err) return res.status(500).send('Error');
      res.sendStatus(200);
    }
  );
});

// Modificar recepción
router.put('/:id', upload.single('invoice'), (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const { usuario } = req.body;
  let invoicePath = req.file ? `/uploads/${req.file.filename}` : (fields.invoice || '');

  db.query('SELECT * FROM receives WHERE id = ?', [id], (err, oldResults) => {
    if (err || oldResults.length === 0) {
      return res.status(404).send('Recepción no encontrada');
    }
    const oldData = oldResults[0];

    db.query(
      `UPDATE receives SET 
        sku=?, category=?, item=?, provider=?, brand=?, um=?, destino_trailer=?, invoice=?, qty=?, costTax=?, totalPOClassic=?, estatus=?
       WHERE id=?`,
      [
        fields.sku, fields.category, fields.item, fields.provider, fields.brand, fields.um,
        fields.destino_trailer, invoicePath, fields.qty, fields.costTax, fields.totalPOClassic, fields.estatus, id
      ],
      (err, result) => {
        if (err) {
          res.status(500).send('Error al actualizar la recepción');
        } else {
          // EXCLUIR usuario del log y comparar solo campos relevantes
          const { usuario, ...rest } = fields;
          // Solo guarda en "despues" los campos relevantes y sin usuario
          const despues = { ...rest };
          // Elimina campos vacíos o no relevantes si lo deseas
          delete despues.usuario;

          // Compara solo los campos que realmente cambiaron
          const cambios = {};
          Object.keys(despues).forEach(key => {
            if (
              // Compara como string para evitar falsos positivos por tipos
              String(oldData[key] ?? '') !== String(despues[key] ?? '')
            ) {
              cambios[key] = { antes: oldData[key], despues: despues[key] };
            }
          });

          logAccion(
            usuario,
            'MODIFICAR',
            'receives',
            id,
            Object.keys(cambios).length > 0
              ? JSON.stringify({ antes: Object.fromEntries(Object.entries(oldData).filter(([k]) => cambios[k])), despues: Object.fromEntries(Object.entries(despues).filter(([k]) => cambios[k])) })
              : 'Sin cambios reales'
          );
          res.status(200).send('Recepción actualizada exitosamente');
        }
      }
    );
  });
});

// Eliminar recepción
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  db.query('SELECT * FROM receives WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).send('Recepción no encontrada');
    }
    const oldData = results[0];
    db.query('DELETE FROM receives WHERE id = ?', [id], (err) => {
      if (err) {
        res.status(500).send('Error al eliminar la recepción');
      } else {
        logAccion(
          usuario,
          'ELIMINAR',
          'receives',
          id,
          JSON.stringify({
            id: oldData.id,
            sku: oldData.sku,
            item: oldData.item,
            provider: oldData.provider,
            qty: oldData.qty,
            destino_trailer: oldData.destino_trailer,
            estatus: oldData.estatus
          })
        );
        res.status(200).send('Recepción eliminada exitosamente');
      }
    });
  });
});

module.exports = router;