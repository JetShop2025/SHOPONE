const express = require('express');
const multer = require('multer');
const db = require('../db');
const { log } = require('console');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.use(express.json());

function logAccion(usuario, accion, tabla, registro_id, detalles = '') {
  db.query(
    'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles) VALUES (?, ?, ?, ?, ?)',
    [usuario, accion, tabla, registro_id, detalles],
    (err) => {
      if (err) {
        console.error('Error al insertar en audit_log:', err);
      } else {
        console.log('Registro de auditoría insertado correctamente');
      }
    }
  );
}

// Agregar parte al inventario (con imagen)
router.post('/', upload.single('imagen'), (req, res) => {
  const { sku, barCodes, category, part, provider, brand, um, area, usuario } = req.body;
  const cantidad = Number(req.body.cantidad) || 0;
  const imagen = req.file ? `/uploads/${req.file.filename}` : '';
  db.query(
    `INSERT INTO inventory (sku, barCodes, category, part, provider, brand, um, area, onHand, imagen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sku, barCodes, category, part, provider, brand, um, area, cantidad, imagen],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al agregar la parte');
      }
      res.sendStatus(200);
      logAccion(usuario, 'CREAR', 'inventory', sku, JSON.stringify(req.body));
    }
  );
});

// Descontar partes del inventario
router.post('/deduct', express.json(), (req, res) => {
  const { parts } = req.body;
  console.log('Partes recibidas para descontar:', parts); // <-- aquí
  let errorMsg = '';
  const checks = parts.map(part => {
    return new Promise((resolve, reject) => {
      if (part.sku && part.qty) {
        db.query(
          'SELECT onHand FROM inventory WHERE sku = ?',
          [part.sku],
          (err, results) => {
            if (err) return reject(err);
            if (results.length === 0) {
              errorMsg = `La parte "${part.sku}" no existe en inventario.`;
              return resolve(false);
            }
            if (results[0].onHand < Number(part.qty)) {
              errorMsg = `No hay suficiente inventario para la parte "${part.sku}".`;
              return resolve(false);
            }
            resolve(true);
          }
        );
      } else {
        resolve(true);
      }
    });
  });
  Promise.all(checks)
    .then(results => {
      if (results.includes(false)) {
        return res.status(400).json({ error: errorMsg });
      }
      parts.forEach(part => {
        if (part.sku && part.qty) {
          console.log('Descontando:', part.sku, 'Cantidad:', part.qty); // <-- aquí
          db.query(
            `UPDATE inventory 
             SET onHand = onHand - ?, salidasWo = salidasWo + ?
             WHERE sku = ?`,
            [Number(part.qty), Number(part.qty), part.sku]
          );
        }
        logAccion(req.body.usuario, 'DESCONTAR', 'inventory', part.sku, JSON.stringify(part));
      });
      res.sendStatus(200);
    })
    .catch(() => res.status(500).send('Error al validar inventario'));
});

// Obtener inventario
router.get('/', (req, res) => {
  db.query('SELECT * FROM inventory', (err, results) => {
    if (err) {
      res.status(500).send('Error al obtener el inventario');
    } else {
      res.json(results);
    }
  });
});

router.delete('/:sku', (req, res) => {
  const { sku } = req.params;
  const { usuario } = req.body;
  db.query('SELECT * FROM inventory WHERE sku = ?', [sku], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).send('Parte no encontrada');
    }
    const oldData = results[0];
    db.query('DELETE FROM inventory WHERE sku = ?', [sku], (err, result) => {
      if (err) {
        res.status(500).send('Error al eliminar la parte');
      } else {
        logAccion(
          usuario,
          'ELIMINAR',
          'inventory',
          sku,
          JSON.stringify({
            sku: oldData.sku,
            part: oldData.part,
            category: oldData.category,
            provider: oldData.provider,
            brand: oldData.brand,
            um: oldData.um,
            area: oldData.area,
            onHand: oldData.onHand,
            precio: oldData.precio
          })
        );
        res.status(200).send('Parte eliminada exitosamente');
      }
    });
  });
});

router.put('/:sku', upload.single('imagen'), (req, res) => {
  const { sku } = req.params;
  const fields = req.body;
  const { usuario } = req.body;
  let imagenPath = req.file ? `/uploads/${req.file.filename}` : (fields.imagen || '');

  // 1. Consulta el estado anterior
  db.query('SELECT * FROM inventory WHERE sku = ?', [sku], (err, oldResults) => {
    if (err || oldResults.length === 0) {
      return res.status(404).send('Parte no encontrada');
    }
    const oldData = oldResults[0];

    // 2. Realiza el update
    db.query(
      `UPDATE inventory SET 
        barCodes = ?, category = ?, part = ?, provider = ?, brand = ?, um = ?, area = ?, 
        receive = ?, salidasWo = ?, onHand = ?, precio = ?, imagen = ?
       WHERE sku = ?`,
      [
        fields.barCodes, fields.category, fields.part, fields.provider, fields.brand, fields.um, fields.area,
        fields.receive, fields.salidasWo, fields.onHand, fields.precio, imagenPath, sku
      ],
      (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send('Error al actualizar la parte');
        } else {
          res.status(200).send('Parte actualizada exitosamente');
          // 3. Guarda en detalles el antes y después
          const { usuario, ...rest } = req.body;
          logAccion(usuario, 'MODIFICAR', 'inventory', sku, JSON.stringify({ antes: oldData, despues: rest }));
        }
      }
    );
  });
});

module.exports = router;