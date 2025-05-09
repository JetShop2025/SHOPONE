const express = require('express');
const router = express.Router();
const db = require('../db');

router.use(express.json());

router.post('/', (req, res) => {
  const { username, password } = req.body;
  console.log('Login recibido:', username, password);
  db.query(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [username, password],
    (err, results) => {
      if (err) return res.status(500).json({ success: false });
      if (results.length > 0) {
        res.json({ success: true });
      } else {
        res.json({ success: false });
      }
    }
  );
});

module.exports = router;