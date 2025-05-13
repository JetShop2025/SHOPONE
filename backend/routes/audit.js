const express = require('express');
const db = require('../db');
const router = express.Router();

// Obtener logs de auditoría
router.get('/audit-log', (req, res) => {
  db.query('SELECT * FROM audit_log ORDER BY fecha DESC', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error al obtener el log de auditoría');
    } else {
      res.json(results);
    }
  });
});

module.exports = router;