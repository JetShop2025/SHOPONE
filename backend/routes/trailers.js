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

    // 3. Guarda en historial de rentas si cambia a RENTADA o DISPONIBLE
    if (estatus === 'RENTADA' || estatus === 'DISPONIBLE') {
      const [rentalResult] = await db.query(
        'INSERT INTO trailer_rentals (trailer_nombre, cliente, fecha_renta, fecha_entrega, usuario, accion) VALUES (?, ?, ?, ?, ?, ?)',
        [
          nombre,
          clienteFinal,
          fechaRentaFinal,
          fechaEntregaFinal,
          usuario || 'system',
          estatus === 'RENTADA' ? 'RENT' : 'RETURN'
        ]
      );

      // AUDIT LOG FOR RENTALS
      await db.query(
        'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles, fecha) VALUES (?, ?, ?, ?, ?, NOW())',
        [
          usuario || 'system',
          estatus === 'RENTADA' ? 'RENT' : 'RETURN',
          'trailer_rentals',
          rentalResult.insertId,
          JSON.stringify({
            trailer_nombre: nombre,
            cliente: clienteFinal,
            fecha_renta: fechaRentaFinal,
            fecha_entrega: fechaEntregaFinal,
            accion: estatus === 'RENTADA' ? 'RENT' : 'RETURN'
          })
        ]
      );
    }

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
  }

  res.json({ ok: true });
});

module.exports = router;