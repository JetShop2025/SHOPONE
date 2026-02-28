const express = require('express');
const db = require('../db');
const router = express.Router();

// Obtener logs de auditoría con filtros opcionales
router.get('/audit-log', async (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0, 
      usuario, 
      accion, 
      tabla, 
      fechaDesde, 
      fechaHasta 
    } = req.query;
    
    const filters = {};
    if (usuario) filters.usuario = usuario;
    if (accion) filters.accion = accion;
    if (tabla) filters.tabla = tabla;
    if (fechaDesde) filters.fechaDesde = fechaDesde;
    if (fechaHasta) filters.fechaHasta = fechaHasta;
    
    const results = await db.getAuditLogs(parseInt(limit), parseInt(offset), filters);
    res.json(results);
  } catch (err) {
    console.error('[AUDIT] Error fetching audit logs:', err);
    res.status(500).json({ error: 'Error fetching audit log', details: err.message });
  }
});

// Obtener estadísticas de auditoría
router.get('/stats', async (req, res) => {
  try {
    const [actionStats] = await db.connection.execute(`
      SELECT accion, COUNT(*) as total 
      FROM audit_log 
      WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY accion 
      ORDER BY total DESC
    `);
    
    const [userStats] = await db.connection.execute(`
      SELECT usuario, COUNT(*) as total 
      FROM audit_log 
      WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY usuario 
      ORDER BY total DESC
      LIMIT 10
    `);
    
    const [tableStats] = await db.connection.execute(`
      SELECT tabla, COUNT(*) as total 
      FROM audit_log 
      WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY tabla 
      ORDER BY total DESC
    `);
    
    res.json({
      actionStats,
      userStats,
      tableStats
    });
  } catch (err) {
    console.error('[AUDIT] Error fetching audit stats:', err);
    res.status(500).json({ error: 'Error fetching audit statistics', details: err.message });
  }
});

module.exports = router;