const express = require('express');
const multer = require('multer');
const db = require('../db');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

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

// Agregar recepción
router.post('/', upload.single('invoice'), async (req, res) => {
  const {
    sku, category, item, provider, brand, um,
    destino_trailer, qty, costTax, totalPOClassic, usuario
  } = req.body;
  const invoice = req.file ? `/uploads/${req.file.filename}` : '';

  try {
    const [result] = await db.query(
      `INSERT INTO receives
        (sku, category, item, provider, brand, um, destino_trailer, invoice, qty, costTax, totalPOClassic, estatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
      [
        sku, category, item, provider, brand, um,
        destino_trailer, invoice, qty, costTax, totalPOClassic
      ]
    );
    const { usuario: user, ...rest } = req.body;
    await logAccion(user, 'CREAR', 'receives', result.insertId, JSON.stringify(rest));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al agregar recepción');
  }
});

// Obtener recepciones (puedes filtrar por trailer y estatus)
router.get('/', async (req, res) => {
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
  try {
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).send('Error al obtener recepciones');
  }
});

// Marcar como USADO
router.put('/:id/use', async (req, res) => {
  try {
    await db.query(
      'UPDATE receives SET estatus = "USADO" WHERE id = ?',
      [req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Error');
  }
});

// Modificar recepción
router.put('/:id', upload.single('invoice'), async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const { usuario } = req.body;
  let invoicePath = req.file ? `/uploads/${req.file.filename}` : (fields.invoice || '');

  try {
    const [oldResults] = await db.query('SELECT * FROM receives WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('Recepción no encontrada');
    }
    const oldData = oldResults[0];

    await db.query(
      `UPDATE receives SET 
        sku=?, category=?, item=?, provider=?, brand=?, um=?, destino_trailer=?, invoice=?, qty=?, costTax=?, totalPOClassic=?, estatus=?
       WHERE id=?`,
      [
        fields.sku, fields.category, fields.item, fields.provider, fields.brand, fields.um,
        fields.destino_trailer, invoicePath, fields.qty, fields.costTax, fields.totalPOClassic, fields.estatus, id
      ]
    );

    const { usuario: user, ...rest } = fields;
    const despues = { ...rest };
    delete despues.usuario;

    // Compara solo los campos que realmente cambiaron
    const cambios = {};
    Object.keys(despues).forEach(key => {
      if (
        String(oldData[key] ?? '') !== String(despues[key] ?? '')
      ) {
        cambios[key] = { antes: oldData[key], despues: despues[key] };
      }
    });

    await logAccion(
      usuario,
      'MODIFICAR',
      'receives',
      id,
      Object.keys(cambios).length > 0
        ? JSON.stringify({
            antes: Object.fromEntries(Object.entries(oldData).filter(([k]) => cambios[k])),
            despues: Object.fromEntries(Object.entries(despues).filter(([k]) => cambios[k]))
          })
        : 'Sin cambios reales'
    );
    res.status(200).send('Recepción actualizada exitosamente');
  } catch (err) {
    res.status(500).send('Error al actualizar la recepción');
  }
});

// Eliminar recepción
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM receives WHERE id = ?', [id]);
    if (!results || results.length === 0) {
      return res.status(404).send('Recepción no encontrada');
    }
    const oldData = results[0];
    await db.query('DELETE FROM receives WHERE id = ?', [id]);
    await logAccion(
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
  } catch (err) {
    res.status(500).send('Error al eliminar la recepción');
  }
});

module.exports = router;