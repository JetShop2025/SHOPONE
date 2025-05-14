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
router.put('/:nombre/estatus', async (req, res) => {
  const { nombre } = req.params;
  const { estatus, password, cliente, fechaRenta, fechaEntrega } = req.body;

  // Cambia '6214' por tu password real o valida contra usuarios
  if (password !== '6214') {
    return res.status(403).send('Password incorrecto');
  }

  // 1. Obtén los datos antes del cambio
  const [antes] = await db.query('SELECT * FROM trailers WHERE nombre = ?', [nombre]);

  // 2. Realiza el update
  await db.query(
    'UPDATE trailers SET estatus=?, cliente=?, fechaRenta=?, fechaEntrega=? WHERE nombre=?',
    [estatus, cliente, fechaRenta, fechaEntrega, nombre]
  );

  // 3. Obtén los datos después del cambio
  const [despues] = await db.query('SELECT * FROM trailers WHERE nombre = ?', [nombre]);

  // 4. Inserta en la auditoría
  await db.query(
    'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles, fecha) VALUES (?, ?, ?, ?, ?, NOW())',
    [
      req.user?.username || 'sistema', // o como obtengas el usuario
      'MODIFICAR',
      'trailers',
      nombre,
      JSON.stringify({ antes, despues }),
    ]
  );

  res.json({ ok: true });
});

module.exports = router;