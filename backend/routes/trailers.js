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
    // Solo devolver los campos ligeros y necesarios
    const [results] = await db.query(
      'SELECT id, trailer_nombre, cliente, fecha_renta, fecha_entrega, observaciones FROM trailer_rentals WHERE trailer_nombre = ? ORDER BY fecha_renta DESC LIMIT 100',
      [nombre]
    );
    res.json(results);
  } catch (err) {
    res.status(500).send('ERROR FETCHING RENTAL HISTORY');
  }
});

// Obtener historial de W.O. por tráiler
router.get('/:nombre/work-orders-historial', async (req, res) => {
  const { nombre } = req.params;
  try {
    const [results] = await db.query(
      'SELECT * FROM work_orders WHERE trailer = ? ORDER BY date DESC',
      [nombre]
    );
    // Procesar cada orden para sumar labor y partes, y priorizar el total manual si existe
    const safeResults = results.map(order => {
      // Calcular total de partes
      let partsTotal = 0;
      try {
        if (order.parts && Array.isArray(order.parts)) {
          partsTotal = order.parts.reduce((total, part) => {
            const qty = Number(part.qty);
            const cost = Number(part.cost);
            return total + ((isNaN(qty) ? 0 : qty) * (isNaN(cost) ? 0 : cost));
          }, 0);
        } else if (typeof order.parts === 'string') {
          // Si viene como string (JSON), intentar parsear
          const arr = JSON.parse(order.parts);
          if (Array.isArray(arr)) {
            partsTotal = arr.reduce((total, part) => {
              const qty = Number(part.qty);
              const cost = Number(part.cost);
              return total + ((isNaN(qty) ? 0 : qty) * (isNaN(cost) ? 0 : cost));
            }, 0);
          }
        }
      } catch (e) { partsTotal = 0; }

      // Calcular total de labor
      let laborTotal = 0;
      try {
        if (order.mechanics && Array.isArray(order.mechanics)) {
          laborTotal = order.mechanics.reduce((total, mech) => {
            const hrs = Number(mech.hrs);
            return total + (isNaN(hrs) ? 0 : hrs);
          }, 0) * 60; // $60/hora
        } else if (typeof order.mechanics === 'string') {
          const arr = JSON.parse(order.mechanics);
          if (Array.isArray(arr)) {
            laborTotal = arr.reduce((total, mech) => {
              const hrs = Number(mech.hrs);
              return total + (isNaN(hrs) ? 0 : hrs);
            }, 0) * 60;
          }
        }
      } catch (e) { laborTotal = 0; }

      // Calcular total automático
      const autoTotal = partsTotal + laborTotal;

      // Prioridad: si el usuario puso un total manual válido, respétalo SOLO si es mayor o igual que la suma de partes + labor
      let totalLabAndParts = order.totalLabAndParts;
      if (totalLabAndParts !== undefined && totalLabAndParts !== null && totalLabAndParts !== '' && !isNaN(Number(totalLabAndParts))) {
        totalLabAndParts = Number(totalLabAndParts);
        // Si el valor manual es menor que la suma de partes + labor, usa la suma real
        if (totalLabAndParts < (partsTotal + laborTotal)) {
          totalLabAndParts = partsTotal + laborTotal;
        }
      } else {
        totalLabAndParts = partsTotal + laborTotal;
      }

      return {
        ...order,
        partsTotal,
        laborTotal,
        totalLabAndParts
      };
    });
    res.json(safeResults);
  } catch (err) {
    res.status(500).send('ERROR FETCHING WORK ORDERS');
  }
});

// Actualizar estatus de una traila
router.put('/:nombre/estatus', async (req, res) => {
  const bodies = Array.isArray(req.body) ? req.body : [req.body];

  for (const body of bodies) {
    const { estatus, password, cliente, fechaRenta, fechaEntrega, usuario, observaciones } = body;
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

    // 2. Realiza el update principal de la traila
    await db.query(
      'UPDATE trailers SET estatus=?, cliente=?, fechaRenta=?, fechaEntrega=? WHERE nombre=?',
      [estatus, clienteFinal, fechaRentaFinal, fechaEntregaFinal, nombre]
    );

    // 3. Auditoría de cambios
    const [despuesArr] = await db.query('SELECT * FROM trailers WHERE nombre = ?', [nombre]);
    const despues = despuesArr[0];
    const cambios = {};
    ['estatus', 'cliente', 'fechaRenta', 'fechaEntrega'].forEach(key => {
      if ((antes[key] ?? null) !== (despues[key] ?? null)) {
        cambios[key] = { antes: antes[key], despues: despues[key] };
      }
    });
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

    // --- LÓGICA DE RENTAS ---
    // Al cambiar estatus a RENTADA: crear un nuevo registro de renta SOLO si no hay uno abierto
    if (estatus === 'RENTADA') {
      try {
        // Verifica si ya hay una renta activa (sin fecha_entrega)
        const [rentasActivas] = await db.query(
          'SELECT id FROM trailer_rentals WHERE trailer_nombre = ? AND fecha_entrega IS NULL',
          [nombre]
        );
        if (rentasActivas.length === 0) {
          // Validar fechaRentaFinal
          if (!fechaRentaFinal || isNaN(Date.parse(fechaRentaFinal))) {
            return res.status(400).json({ ok: false, error: 'fechaRenta inválida o vacía' });
          }
          await db.query(
            'INSERT INTO trailer_rentals (trailer_nombre, cliente, fecha_renta, observaciones) VALUES (?, ?, ?, ?)',
            [nombre, clienteFinal, fechaRentaFinal, observaciones || '']
          );
        }
        res.json({ ok: true });
      } catch (err) {
        console.error('ERROR AL RENTAR TRAILA:', err);
        res.status(500).json({ ok: false, error: 'Error al rentar traila', details: err.message });
      }
      return;
    }

    // Al cambiar estatus a DISPONIBLE: actualizar el último registro de renta activo (no crear uno nuevo)
    if (estatus === 'DISPONIBLE') {
      await db.query(
        `UPDATE trailer_rentals
         SET fecha_entrega = ?, cliente = ?, observaciones = ?
         WHERE trailer_nombre = ? AND fecha_entrega IS NULL
         ORDER BY fecha_renta DESC
         LIMIT 1`,
        [fechaEntregaFinal, clienteFinal, observaciones || '', nombre]
      );
      res.json({ ok: true });
      return;
    }
  }

  res.json({ ok: true });
});

module.exports = router;