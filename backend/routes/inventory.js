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

// Agregar parte al inventario (con imagen)
router.post('/', upload.single('imagen'), async (req, res) => {
  const { sku, barCodes, category, part, provider, brand, um, area, usuario } = req.body;
  const cantidad = Number(req.body.cantidad) || 0;
  const imagen = req.file ? `/uploads/${req.file.filename}` : '';
  try {
    await db.query(
      `INSERT INTO inventory (sku, barCodes, category, part, provider, brand, um, area, onHand, imagen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, barCodes, category, part, provider, brand, um, area, cantidad, imagen]
    );
    await logAccion(usuario, 'CREAR', 'inventory', sku, JSON.stringify(req.body));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al agregar la parte');
  }
});

// Descontar partes del inventario
router.post('/deduct', express.json(), async (req, res) => {
  const { parts, usuario } = req.body;
  let errorMsg = '';
  try {
    for (const part of parts) {
      if (part.sku && part.qty) {
        const [results] = await db.query(
          'SELECT onHand FROM inventory WHERE sku = ?',
          [part.sku]
        );
        if (results.length === 0) {
          errorMsg = `La parte "${part.sku}" no existe en inventario.`;
          return res.status(400).json({ error: errorMsg });
        }
        if (results[0].onHand < Number(part.qty)) {
          errorMsg = `No hay suficiente inventario para la parte "${part.sku}".`;
          return res.status(400).json({ error: errorMsg });
        }
      }
    }
    for (const part of parts) {
      if (part.sku && part.qty) {
        await db.query(
          `UPDATE inventory 
           SET onHand = onHand - ?, salidasWo = salidasWo + ?
           WHERE sku = ?`,
          [Number(part.qty), Number(part.qty), part.sku]
        );
        await logAccion(usuario, 'DESCONTAR', 'inventory', part.sku, JSON.stringify(part));
      }
    }
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Error al validar inventario');
  }
});

// Obtener inventario
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM inventory');
    res.json(results);
  } catch (err) {
    res.status(500).send('Error al obtener el inventario');
  }
});

// Eliminar parte del inventario
router.delete('/:sku', async (req, res) => {
  const { sku } = req.params;
  const { usuario } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM inventory WHERE sku = ?', [sku]);
    if (!results || results.length === 0) {
      return res.status(404).send('Parte no encontrada');
    }
    const oldData = results[0];
    await db.query('DELETE FROM inventory WHERE sku = ?', [sku]);
    await logAccion(
      usuario,
      'ELIMINAR',
      'inventory',
      sku,
      JSON.stringify({
        sku: oldData.sku,
        part: oldData.part,
        category: oldData.category,
        provider: oldData.provider,
        brand: oldData.brand,
        um: oldData.um,
        area: oldData.area,
        onHand: oldData.onHand,
        precio: oldData.precio
      })
    );
    res.status(200).send('Parte eliminada exitosamente');
  } catch (err) {
    res.status(500).send('Error al eliminar la parte');
  }
});

// Modificar parte del inventario
router.put('/:sku', upload.single('imagen'), async (req, res) => {
  const { sku } = req.params;
  const fields = req.body;
  const { usuario } = req.body;
  let imagenPath = req.file ? `/uploads/${req.file.filename}` : (fields.imagen || '');

  try {
    // 1. Consulta el estado anterior
    const [oldResults] = await db.query('SELECT * FROM inventory WHERE sku = ?', [sku]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('Parte no encontrada');
    }
    const oldData = oldResults[0];

    // 2. Realiza el update
    await db.query(
      `UPDATE inventory SET 
        barCodes = ?, category = ?, part = ?, provider = ?, brand = ?, um = ?, area = ?, 
        receive = ?, salidasWo = ?, onHand = ?, precio = ?, imagen = ?
       WHERE sku = ?`,
      [
        fields.barCodes, fields.category, fields.part, fields.provider, fields.brand, fields.um, fields.area,
        fields.receive, fields.salidasWo, fields.onHand, fields.precio, imagenPath, sku
      ]
    );
    // 3. Guarda en detalles el antes y después
    const { usuario, ...rest } = req.body;
    await logAccion(usuario, 'MODIFICAR', 'inventory', sku, JSON.stringify({ antes: oldData, despues: rest }));
    res.status(200).send('Parte actualizada exitosamente');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al actualizar la parte');
  }
});

module.exports = router;