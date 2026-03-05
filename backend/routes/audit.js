const express = require('express');
const db = require('../db');
const router = express.Router();

// GET / - Obtener registros recientes de auditoría (para el dashboard)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const [logs] = await db.connection.execute(`
      SELECT id, usuario, accion, tabla, registro_id, detalles, fecha 
      FROM audit_log 
      ORDER BY fecha DESC 
      LIMIT ?
    `, [limit]);
    
    res.json({
      data: logs.map(log => ({
        _id: log.id,
        id: log.id,
        action: log.accion,
        module: log.tabla || 'System',
        user: log.usuario,
        username: log.usuario,
        timestamp: log.fecha,
        details: log.detalles,
        description: log.detalles,
      }))
    });
  } catch (err) {
    console.error('[AUDIT] Error fetching recent logs:', err);
    res.status(500).json({ error: 'Error fetching recent logs', details: err.message });
  }
});

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