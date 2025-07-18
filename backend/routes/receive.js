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
    console.error('Error inserting into audit_log:', err);
  }
}

// Add receipt
router.post('/', async (req, res) => {  const {
    sku, category, item, provider, brand, um,
    destino_trailer, qty, costTax, totalPOClassic, fecha, usuario, invoiceLink
  } = req.body;

  const qty_remaining = qty; // Inicializa qty_remaining igual a qty recibido

  try {
    const [result] = await db.query(
      `INSERT INTO receives
        (sku, category, item, provider, brand, um, destino_trailer, invoice, invoiceLink, qty, costTax, totalPOClassic, fecha, estatus, qty_remaining)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku, category, item, provider, brand, um,
        destino_trailer, req.body.invoice, req.body.invoiceLink, qty, costTax, totalPOClassic, fecha, 'PENDING', qty_remaining
      ]
    );
    const { usuario: user, ...rest } = req.body;
    await logAccion(user, 'CREATE', 'receives', result.insertId, JSON.stringify(rest));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding receipt');
  }
});

// Get receipts (you can filter by trailer and status)
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
    res.status(500).send('Error fetching receipts');
  }
});

// Mark as USED
router.put('/:id/use', async (req, res) => {
  try {
    await db.query(
      'UPDATE receives SET estatus = "USED" WHERE id = ?',
      [req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Error');  }
});

// Get pending parts for a specific trailer
router.get('/pending/:trailer', async (req, res) => {
  const { trailer } = req.params;
  
  try {
    const [results] = await db.query(
      `SELECT id, sku, item, destino_trailer, qty_remaining, estatus, costTax
       FROM receives 
       WHERE destino_trailer = ? AND estatus = 'PENDING' AND qty_remaining > 0
       ORDER BY id DESC`,
      [trailer]
    );
    
    console.log(`📋 Consulta de partes pendientes para trailer ${trailer}:`, {
      resultsCount: results.length,
      results: results.map(r => ({ id: r.id, sku: r.sku, qty_remaining: r.qty_remaining }))
    });
    
    res.json(results);
  } catch (err) {
    console.error('Error fetching pending parts:', err);
    res.status(500).json({ error: 'Error fetching pending parts' });
  }
});

// Get trailers with pending parts
router.get('/trailers/with-pending', async (req, res) => {
  try {
    // LIMPIEZA AGRESIVA: Forzar limpieza de alertas fantasma antes de responder
    if (db.cleanReceivesAlerts) {
      await db.cleanReceivesAlerts();
    }
    const [results] = await db.query(
      `SELECT DISTINCT destino_trailer
       FROM receives 
       WHERE estatus = 'PENDING' AND qty_remaining > 0
       ORDER BY destino_trailer`
    );
    // FILTRO EXTRA: Verificar que realmente existan partes pendientes para cada trailer
    const trailers = [];
    for (const r of results) {
      if (!r.destino_trailer) continue;
      const [pending] = await db.query(
        `SELECT COUNT(*) as count FROM receives WHERE destino_trailer = ? AND estatus = 'PENDING' AND qty_remaining > 0`,
        [r.destino_trailer]
      );
      if (pending[0].count > 0) {
        trailers.push(r.destino_trailer);
      }
    }
    console.log('🚛 Trailers con partes pendientes (verificados):', trailers);
    res.json(trailers);
  } catch (err) {
    console.error('Error fetching trailers with pending parts:', err);
    res.status(500).json({ error: 'Error fetching trailers with pending parts' });
  }
});

// Update receipt
router.put('/:id', upload.single('invoice'), async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const { usuario } = req.body;
  let invoicePath = req.file ? `/uploads/${req.file.filename}` : (fields.invoice || '');

  try {
    const [oldResults] = await db.query('SELECT * FROM receives WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('Receipt not found');
    }
    const oldData = oldResults[0];    await db.query(
      `UPDATE receives SET 
        sku=?, category=?, item=?, provider=?, brand=?, um=?, destino_trailer=?, invoice=?, invoiceLink=?, qty=?, costTax=?, totalPOClassic=?, fecha=?, estatus=?
       WHERE id=?`,
      [
        fields.sku, fields.category, fields.item, fields.provider, fields.brand, fields.um,
        fields.destino_trailer, invoicePath, fields.invoiceLink, fields.qty, fields.costTax, fields.totalPOClassic, fields.fecha, fields.estatus, id
      ]
    );

    const { usuario: user, ...rest } = fields;
    const after = { ...rest };
    delete after.usuario;

    // Only compare changed fields
    const changes = {};
    Object.keys(after).forEach(key => {
      if (
        String(oldData[key] ?? '') !== String(after[key] ?? '')
      ) {
        changes[key] = { before: oldData[key], after: after[key] };
      }
    });

    await logAccion(
      usuario,
      'UPDATE',
      'receives',
      id,
      Object.keys(changes).length > 0
        ? JSON.stringify({
            before: Object.fromEntries(Object.entries(oldData).filter(([k]) => changes[k])),
            after: Object.fromEntries(Object.entries(after).filter(([k]) => changes[k]))
          })
        : 'No real changes'
    );
    res.status(200).send('Receipt updated successfully');
  } catch (err) {
    res.status(500).send('Error updating receipt');
  }
});

// Delete receipt
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM receives WHERE id = ?', [id]);
    if (!results || results.length === 0) {
      return res.status(404).send('Receipt not found');
    }
    const oldData = results[0];
    await db.query('DELETE FROM receives WHERE id = ?', [id]);
    await logAccion(
      usuario,
      'DELETE',
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
    res.status(200).send('Receipt deleted successfully');
  } catch (err) {
    res.status(500).send('Error deleting receipt');
  }
});

module.exports = router;