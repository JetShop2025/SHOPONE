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
      let mechanics = [];
      try {
        mechanics = JSON.parse(order.mechanics || '[]');
      } catch (e) {
        mechanics = [];
      }
      return {
        ...order,
        parts,
        mechanics
      };
    });
    res.json(parsedResults);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR FETCHING WORK ORDERS');
  }
});

// --- CREAR ORDEN DE TRABAJO ---
router.post('/', async (req, res) => {
  try {
    const { billToCo, trailer, mechanic, date, description, parts, totalHrs, status, usuario, extraOptions } = req.body;

    // Validación y limpieza de partes
    const [inventory] = await db.query('SELECT sku FROM inventory');
    const inventorySkus = inventory.map(item => (item.sku || '').trim().toUpperCase());
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
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
    if (!date) return res.status(400).send('The date field is required');

    // --- CÁLCULO DE TOTALES ---
    const partsTotal = partsArr.reduce((sum, part) => sum + (Number(part.qty) * Number(part.cost)), 0);
    const laborTotal = Number(totalHrs) * 60 || 0;
    const subtotal = partsTotal + laborTotal;

    // Extras
    let extra5 = 0;
    let extraLabels = [];
    let extraArr = [];
    const extras = Array.isArray(extraOptions) ? extraOptions : [];
    extras.forEach(opt => {
      if (opt === '5') {
        extra5 += subtotal * 0.05; // Suma el 5% pero NO lo muestres en el PDF
      } else if (opt === '15shop') {
        extraLabels.push('15% Shop Miscellaneous');
        extraArr.push(subtotal * 0.15);
      } else if (opt === '15weld') {
        extraLabels.push('15% Welding Supplies');
        extraArr.push(subtotal * 0.15);
      }
    });
    const extrasSuppliesTotal = extraArr.reduce((a, b) => a + b, 0);

    // TOTAL FINAL
    let totalLabAndPartsFinal;
    if (
      req.body.totalLabAndParts !== undefined &&
      req.body.totalLabAndParts !== null &&
      req.body.totalLabAndParts !== '' &&
      !isNaN(Number(String(req.body.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      totalLabAndPartsFinal = Number(String(req.body.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      totalLabAndPartsFinal = subtotal + extra5 + extrasSuppliesTotal;
    }

    // --- INSERTA EN LA BASE DE DATOS ---
    const query = `
      INSERT INTO work_orders (billToCo, trailer, mechanic, mechanics, date, description, parts, totalHrs, totalLabAndParts, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const mechanicsArr = Array.isArray(req.body.mechanics) ? req.body.mechanics : [];
    const values = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrs, totalLabAndPartsFinal, status
    ];
    const [result] = await db.query(query, values);

    // --- GENERA EL PDF ---
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
    doc.fontSize(24).fillColor('#1976d2').font('Helvetica-Bold').text('INVOICE', { align: 'center' });

    doc.fontSize(10).fillColor('#333').text('JET SHOP, LLC.', 400, 40, { align: 'right' });
    doc.text('740 EL CAMINO REAL', { align: 'right' });
    doc.text('GREENFIELD, CA 93927', { align: 'right' });
    doc.moveDown(2);

    // Datos principales
    doc.roundedRect(40, 110, 250, 80, 8).stroke('#1976d2'); // Aumenta la altura del cuadro
    doc.roundedRect(320, 110, 230, 80, 8).stroke('#1976d2');
    doc.font('Helvetica-Bold').fillColor('#1976d2').fontSize(10);
    doc.text('Customer:', 50, 120);
    doc.text('Trailer:', 50, 140);
    doc.text('Mechanic:', 50, 160); // NUEVA LÍNEA
    doc.text('Date:', 330, 120);
    doc.text('Invoice #:', 330, 140);

    doc.font('Helvetica').fillColor('#222').fontSize(10);
    doc.text(billToCo || '-', 110, 120);
    doc.text(trailer || '-', 110, 140);
    doc.text(mechanic || '-', 110, 160);
    doc.text(formattedDate, 390, 120);
    doc.text(result?.insertId || id, 400, 140);

    const descText = description || '';

    // --- DESCRIPCIÓN BIEN COLOCADA ---
    let descY = 180;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1976d2');
    doc.text('Descripción:', 50, descY);
    doc.font('Helvetica').fontSize(11).fillColor('#222');
    const descHeight = doc.heightOfString(descText, { width: 500 });
    doc.text(descText, 50, descY + 16, { width: 500 });
    let tableTop = descY + 16 + descHeight + 10;

    // Centrar tabla en la hoja
    const tableWidth = 580; // Aumenta el ancho para una columna más
    const leftMargin = (595.28 - tableWidth) / 2;
    const col = [
      leftMargin,                // inicio tabla
      leftMargin + 40,           // No.
      leftMargin + 160,          // SKU
      leftMargin + 280,          // Description
      leftMargin + 330,          // Qty
      leftMargin + 400,          // Unit
      leftMargin + 480,          // Total
      leftMargin + 580           // Invoice Link (fin tabla)
    ];

    // Encabezado de tabla de partes
    doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
    doc.rect(col[0], tableTop, col[7] - col[0], 22).fillAndStroke('#e3f2fd', '#1976d2');
    doc.text('No.', col[0], tableTop + 6, { width: col[1] - col[0], align: 'center' });
    doc.text('SKU', col[1], tableTop + 6, { width: col[2] - col[1], align: 'center' });
    doc.text('Nombre', col[2], tableTop + 6, { width: col[3] - col[2], align: 'center' });
    doc.text('Qty', col[3], tableTop + 6, { width: col[4] - col[3], align: 'center' });
    doc.text('Unit', col[4], tableTop + 6, { width: col[5] - col[4], align: 'center' });
    doc.text('Total', col[5], tableTop + 6, { width: col[6] - col[5], align: 'center' });
    doc.text('Invoice Link', col[6], tableTop + 6, { width: col[7] - col[6], align: 'center' });

    let y = tableTop + 22;

    if (partsArr.length > 0) {
      partsArr.forEach((p, i) => {
        doc.rect(col[0], y, col[7] - col[0], 18).strokeColor('#e3f2fd').stroke();
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
        // Link clickeable
        if (p.invoiceLink) {
          doc.font('Courier').fillColor('#1976d2').text(
            'Ver Invoice',
            col[6], y + 4, { width: col[7] - col[6], align: 'center', underline: true }
          );
          // Calcula el ancho y alto del texto para el área clickeable
          const linkText = 'Ver Invoice';
          const textWidth = doc.widthOfString(linkText, { font: 'Courier', size: 10 });
          const textHeight = doc.currentLineHeight();
          // Centra el área del link en la celda
          const linkX = col[6] + ((col[7] - col[6]) - textWidth) / 2;
          doc.link(linkX, y + 4, textWidth, textHeight, p.invoiceLink);
        } else {
          doc.font('Courier').fillColor('#888').text(
            '', // vacío si no hay link
            col[6], y + 4, { width: col[7] - col[6], align: 'center' }
          );
        }
        y += 18;
      });
    }

    // Línea final de tabla
    doc.rect(col[0], y, col[7] - col[0], 0.5).fillAndStroke('#1976d2', '#1976d2');

    // Subtotales
    doc.text(
      ` ${partsTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[7] - col[0], align: 'right' }
    );
    y += 16;
    doc.text(
      `Labor: ${laborTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[7] - col[0], align: 'right' }
    );
    // SOLO muestra extras supplies (NO el 5%)
    extraLabels.forEach((label, idx) => {
      y += 16;
      doc.text(
        `${label}: ${extraArr[idx].toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        col[0], y, { width: col[7] - col[0], align: 'right' }
      );
    });
    // TOTAL FINAL
    y += 24;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#d32f2f').text(
      `TOTAL LAB & PARTS: ${totalLabAndPartsFinal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[7] - col[0], align: 'right' }
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

    // --- RESPUESTA ---
    stream.on('finish', async () => {
      await logAccion(usuario, 'CREATE', 'work_orders', result.insertId, JSON.stringify(req.body));
      res.status(201).json({
        message: 'WORK ORDER CREATED SUCCESSFULLY',
        id: result.insertId,
        pdfUrl: `/pdfs/${pdfName}`,
        totalLabAndParts: totalLabAndPartsFinal // <-- para mostrar en tabla
      });
    });
  } catch (err) {
    console.error('ERROR CREATING WORK ORDER:', err);
    res.status(500).send(err?.message || 'ERROR CREATING WORK ORDER');
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

// --- EDITAR ORDEN DE TRABAJO ---
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const {
    billToCo,
    trailer,
    mechanic,
    date,
    description,
    parts,
    totalHrs,
    status,
    extraOptions,
    usuario
  } = fields;

  try {
    // 1. Verifica que la orden exista
    const [oldResults] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    const oldData = oldResults[0];

    // 2. Limpia y valida partes
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => ({
            ...part,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, ''))
          }))
      : [];

    // 3. Calcula totales SIEMPRE
    const partsTotal = partsArr.reduce((sum, part) => sum + (Number(part.qty) * Number(part.cost)), 0);
    const laborTotal = Number(totalHrs) * 60 || 0;
    const subtotal = partsTotal + laborTotal;

    let extra5 = 0;
    let extraLabels = [];
    let extraArr = [];
    const extras = Array.isArray(extraOptions) ? extraOptions : [];
    extras.forEach(opt => {
      if (opt === '5') {
        extra5 += subtotal * 0.05; // Suma el 5% pero NO lo muestres en el PDF
      } else if (opt === '15shop') {
        extraLabels.push('15% Shop Miscellaneous');
        extraArr.push(subtotal * 0.15);
      } else if (opt === '15weld') {
        extraLabels.push('15% Welding Supplies');
        extraArr.push(subtotal * 0.15);
      }
    });
    const extrasSuppliesTotal = extraArr.reduce((a, b) => a + b, 0);

    // Al final del cálculo de totales, antes de guardar:
    let totalLabAndPartsFinal;
    if (
      fields.totalLabAndParts !== undefined &&
      fields.totalLabAndParts !== null &&
      fields.totalLabAndParts !== '' &&
      !isNaN(Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      totalLabAndPartsFinal = Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      totalLabAndPartsFinal = subtotal + extra5 + extrasSuppliesTotal;
    }

    // 4. Actualiza la orden en la base de datos
    const mechanicsArr = Array.isArray(fields.mechanics) ? fields.mechanics : [];
    await db.query(
      `UPDATE work_orders SET 
        billToCo = ?, trailer = ?, mechanic = ?, mechanics = ?, date = ?, description = ?, parts = ?, totalHrs = ?, totalLabAndParts = ?, status = ?
       WHERE id = ?`,
      [
        billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
        JSON.stringify(partsArr), totalHrs, totalLabAndPartsFinal, status, id
      ]
    );

    // 5. Genera el PDF actualizado
    // Formatea la fecha a MM-DD-YYYY
    const jsDate = new Date(date);
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
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 40, 30, { width: 120 });
      } catch (e) {
        console.error('Error al agregar logo:', e);
      }
    }

    doc.fontSize(24).fillColor('#1976d2').font('Helvetica-Bold').text('INVOICE', { align: 'center' });
    doc.fontSize(10).fillColor('#333').text('JET SHOP, LLC.', 400, 40, { align: 'right' });
    doc.text('740 EL CAMINO REAL', { align: 'right' });
    doc.text('GREENFIELD, CA 93927', { align: 'right' });
    doc.moveDown(2);

    // Datos principales
    doc.roundedRect(40, 110, 250, 80, 8).stroke('#1976d2');
    doc.roundedRect(320, 110, 230, 80, 8).stroke('#1976d2');
    doc.font('Helvetica-Bold').fillColor('#1976d2').fontSize(10);
    doc.text('Customer:', 50, 120);
    doc.text('Trailer:', 50, 140);
    doc.text('Mechanic:', 50, 160);
    doc.text('Date:', 330, 120);
    doc.text('Invoice #:', 330, 140);

    doc.font('Helvetica').fillColor('#222').fontSize(10);
    doc.text(billToCo || '-', 110, 120);
    doc.text(trailer || '-', 110, 140);
    doc.text(mechanic || '-', 110, 160);
    doc.text(formattedDate, 390, 120);
    doc.text(id, 400, 140);

    const descText = description || '';
    let descY = 180;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1976d2');
    doc.text('Descripción:', 50, descY);
    doc.font('Helvetica').fontSize(11).fillColor('#222');
    const descHeight = doc.heightOfString(descText, { width: 500 });
    doc.text(descText, 50, descY + 16, { width: 500 });
    let tableTop = descY + 16 + descHeight + 10;

    // Centrar tabla en la hoja
    const tableWidth = 580; // Aumenta el ancho para una columna más
    const leftMargin = (595.28 - tableWidth) / 2;
    const col = [
      leftMargin,                // inicio tabla
      leftMargin + 40,           // No.
      leftMargin + 160,          // SKU
      leftMargin + 280,          // Description
      leftMargin + 330,          // Qty
      leftMargin + 400,          // Unit
      leftMargin + 480,          // Total
      leftMargin + 580           // Invoice Link (fin tabla)
    ];

    // Encabezado de tabla de partes
    doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
    doc.rect(col[0], tableTop, col[7] - col[0], 22).fillAndStroke('#e3f2fd', '#1976d2');
    doc.text('No.', col[0], tableTop + 6, { width: col[1] - col[0], align: 'center' });
    doc.text('SKU', col[1], tableTop + 6, { width: col[2] - col[1], align: 'center' });
    doc.text('Nombre', col[2], tableTop + 6, { width: col[3] - col[2], align: 'center' });
    doc.text('Qty', col[3], tableTop + 6, { width: col[4] - col[3], align: 'center' });
    doc.text('Unit', col[4], tableTop + 6, { width: col[5] - col[4], align: 'center' });
    doc.text('Total', col[5], tableTop + 6, { width: col[6] - col[5], align: 'center' });
    doc.text('Invoice Link', col[6], tableTop + 6, { width: col[7] - col[6], align: 'center' });

    let y = tableTop + 22;
    if (partsArr.length > 0) {
      partsArr.forEach((p, i) => {
        doc.rect(col[0], y, col[7] - col[0], 18).strokeColor('#e3f2fd').stroke();
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
        // Link clickeable
        if (p.invoiceLink) {
          doc.font('Courier').fillColor('#1976d2').text(
            'Ver Invoice',
            col[6], y + 4, { width: col[7] - col[6], align: 'center', underline: true }
          );
          // Calcula el ancho y alto del texto para el área clickeable
          const linkText = 'Ver Invoice';
          const textWidth = doc.widthOfString(linkText, { font: 'Courier', size: 10 });
          const textHeight = doc.currentLineHeight();
          // Centra el área del link en la celda
          const linkX = col[6] + ((col[7] - col[6]) - textWidth) / 2;
          doc.link(linkX, y + 4, textWidth, textHeight, p.invoiceLink);
        } else {
          doc.font('Courier').fillColor('#888').text(
            '', // vacío si no hay link
            col[6], y + 4, { width: col[7] - col[6], align: 'center' }
          );
        }
        y += 18;
      });
    }

    doc.rect(col[0], y, col[7] - col[0], 0.5).fillAndStroke('#1976d2', '#1976d2');
    doc.text(
      `Subtotal Parts: ${partsTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[7] - col[0], align: 'right' }
    );
    y += 16;
    doc.text(
      `Labor: ${laborTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[7] - col[0], align: 'right' }
    );
    // SOLO muestra extras supplies (NO el 5%)
    extraLabels.forEach((label, idx) => {
      y += 16;
      doc.text(
        `${label}: ${extraArr[idx].toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        col[0], y, { width: col[7] - col[0], align: 'right' }
      );
    });
    // TOTAL FINAL
    y += 24;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#d32f2f').text(
      `TOTAL LAB & PARTS: ${totalLabAndPartsFinal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[7] - col[0], align: 'right' }
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
        pdfUrl: `/pdfs/${pdfName}`,
        totalLabAndParts: totalLabAndPartsFinal // <-- para mostrar en tabla
      });
    });
  } catch (err) {
    console.error('ERROR UPDATING WORK ORDER:', err);
    res.status(500).send(err?.message || 'ERROR UPDATING WORK ORDER');
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


