const express = require('express');
const router = express.Router();
const db = require('../db');

router.use(express.json());

router.post('/', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login recibido:', username, password);
  try {
    const [results] = await db.query(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, password]
    );
    if (results.length > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error('Error en consulta SQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;