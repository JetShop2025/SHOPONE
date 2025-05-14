const express = require('express');
const db = require('../db');
const router = express.Router();

router.use(express.json());

// Obtener todas las trailas
router.get('/', (req, res) => {
  db.query('SELECT * FROM trailers', (err, results) => {
    if (err) return res.status(500).send('Error al obtener trailas');
    res.json(results);
  });
});

router.get('/:nombre/work-orders', (req, res) => {
  const { nombre } = req.params;
  db.query('SELECT COUNT(*) as total FROM work_orders WHERE trailer = ?', [nombre], (err, results) => {
    if (err) return res.status(500).send('Error');
    res.json(results[0]);
  });
});

// Actualizar estatus de una traila
router.put('/:nombre/estatus', (req, res) => {
  const { nombre } = req.params;
  const { estatus, password } = req.body;
  // Cambia '6214' por tu password real o valida contra usuarios
  if (password !== '6214') {
    return res.status(403).send('Password incorrecto');
  }
  db.query('UPDATE trailers SET estatus = ? WHERE nombre = ?', [estatus, nombre], err => {
    if (err) return res.status(500).send('Error al actualizar estatus');
    res.sendStatus(200);
  });
});

module.exports = router;