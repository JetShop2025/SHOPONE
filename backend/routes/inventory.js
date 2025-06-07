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
router.post('/', async (req, res) => {
  const {
    sku, barCodes, category, part, provider, brand, um, area,
    onHand, imagen, precio, usuario
  } = req.body;

  try {
    await db.query(
      `INSERT INTO inventory (sku, barCodes, category, part, provider, brand, um, area, onHand, imagen, precio, usuario, invoiceLink)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, barCodes, category, part, provider, brand, um, area, Number(onHand) || 0, imagen || '', Number(precio) || 0, usuario]
    );
    await logAccion(usuario, 'CREATE', 'inventory', sku, JSON.stringify(req.body));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR ADDING PART TO INVENTORY');
  }
});

// Descontar partes del inventario
router.post('/deduct', async (req, res) => {
  // Soporta ambos formatos: array directo o { parts, usuario }
  const usuario = req.body.usuario || 'system';
  const parts = Array.isArray(req.body) ? req.body : req.body.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).send('No parts provided');
  }
  for (const part of parts) {
    if (!part.sku || !part.qty || isNaN(Number(part.qty)) || Number(part.qty) <= 0) {
      return res.status(400).send('Invalid part data');
    }
  }
  let errorMsg = '';
  try {
    console.log('Partes recibidas para descontar:', parts);
    for (const part of parts) {
      if (part.sku && part.qty) {
        const [results] = await db.query(
          'SELECT onHand FROM inventory WHERE sku = ?',
          [part.sku]
        );
        if (results.length === 0) {
          errorMsg = `The part "${part.sku}" does not exist in inventory.`;
          return res.status(400).json({ error: errorMsg });
        }
        if (results[0].onHand < Number(part.qty)) {
          errorMsg = `Not enough inventory for part "${part.sku}".`;
          return res.status(400).json({ error: errorMsg });
        }
        if (results[0].onHand < part.qty) {
          return res.status(400).json({ error: `No hay suficiente inventario para el SKU ${part.sku}` });
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
        await logAccion(usuario, 'DEDUCT', 'inventory', part.sku, JSON.stringify(part));
      }
    }
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('ERROR VALIDATING INVENTORY');
  }
});

// Obtener inventario
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM inventory');
    res.json(results);
  } catch (err) {
    res.status(500).send('ERROR FETCHING INVENTORY');
  }
});

// Eliminar parte del inventario
router.delete('/:sku', async (req, res) => {
  const { sku } = req.params;
  const { usuario } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM inventory WHERE sku = ?', [sku]);
    if (!results || results.length === 0) {
      return res.status(404).send('PART NOT FOUND');
    }
    const oldData = results[0];
    await db.query('DELETE FROM inventory WHERE sku = ?', [sku]);
    await logAccion(
      usuario,
      'DELETE',
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
    res.status(200).send('PART DELETED SUCCESSFULLY');
  } catch (err) {
    res.status(500).send('ERROR DELETING PART');
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
      return res.status(404).send('PART NOT FOUND');
    }
    const oldData = oldResults[0];

    // 2. Realiza el update
    await db.query(
      `UPDATE inventory SET 
        barCodes = ?, category = ?, part = ?, provider = ?, brand = ?, um = ?, area = ?, 
        receive = ?, salidasWo = ?, onHand = ?, precio = ?, imagen = ?, invoiceLink = ?
       WHERE sku = ?`,
      [
        fields.barCodes, fields.category, fields.part, fields.provider, fields.brand, fields.um, fields.area,
        fields.receive, fields.salidasWo, fields.onHand, fields.precio, imagenPath, fields.invoiceLink || '', sku
      ]
    );
    // 3. Guarda en detalles el antes y después
    const { usuario, ...rest } = req.body;
    await logAccion(usuario, 'UPDATE', 'inventory', sku, JSON.stringify({ before: oldData, after: rest }));
    res.status(200).send('PART UPDATED SUCCESSFULLY');
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR UPDATING PART');
  }
});

module.exports = router;