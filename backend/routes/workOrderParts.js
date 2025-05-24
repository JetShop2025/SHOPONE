const express = require('express');
const db = require('../db');
const router = express.Router();

router.use(express.json());

// Registrar partes usadas
router.post('/', async (req, res) => {
  const { work_order_id, sku, part_name, qty_used, cost, usuario } = req.body;
  let qtyToDeduct = Number(qty_used);

  const cleanCost = typeof cost === 'string' ? Number(cost.replace(/[^0-9.-]+/g, '')) : cost;

  try {
    // Busca recibos FIFO con partes disponibles
    const [receives] = await db.query(
      'SELECT id, invoice, invoiceLink, qty_remaining FROM receives WHERE sku = ? AND qty_remaining > 0 ORDER BY fecha ASC',
      [sku]
    );

    let totalDeducted = 0;
    for (const receive of receives) {
      if (qtyToDeduct <= 0) break;
      const deductQty = Math.min(receive.qty_remaining, qtyToDeduct);

      // Descuenta del recibo
      await db.query(
        'UPDATE receives SET qty_remaining = qty_remaining - ?' +
        (deductQty === receive.qty_remaining ? ', estatus = "USED"' : '') +
        ' WHERE id = ?',
        [deductQty, receive.id]
      );

      // Inserta en work_order_parts con el invoice correcto
      await db.query(
        'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, usuario, invoice, invoiceLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [work_order_id, sku, part_name, deductQty, cleanCost, usuario, receive.invoice, receive.invoiceLink]
      );

      qtyToDeduct -= deductQty;
      totalDeducted += deductQty;
    }

    // Si faltó descontar y no hay receives, registra como inventario general
    if (qtyToDeduct > 0) {
      await db.query(
        'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, usuario, invoice, invoiceLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [work_order_id, sku, part_name, qtyToDeduct, cleanCost, usuario, null, null]
      );
    }

    res.status(200).json({ message: 'Partes registradas exitosamente', totalDeducted });
  } catch (error) {
    console.error('Error al registrar partes usadas:', error);
    res.status(500).json({ error: 'Error al registrar partes usadas' });
  }
});

module.exports = router;