const express = require('express');
const db = require('../db');
const router = express.Router();

router.use(express.json());

// Registrar partes usadas
router.post('/', async (req, res) => {
  const { work_order_id, sku, part_name, qty_used, cost, usuario } = req.body;
  let qtyToDeduct = Number(qty_used);

  try {
    // Busca recibos FIFO con partes disponibles
    const [receives] = await db.query(
      'SELECT id, invoice, qty_remaining FROM receives WHERE sku = ? AND qty_remaining > 0 ORDER BY fecha ASC',
      [sku]
    );

    for (const receive of receives) {
      if (qtyToDeduct <= 0) break;
      const deductQty = Math.min(receive.qty_remaining, qtyToDeduct);

      // Descuenta del recibo
      await db.query(
        'UPDATE receives SET qty_remaining = qty_remaining - ? WHERE id = ?',
        [deductQty, receive.id]
      );

      // Inserta en work_order_parts con el invoice correcto
      await db.query(
        'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, usuario, invoice, invoiceLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [work_order_id, sku, part_name, deductQty, cost, usuario, receive.invoice, receive.invoiceLink]
      );

      qtyToDeduct -= deductQty;
    }

    res.status(200).json({ message: 'Parts registered with FIFO invoices' });
  } catch (err) {
    console.error('Error in /work-order-parts:', err);
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