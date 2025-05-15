const express = require('express');
const db = require('../db');
const router = express.Router();

// Obtener logs de auditoría
router.get('/audit-log', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM audit_log ORDER BY fecha DESC');
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener el log de auditoría');
  }
});

module.exports = router;