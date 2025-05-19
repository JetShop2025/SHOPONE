const express = require('express');
const db = require('../db');
const router = express.Router();

router.use(express.json());

// Registrar partes usadas
router.post('/', async (req, res) => {
  const { work_order_id, sku, part_name, qty_used, cost, usuario } = req.body;
  try {
    await db.query(
      'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, usuario) VALUES (?, ?, ?, ?, ?, ?)',
      [work_order_id, sku, part_name, qty_used, cost, usuario]
    );
    // Descontar del inventario
    await db.query(
      'UPDATE inventory SET onHand = onHand - ? WHERE sku = ?',
      [qty_used, sku]
    );
    res.status(200).send('Part registered and inventory updated');
  } catch (err) {
    res.status(500).send('Error registering part');
  }
});

// Consultar partes usadas por WO
router.get('/:work_order_id', async (req, res) => {
  const { work_order_id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT * FROM work_order_parts WHERE work_order_id = ?',
      [work_order_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send('Error fetching parts');
  }
});

module.exports = router;