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
router.post('/', async (req, res) => {
  try {
    // Normaliza el campo totalPOClassic para aceptar cualquier variante
    let poClassic = req.body.totalPOClassic;
    if (poClassic === undefined || poClassic === null || poClassic === '') {
      poClassic = req.body.total_po_classic || req.body.po_classic || '';
    }
    const qty = req.body.qty;
    const qty_remaining = qty;
    const [result] = await db.query(
      `INSERT INTO receives
        (sku, category, item, provider, brand, um, destino_trailer, invoice, invoiceLink, qty, costTax, totalPOClassic, fecha, estatus, qty_remaining)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.sku, req.body.category, req.body.item, req.body.provider, req.body.brand, req.body.um,
        req.body.destino_trailer, req.body.invoice, req.body.invoiceLink, qty, req.body.costTax, poClassic, req.body.fecha, 'PENDING', qty_remaining
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
    // Normaliza el campo totalPOClassic para aceptar cualquier variante
    let poClassic = fields.totalPOClassic;
    if (poClassic === undefined || poClassic === null || poClassic === '') {
      poClassic = fields.total_po_classic || fields.po_classic || '';
    }
    // Obtener los datos actuales
    const [oldResults] = await db.query('SELECT * FROM receives WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('Receipt not found');
    }
    const oldData = oldResults[0];

    // LOG para depuración: ver qué se va a actualizar
    console.log('[PUT] /api/receive/' + id + ' - Updating in database:', {
      ...fields,
      totalPOClassic: poClassic,
      id
    });

    // Actualizar SOLO el campo totalPOClassic si es lo único que viene en el body
    // Si solo se manda estatus, solo actualiza estatus
    // Si viene totalPOClassic, actualiza ese campo también
    // Si viene más de un campo, actualiza todos los campos relevantes
    // Si solo viene estatus, no sobrescribas los demás campos

    // Si el body solo trae estatus, actualiza solo estatus
    const onlyStatus = Object.keys(fields).length === 2 && fields.estatus !== undefined && fields.usuario !== undefined;
    const onlyStatusAndPOClassic = Object.keys(fields).length === 3 && fields.estatus !== undefined && fields.usuario !== undefined && poClassic !== '';

    if (onlyStatus) {
      await db.query('UPDATE receives SET estatus=? WHERE id=?', [fields.estatus, id]);
      // Audit log
      await logAccion(usuario, 'UPDATE', 'receives', id, JSON.stringify({ before: { estatus: oldData.estatus }, after: { estatus: fields.estatus } }));
      return res.status(200).send('Receipt updated successfully (estatus only)');
    }

    if (onlyStatusAndPOClassic) {
      await db.query('UPDATE receives SET estatus=?, totalPOClassic=? WHERE id=?', [fields.estatus, poClassic, id]);
      await logAccion(usuario, 'UPDATE', 'receives', id, JSON.stringify({ before: { estatus: oldData.estatus, totalPOClassic: oldData.totalPOClassic }, after: { estatus: fields.estatus, totalPOClassic: poClassic } }));
      return res.status(200).send('Receipt updated successfully (estatus + totalPOClassic)');
    }

    // Si viene más de un campo, actualiza todos los campos relevantes
    const updateFields = {
      sku: fields.sku !== undefined ? fields.sku : oldData.sku,
      category: fields.category !== undefined ? fields.category : oldData.category,
      item: fields.item !== undefined ? fields.item : oldData.item,
      provider: fields.provider !== undefined ? fields.provider : oldData.provider,
      brand: fields.brand !== undefined ? fields.brand : oldData.brand,
      um: fields.um !== undefined ? fields.um : oldData.um,
      destino_trailer: fields.destino_trailer !== undefined ? fields.destino_trailer : oldData.destino_trailer,
      invoice: invoicePath !== undefined ? invoicePath : oldData.invoice,
      invoiceLink: fields.invoiceLink !== undefined ? fields.invoiceLink : oldData.invoiceLink,
      qty: fields.qty !== undefined ? fields.qty : oldData.qty,
      costTax: fields.costTax !== undefined ? fields.costTax : oldData.costTax,
      totalPOClassic: poClassic !== undefined ? poClassic : oldData.totalPOClassic,
      total: fields.total !== undefined ? fields.total : oldData.total,
      fecha: fields.fecha !== undefined ? fields.fecha : oldData.fecha,
      estatus: fields.estatus !== undefined ? fields.estatus : oldData.estatus,
      qty_remaining: fields.qty_remaining !== undefined ? fields.qty_remaining : oldData.qty_remaining
    };

    await db.query(
      `UPDATE receives SET 
        sku=?, category=?, item=?, provider=?, brand=?, um=?, destino_trailer=?, invoice=?, invoiceLink=?, qty=?, costTax=?, totalPOClassic=?, total=?, fecha=?, estatus=?, qty_remaining=?
       WHERE id=?`,
      [
        updateFields.sku, updateFields.category, updateFields.item, updateFields.provider, updateFields.brand, updateFields.um,
        updateFields.destino_trailer, updateFields.invoice, updateFields.invoiceLink, updateFields.qty, updateFields.costTax, updateFields.totalPOClassic, updateFields.total, updateFields.fecha, updateFields.estatus, updateFields.qty_remaining, id
      ]
    );

    const { usuario: user, ...rest } = fields;
    const after = { ...oldData, ...rest, totalPOClassic: poClassic };
    delete after.usuario;

    // Solo comparar campos existentes
    const changes = {};
    if (String(oldData['totalPOClassic'] ?? '') !== String(poClassic ?? '')) {
      changes['totalPOClassic'] = { before: oldData['totalPOClassic'], after: poClassic };
    }
    Object.keys(after).forEach(key => {
      if ([
        'sku','category','item','provider','brand','um','destino_trailer','invoice','invoiceLink','qty','costTax','total','fecha','estatus','qty_remaining'
      ].includes(key)) {
        if (String(oldData[key] ?? '') !== String(after[key] ?? '')) {
          changes[key] = { before: oldData[key], after: after[key] };
        }
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