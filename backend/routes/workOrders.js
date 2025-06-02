const express = require('express');
const db = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.use(express.json());

async function logAccion(usuario, accion, tabla, registro_id, detalles = '') {
  try {
    await db.query(
      'INSERT INTO audit_log (usuario, accion, tabla, registro_id, detalles) VALUES (?, ?, ?, ?, ?)',
      [usuario, accion, tabla, registro_id, detalles]
    );
  } catch (err) {
    console.error('Error al insertar en audit_log:', err);
  }
}

// Obtener todas las órdenes de trabajo
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM work_orders');
    const parsedResults = results.map(order => {
      let parts = [];
      try {
        parts = JSON.parse(order.parts || '[]');
      } catch (e) {
        parts = [];
      }
      return {
        ...order,
        parts
      };
    });
    res.json(parsedResults);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR FETCHING WORK ORDERS');
  }
});

// Agregar nueva orden de trabajo y generar PDF
router.post('/', async (req, res) => {
  console.log('REQ BODY:', req.body);
  const { billToCo, trailer, mechanic, date, description, parts, totalHrs, totalLabAndParts, status, usuario } = req.body;

  // --- VALIDACIÓN DE PARTES ---
  const [inventory] = await db.query('SELECT sku FROM inventory');
  const inventorySkus = inventory.map(item => (item.sku || '').trim().toUpperCase());
  // LIMPIA COSTO DE CADA PARTE AQUÍ Y FILTRA VACÍAS
  const partsArr = Array.isArray(parts)
    ? parts
        .filter(part => part.sku && String(part.sku).trim() !== '') // Solo partes con SKU
        .map(part => ({
          ...part,
          cost: Number(String(part.cost).replace(/[^0-9.]/g, ''))
        }))
    : [];
  for (const part of partsArr) {
    if (!inventorySkus.includes((part.sku || '').trim().toUpperCase())) {
      return res.status(400).send(`The part "${part.sku}" does not exist in inventory.`);
    }
  }
  // --- FIN VALIDACIÓN ---

  if (!date) {
    return res.status(400).send('The date field is required');
  }

  const query = `
    INSERT INTO work_orders (billToCo, trailer, mechanic, date, description, parts, totalHrs, totalLabAndParts, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    billToCo, trailer, mechanic, date, description,
    JSON.stringify(partsArr), // GUARDA EL ARRAY LIMPIO
    totalHrs, totalLabAndParts, status
  ];

  try {
    const [result] = await db.query(query, values);

    // Calcula partes y labor usando el array LIMPIO
    const partsTotal = partsArr.reduce((sum, part) => sum + (Number(part.qty) * Number(part.cost)), 0);
    const laborTotal = Number(fields.totalHrs) * 60 || 0;
    const subtotal = partsTotal + laborTotal;

    // Calcula extras
    let extra = 0;
    let extraLabels = [];
    let extraArr = [];
    const extras = Array.isArray(fields.extraOptions) ? fields.extraOptions : [];
    extras.forEach(opt => {
      if (opt === '5') {
        extra += subtotal * 0.05;
        extraLabels.push('5% Extra');
        extraArr.push(subtotal * 0.05);
      } else if (opt === '15shop') {
        extra += subtotal * 0.15;
        extraLabels.push('15% Shop Miscellaneous');
        extraArr.push(subtotal * 0.15);
      } else if (opt === '15weld') {
        extra += subtotal * 0.15;
        extraLabels.push('15% Welding Supplies');
        extraArr.push(subtotal * 0.15);
      }
    });

    // Formatea la fecha a MM-DD-YYYY
    const jsDate = new Date(date);
    const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jsDate.getDate()).padStart(2, '0');
    const yyyy = jsDate.getFullYear();
    const formattedDate = `${mm}-${dd}-${yyyy}`;

    // Genera el nombre del PDF como MM-DD-YYYY_ID.pdf
    const pdfName = `${formattedDate}_${result.insertId || Date.now()}.pdf`;
    const pdfPath = path.join(__dirname, '..', 'pdfs', pdfName);

    // Asegúrate de que la carpeta 'pdfs' exista
    if (!fs.existsSync(path.join(__dirname, '..', 'pdfs'))) {
      fs.mkdirSync(path.join(__dirname, '..', 'pdfs'));
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // LOGO y encabezado
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    console.log('Buscando logo en:', logoPath, 'Existe:', fs.existsSync(logoPath));
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 40, 30, { width: 120 });
        console.log('Logo agregado al PDF');
      } catch (e) {
        console.error('ERROR AL CARGAR LA ORDEN:', e);
      }
    }

    // TITULO CENTRADO
    doc.fontSize(24).fillColor('#1976d2').font('Helvetica-Bold').text('JET SHOP', { align: 'center' });
    doc.fontSize(12).fillColor('#333').font('Helvetica').text('INVOICE', { align: 'center' });

    doc.fontSize(10).fillColor('#333').text('JET SHOP, LLC.', 400, 40, { align: 'right' });
    doc.text('740 EL CAMINO REAL', { align: 'right' });
    doc.text('GREENFIELD, CA 93927', { align: 'right' });
    doc.moveDown(2);

    // Datos principales
    doc.roundedRect(40, 110, 250, 60, 8).stroke('#1976d2');
    doc.roundedRect(320, 110, 230, 60, 8).stroke('#1976d2');
    doc.font('Helvetica-Bold').fillColor('#1976d2').fontSize(10);
    doc.text('Customer:', 50, 120);
    doc.text('Trailer:', 50, 140);
    doc.text('Date:', 330, 120);
    doc.text('Invoice #:', 330, 140);

    doc.font('Helvetica').fillColor('#222').fontSize(10);
    doc.text(fields.billToCo || '-', 110, 120);
    doc.text(fields.trailer || '-', 110, 140);
    doc.text(formattedDate, 390, 120);
    doc.text(result.insertId || id, 400, 140);

    // --- AHORA AGREGA LA DESCRIPCIÓN DEBAJO DE LOS CUADROS ---
    let descY = 180; // Justo debajo de los cuadros (ajusta si es necesario)
    if (req.body.description) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1976d2').text('Descripción:', 50, descY, { continued: true });
      doc.font('Helvetica').fontSize(11).fillColor('#222').text(' ' + req.body.description, { align: 'left' });
      doc.moveDown(1);
    }

    // Centrar tabla en la hoja
    const tableWidth = 480;
    const leftMargin = (595.28 - tableWidth) / 2;
    const col = [
      leftMargin,                // inicio tabla
      leftMargin + 40,           // No.
      leftMargin + 160,          // SKU
      leftMargin + 280,          // Description
      leftMargin + 330,          // Qty
      leftMargin + 400,          // Unit
      leftMargin + 480           // Total (fin tabla)
    ];

    const tableTop = 190;

    // Encabezado de tabla de partes
    doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
    doc.rect(col[0], tableTop, col[6] - col[0], 22).fillAndStroke('#e3f2fd', '#1976d2');
    doc.text('No.', col[0], tableTop + 6, { width: col[1] - col[0], align: 'center' });
    doc.text('SKU', col[1], tableTop + 6, { width: col[2] - col[1], align: 'center' });
    doc.text('Nombre', col[2], tableTop + 6, { width: col[3] - col[2], align: 'center' });
    doc.text('Qty', col[3], tableTop + 6, { width: col[4] - col[3], align: 'center' });
    doc.text('Unit', col[4], tableTop + 6, { width: col[5] - col[4], align: 'center' });
    doc.text('Total', col[5], tableTop + 6, { width: col[6] - col[5], align: 'center' });

    let y = tableTop + 22;

    // SOLO dibuja filas si hay partes
    if (partsArr.length > 0) {
      partsArr.forEach((p, i) => {
        doc.rect(col[0], y, col[6] - col[0], 18).strokeColor('#e3f2fd').stroke();
        doc.font('Courier').fontSize(10).fillColor('#222');
        doc.text(i + 1, col[0], y + 4, { width: col[1] - col[0], align: 'center' });
        doc.text(p.sku || '-', col[1], y + 4, { width: col[2] - col[1], align: 'center' });
        doc.text(p.part || '-', col[2], y + 4, { width: col[3] - col[2], align: 'center' });
        doc.text(p.qty || '-', col[3], y + 4, { width: col[4] - col[3], align: 'center' });
        doc.text(
          p.cost !== undefined && p.cost !== null && !isNaN(Number(p.cost))
            ? Number(p.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : '$0.00',
          col[4], y + 4, { width: col[5] - col[4], align: 'center' }
        );
        doc.text(
          p.qty && p.cost && !isNaN(Number(p.qty)) && !isNaN(Number(p.cost))
            ? (Number(p.qty) * Number(p.cost)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : '$0.00',
          col[5], y + 4, { width: col[6] - col[5], align: 'center' }
        );
        y += 18;
      });
    }

    // Línea final de tabla
    doc.rect(col[0], y, col[6] - col[0], 0.5).fillAndStroke('#1976d2', '#1976d2');

    // TOTALES - Subtotal, Labor y Extras en línea completa
    y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1976d2');
    doc.text(
      `Subtotal Parts: ${partsTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[6] - col[0], align: 'right' }
    );

    y += 16;
    doc.text(
      `Labor: ${laborTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[6] - col[0], align: 'right' }
    );

    (extraLabels || []).forEach((label, idx) => {
      y += 16;
      doc.text(
        `${label}: ${extraArr[idx].toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        col[0], y, { width: col[6] - col[0], align: 'right' }
      );
    });

    // TOTAL LAB & PARTS destacado y separado
    y += 24;
    let totalLabAndPartsFinal = 0;
    if (req.body.totalLabAndParts !== undefined && req.body.totalLabAndParts !== null && req.body.totalLabAndParts !== '') {
      totalLabAndPartsFinal = Number(String(req.body.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      totalLabAndPartsFinal = partsTotal + laborTotal + extra;
    }
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#d32f2f').text(
      `TOTAL LAB & PARTS: ${totalLabAndPartsFinal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[6] - col[0], align: 'right' }
    );

    // TÉRMINOS Y FIRMAS
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#222').text('TERMS & CONDITIONS:', 40, doc.y);
    doc.font('Helvetica').fontSize(8).fillColor('#222').text('This estimate is not a final bill, pricing could change if job specifications change.', 40, doc.y + 12);

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(9).text('I accept this estimate without any changes ', 40, doc.y + 10);
    doc.text('I accept this estimate with the handwritten changes ', 40, doc.y + 24);

    doc.moveDown(2);
    doc.text('NAME: ____________________________    SIGNATURE: ____________________________', 40, doc.y + 10);
    doc.font('Helvetica-BoldOblique').fontSize(12).fillColor('#1976d2').text('Thanks for your business!', 40, doc.y + 30);

    doc.end();

    stream.on('finish', async () => {
      await logAccion(usuario, 'CREATE', 'work_orders', result.insertId, JSON.stringify(req.body));
      res.status(201).json({
        message: 'WORK ORDER CREATED SUCCESSFULLY',
        id: result.insertId,
        pdfUrl: `/pdfs/${pdfName}`
      });
    });
  } catch (err) {
    console.error('ERROR CREATING WORK ORDER:', err); // <-- Esto imprime el error real en consola
    res.status(500).send(err?.message || 'ERROR CREATING WORK ORDER'); // <-- Esto manda el mensaje real al frontend
  }
});

// Eliminar orden de trabajo por ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!results || results.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    const oldData = results[0];
    await db.query('DELETE FROM work_orders WHERE id = ?', [id]);
    await logAccion(
      usuario,
      'DELETE',
      'work_orders',
      id,
      JSON.stringify({
        id: oldData.id,
        customer: oldData.billToCo,
        trailer: oldData.trailer,
        date: oldData.date,
        description: oldData.description,
        parts: oldData.parts,
        mechanic: oldData.mechanic,
        status: oldData.status
      })
    );
    res.status(200).send('WORK ORDER DELETED SUCCESSFULLY');
  } catch (err) {
    res.status(500).send('ERROR DELETING WORK ORDER');
  }
});

// Actualizar orden de trabajo
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const { usuario } = req.body;

  try {
    const [oldResults] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    const oldData = oldResults[0];

    // LIMPIA COSTO DE CADA PARTE Y FILTRA VACÍAS
    const partsArr = Array.isArray(fields.parts)
      ? fields.parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => ({
            ...part,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, ''))
          }))
      : [];
    fields.parts = partsArr;

    await db.query(
      `UPDATE work_orders SET 
        billToCo = ?, trailer = ?, mechanic = ?, date = ?, description = ?, parts = ?, totalHrs = ?, totalLabAndParts = ?, status = ?
       WHERE id = ?`,
      [
        fields.billToCo, fields.trailer, fields.mechanic, fields.date, fields.description,
        JSON.stringify(fields.parts), fields.totalHrs, fields.totalLabAndParts, fields.status, id
      ]
    );

    // --- BLOQUE DE CÁLCULO DE TOTALES Y EXTRAS ---
    const partsTotal = partsArr.reduce((sum, part) => sum + (Number(part.qty) * Number(part.cost)), 0);
    const laborTotal = Number(fields.totalHrs) * 60 || 0;
    const subtotal = partsTotal + laborTotal;

    let extra = 0;
    let extraLabels = [];
    let extraArr = [];
    const extras = Array.isArray(fields.extraOptions) ? fields.extraOptions : [];
    extras.forEach(opt => {
      if (opt === '5') {
        extra += subtotal * 0.05;
        extraLabels.push('5% Extra');
        extraArr.push(subtotal * 0.05);
      } else if (opt === '15shop') {
        extra += subtotal * 0.15;
        extraLabels.push('15% Shop Miscellaneous');
        extraArr.push(subtotal * 0.15);
      } else if (opt === '15weld') {
        extra += subtotal * 0.15;
        extraLabels.push('15% Welding Supplies');
        extraArr.push(subtotal * 0.15);
      }
    });
    // --- FIN BLOQUE DE CÁLCULO ---

    // Después de actualizar la orden en el PUT:
    const jsDate = new Date(fields.date);
    const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jsDate.getDate()).padStart(2, '0');
    const yyyy = jsDate.getFullYear();
    const formattedDate = `${mm}-${dd}-${yyyy}`;
    const pdfName = `${formattedDate}_${id}.pdf`;
    const pdfPath = path.join(__dirname, '..', 'pdfs', pdfName);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // LOGO y encabezado
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    console.log('Buscando logo en:', logoPath, 'Existe:', fs.existsSync(logoPath));
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 40, 30, { width: 120 });
        console.log('Logo agregado al PDF');
      } catch (e) {
        console.error('Error al agregar logo:', e);
      }
    }

    // TITULO CENTRADO
    doc.fontSize(24).fillColor('#1976d2').font('Helvetica-Bold').text('JET SHOP', { align: 'center' });
    doc.fontSize(12).fillColor('#333').font('Helvetica').text('INVOICE', { align: 'center' });

    doc.fontSize(10).fillColor('#333').text('JET SHOP, LLC.', 400, 40, { align: 'right' });
    doc.text('740 EL CAMINO REAL', { align: 'right' });
    doc.text('GREENFIELD, CA 93927', { align: 'right' });
    doc.moveDown(2);

    // Datos principales
    doc.roundedRect(40, 110, 250, 60, 8).stroke('#1976d2');
    doc.roundedRect(320, 110, 230, 60, 8).stroke('#1976d2');
    doc.font('Helvetica-Bold').fillColor('#1976d2').fontSize(10);
    doc.text('Customer:', 50, 120);
    doc.text('Trailer:', 50, 140);
    doc.text('Date:', 330, 120);
    doc.text('Invoice #:', 330, 140);

    doc.font('Helvetica').fillColor('#222').fontSize(10);
    doc.text(fields.billToCo || '-', 110, 120);
    doc.text(fields.trailer || '-', 110, 140);
    doc.text(formattedDate, 390, 120);
    doc.text(id, 400, 140);

    // --- AHORA AGREGA LA DESCRIPCIÓN DEBAJO DE LOS CUADROS ---
    let descY = 180; // Justo debajo de los cuadros (ajusta si es necesario)
    if (req.body.description) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1976d2').text('Descripción:', 50, descY, { continued: true });
      doc.font('Helvetica').fontSize(11).fillColor('#222').text(' ' + req.body.description, { align: 'left' });
      doc.moveDown(1);
    }

    // Centrar tabla en la hoja
    const tableWidth = 480;
    const leftMargin = (595.28 - tableWidth) / 2;
    const col = [
      leftMargin,                // inicio tabla
      leftMargin + 40,           // No.
      leftMargin + 160,          // SKU
      leftMargin + 280,          // Description
      leftMargin + 330,          // Qty
      leftMargin + 400,          // Unit
      leftMargin + 480           // Total (fin tabla)
    ];

    const tableTop = 190;

    // Encabezado de tabla de partes
    doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
    doc.rect(col[0], tableTop, col[6] - col[0], 22).fillAndStroke('#e3f2fd', '#1976d2');
    doc.text('No.', col[0], tableTop + 6, { width: col[1] - col[0], align: 'center' });
    doc.text('SKU', col[1], tableTop + 6, { width: col[2] - col[1], align: 'center' });
    doc.text('Nombre', col[2], tableTop + 6, { width: col[3] - col[2], align: 'center' });
    doc.text('Qty', col[3], tableTop + 6, { width: col[4] - col[3], align: 'center' });
    doc.text('Unit', col[4], tableTop + 6, { width: col[5] - col[4], align: 'center' });
    doc.text('Total', col[5], tableTop + 6, { width: col[6] - col[5], align: 'center' });

    let y = tableTop + 22;

    // SOLO dibuja filas si hay partes
    if (partsArr.length > 0) {
      partsArr.forEach((p, i) => {
        doc.rect(col[0], y, col[6] - col[0], 18).strokeColor('#e3f2fd').stroke();
        doc.font('Courier').fontSize(10).fillColor('#222');
        doc.text(i + 1, col[0], y + 4, { width: col[1] - col[0], align: 'center' });
        doc.text(p.sku || '-', col[1], y + 4, { width: col[2] - col[1], align: 'center' });
        doc.text(p.part || '-', col[2], y + 4, { width: col[3] - col[2], align: 'center' });
        doc.text(p.qty || '-', col[3], y + 4, { width: col[4] - col[3], align: 'center' });
        doc.text(
          p.cost !== undefined && p.cost !== null && !isNaN(Number(p.cost))
            ? Number(p.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : '$0.00',
          col[4], y + 4, { width: col[5] - col[4], align: 'center' }
        );
        doc.text(
          p.qty && p.cost && !isNaN(Number(p.qty)) && !isNaN(Number(p.cost))
            ? (Number(p.qty) * Number(p.cost)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : '$0.00',
          col[5], y + 4, { width: col[6] - col[5], align: 'center' }
        );
        y += 18;
      });
    }

    // Línea final de tabla
    doc.rect(col[0], y, col[6] - col[0], 0.5).fillAndStroke('#1976d2', '#1976d2');

    // TOTALES - Subtotal, Labor y Extras en línea completa
    y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1976d2');
    doc.text(
      `Subtotal Parts: ${partsTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[6] - col[0], align: 'right' }
    );

    y += 16;
    doc.text(
      `Labor: ${laborTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[6] - col[0], align: 'right' }
    );

    (extraLabels || []).forEach((label, idx) => {
      y += 16;
      doc.text(
        `${label}: ${extraArr[idx].toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        col[0], y, { width: col[6] - col[0], align: 'right' }
      );
    });

    // TOTAL LAB & PARTS destacado y separado
    y += 24;
    let totalLabAndPartsFinal = 0;
    if (req.body.totalLabAndParts !== undefined && req.body.totalLabAndParts !== null && req.body.totalLabAndParts !== '') {
      totalLabAndPartsFinal = Number(String(req.body.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      totalLabAndPartsFinal = partsTotal + laborTotal + extra;
    }
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#d32f2f').text(
      `TOTAL LAB & PARTS: ${totalLabAndPartsFinal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[6] - col[0], align: 'right' }
    );

    // TÉRMINOS Y FIRMAS
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#222').text('TERMS & CONDITIONS:', 40, doc.y);
    doc.font('Helvetica').fontSize(8).fillColor('#222').text('This estimate is not a final bill, pricing could change if job specifications change.', 40, doc.y + 12);

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(9).text('I accept this estimate without any changes ', 40, doc.y + 10);
    doc.text('I accept this estimate with the handwritten changes ', 40, doc.y + 24);

    doc.moveDown(2);
    doc.text('NAME: ____________________________    SIGNATURE: ____________________________', 40, doc.y + 10);
    doc.font('Helvetica-BoldOblique').fontSize(12).fillColor('#1976d2').text('Thanks for your business!', 40, doc.y + 30);

    doc.end();

    stream.on('finish', async () => {
      await logAccion(usuario, 'UPDATE', 'work_orders', id, JSON.stringify({ before: oldData, after: fields }));
      res.status(200).json({
        message: 'WORK ORDER UPDATED SUCCESSFULLY',
        id,
        pdfUrl: `/pdfs/${pdfName}`
      });
    });
  } catch (err) {
    console.error('ERROR UPDATING WORK ORDER:', err); // <-- Esto imprime el error real en consola/logs de Render
    res.status(500).send(err?.message || 'ERROR UPDATING WORK ORDER'); // <-- Esto manda el mensaje real al frontend
  }
});

// Eliminar varias órdenes de trabajo por IDs
router.delete('/', async (req, res) => {
  const { ids, usuario } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).send('YOU MUST PROVIDE AN ARRAY OF IDs TO DELETE');
  }
  const placeholders = ids.map(() => '?').join(',');
  try {
    const [results] = await db.query(
      `SELECT * FROM work_orders WHERE id IN (${placeholders})`,
      ids
    );
    await db.query(
      `DELETE FROM work_orders WHERE id IN (${placeholders})`,
      ids
    );
    for (const id of ids) {
      const oldData = results.find(r => r.id == id);
      await logAccion(
        usuario,
        'DELETE',
        'work_orders',
        id,
        oldData
          ? JSON.stringify({
              id: oldData.id,
              customer: oldData.billToCo,
              trailer: oldData.trailer,
              date: oldData.date,
              description: oldData.description,
              parts: oldData.parts,
              mechanic: oldData.mechanic,
              status: oldData.status
            })
          : 'NO DATA FOUND'
      );
    }
    res.status(200).send(`DELETED ORDERS: ${ids.length}`);
  } catch (err) {
    res.status(500).send('ERROR DELETING WORK ORDERS');
  }
});

// Obtener logs de auditoría
router.get('/audit-log', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM audit_log ORDER BY fecha DESC');
    res.json(results);
  } catch (err) {
    res.status(500).send('Error fetching audit log');
  }
});

// Servir los PDFs generados
router.use('/pdfs', express.static(path.join(__dirname, '..', 'pdfs')));

module.exports = router;
