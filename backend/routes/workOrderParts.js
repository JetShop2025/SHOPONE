const express = require('express');
const db = require('../db');
const router = express.Router();

router.use(express.json());

// Registrar partes usadas
router.post('/', async (req, res) => {
  const { work_order_id, sku, part_name, qty_used, cost, usuario } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, usuario) VALUES (?, ?, ?, ?, ?, ?)',
      [work_order_id, sku, part_name, qty_used, cost, usuario]
    );
    res.status(200).json({ id: result.insertId }); // <-- esto es CLAVE
  } catch (err) {
    console.error('Error in /work-order-parts:', err); // <-- Para depuración
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
    console.error('Error in GET /work-order-parts/:work_order_id:', err); // <-- Para depuración
    res.status(500).send('Error fetching parts');
  }
});

module.exports = router;