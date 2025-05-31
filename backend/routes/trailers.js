const express = require('express');
const db = require('../db');
const router = express.Router();

router.use(express.json());

// Obtener todas las trailas
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM trailers');
    res.json(results);
  } catch (err) {
    res.status(500).send('ERROR');
  }
});

router.get('/:nombre/work-orders', async (req, res) => {
  const { nombre } = req.params;
  try {
    const [results] = await db.query('SELECT COUNT(*) as total FROM work_orders WHERE trailer = ?', [nombre]);
    res.json(results[0]);
  } catch (err) {
    res.status(500).send('ERROR');
  }
});

router.get('/:nombre/historial-rentas', async (req, res) => {
  const { nombre } = req.params;
  try {
    const [results] = await db.query(
      'SELECT * FROM trailer_rentals WHERE trailer_nombre = ? ORDER BY fecha_registro DESC',
      [nombre]
    );
    res.json(results);
  } catch (err) {
    res.status(500).send('ERROR FETCHING RENTAL HISTORY');
  }
});

// Actualizar estatus de una traila
router.put('/:nombre/estatus', async (req, res) => {
  const bodies = Array.isArray(req.body) ? req.body : [req.body];

  for (const body of bodies) {
    const { estatus, password, cliente, fechaRenta, fechaEntrega, usuario } = body;
    const { nombre } = req.params;

    // Cambia '6214' por tu password real o valida contra usuarios
    if (password !== '6214') {
      return res.status(403).send('INCORRECT PASSWORD');
    }

    // 1. Obtén los datos antes del cambio
    const [antesArr] = await db.query('SELECT * FROM trailers WHERE nombre = ?', [nombre]);
    const antes = antesArr[0];

    // Usa los datos actuales si no vienen en el body
    const clienteFinal = (cliente !== undefined && cliente !== '') ? cliente : antes.cliente;
    const fechaRentaFinal = (fechaRenta !== undefined && fechaRenta !== '') ? fechaRenta : antes.fechaRenta;
    const fechaEntregaFinal = (fechaEntrega !== undefined && fechaEntrega !== '') ? fechaEntrega : antes.fechaEntrega;

    // 2. Realiza el update
    await db.query(
      'UPDATE trailers SET estatus=?, cliente=?, fechaRenta=?, fechaEntrega=? WHERE nombre=?',
      [estatus, clienteFinal, fechaRentaFinal, fechaEntregaFinal, nombre]
    );
    
    // 4. Obtén los datos después del cambio
    const [despuesArr] = await db.query('SELECT * FROM trailers WHERE nombre = ?', [nombre]);
    const despues = despuesArr[0];

    // 5. Detecta solo los campos que cambiaron
    const cambios = {};
    ['estatus', 'cliente', 'fechaRenta', 'fechaEntrega'].forEach(key => {
      if ((antes[key] ?? null) !== (despues[key] ?? null)) {
        cambios[key] = { antes: antes[key], despues: despues[key] };
      }
    });

    // 6. Inserta en la auditoría solo si hubo cambios
    if (Object.keys(cambios).length > 0) {
      await db.query(
        'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles, fecha) VALUES (?, ?, ?, ?, ?, NOW())',
        [
          usuario || 'system',
          'UPDATE',
          'trailers',
          nombre,
          JSON.stringify(cambios)
        ]
      );
    }

    // Al cambiar estatus a DISPONIBLE
    if (estatus === 'DISPONIBLE') {
      // Actualiza la fecha de entrega de la última renta activa
      await db.query(
        `UPDATE trailer_rentals
         SET fecha_entrega = ?
         WHERE trailer_nombre = ? AND fecha_entrega IS NULL
         ORDER BY fecha_renta DESC
         LIMIT 1`,
        [fechaEntregaFinal, nombre]
      );
      // Actualiza el estatus de la traila
      await db.query(
        `UPDATE trailers SET estatus = ?, fechaEntrega = ? WHERE nombre = ?`,
        [estatus, fechaEntregaFinal, nombre]
      );
      res.json({ ok: true });
      return;
    }

    // Al cambiar estatus a RENTADA
    if (estatus === 'RENTADA') {
      // Crea un nuevo registro en historial de rentas
      await db.query(
        `INSERT INTO trailer_rentals (trailer_nombre, cliente, fecha_renta, fecha_entrega)
         VALUES (?, ?, ?, ?)`,
        [nombre, clienteFinal, fechaRentaFinal, fechaEntregaFinal]
      );
      // Actualiza el estatus de la traila
      await db.query(
        `UPDATE trailers SET estatus = ?, cliente = ?, fechaRenta = ?, fechaEntrega = ? WHERE nombre = ?`,
        [estatus, clienteFinal, fechaRentaFinal, fechaEntregaFinal, nombre]
      );
      res.json({ ok: true });
      return;
    }
  }

  res.json({ ok: true });
});

module.exports = router;