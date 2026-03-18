const express = require('express');
const db = require('../db');
const router = express.Router();

router.use(express.json());

// Registrar partes usadas
router.post('/', async (req, res) => {
  const { work_order_id, sku, part_name, qty_used, cost, um, usuario } = req.body;
  const cleanCost = typeof cost === 'string' ? Number(cost.replace(/[^0-9.-]+/g, '')) : cost;

  console.log('Body recibido en /work-order-parts:', req.body);

  try {
    // Usar deductInventoryFIFO que maneja correctamente receives, inventory master y work_order_parts
    const partsToDeduct = [{
      sku: sku,
      part: part_name || '',
      qty: Number(qty_used) || 0,
      cost: cleanCost
    }];
    
    console.log('[work-order-parts] Calling deductInventoryFIFO for:', partsToDeduct);
    const fifoResult = await db.deductInventoryFIFO(partsToDeduct, usuario || 'system');
    console.log('[work-order-parts] FIFO deduction result:', fifoResult);
    
    // Crear entrada en work_order_parts con información FIFO
    let fifoInfo = null;
    if (fifoResult && fifoResult.details && Array.isArray(fifoResult.details)) {
      fifoInfo = fifoResult.details.find((r) => r.sku === sku);
    }
    
    await db.createWorkOrderPart({
      work_order_id: work_order_id,
      sku: sku,
      part_name: part_name || '',
      qty_used: Number(qty_used) || 0,
      cost: cleanCost,
      um: um || 'EA',
      usuario: usuario || 'system'
    }, fifoInfo);

    res.status(200).json({ 
      message: 'Partes registradas exitosamente con FIFO', 
      fifoResult: fifoResult 
    });
  } catch (error) {
    console.error('Error al registrar partes usadas:', error);
    res.status(500).json({ error: 'Error al registrar partes usadas', details: error.message });
  }
});

// Obtener partes por work_order_id
router.get('/:work_order_id', async (req, res) => {
  const { work_order_id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT * FROM work_order_parts WHERE work_order_id = ?',
      [work_order_id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No parts found for this work order' });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching parts' });
  }
});

module.exports = router;