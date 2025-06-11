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
    const [inventory] = await db.query('SELECT sku, um FROM inventory');
    const inventoryMap = {};
    const inventorySkus = new Set();
    inventory.forEach(item => {
      inventoryMap[(item.sku || '').trim().toUpperCase()] = item.um || '-';
      inventorySkus.add((item.sku || '').trim().toUpperCase());
    });

    // Al limpiar y mapear las partes:
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => {
            const sku = (part.sku || '').trim().toUpperCase();
            // Busca el costo en inventario si no viene o viene mal del frontend
            let cost = Number(String(part.cost).replace(/[^0-9.]/g, ''));
            if (!cost || isNaN(cost)) {
              // Busca el costo en inventario
              const invItem = inventory.find(item => (item.sku || '').trim().toUpperCase() === sku);
              cost = invItem ? Number(invItem.precio) : 0;
            }
            return {
              ...part,
              cost,
              um: part.um || inventoryMap[sku] || '-'
            };
          })
      : [];
    for (const part of partsArr) {
      if (!inventorySkus.has((part.sku || '').trim().toUpperCase())) {
        return res.status(400).send(`The part "${part.sku}" does not exist in inventory.`);
      }
    }
    if (!date) return res.status(400).send('The date field is required');

    // --- CÁLCULO DE TOTALES ---
    // Suma las horas de todos los mecánicos (array mechanics)
    let totalHrsPost = 0;
    if (Array.isArray(req.body.mechanics) && req.body.mechanics.length > 0) {
      totalHrsPost = req.body.mechanics.reduce((sum, m) => sum + (parseFloat(m.hrs) || 0), 0);
    } else if (req.body.totalHrs) {
      totalHrsPost = parseFloat(req.body.totalHrs) || 0;
    }

    // Calcula labor
    const laborTotal = totalHrsPost * 60;

    // Suma partes
    const partsArrCalc = Array.isArray(parts) ? parts : [];
    const partsTotal = partsArrCalc.reduce((sum, part) => {
      const cost = Number(String(part.cost).replace(/[^0-9.]/g, ''));
      const qty = Number(part.qty) || 0;
      return sum + (qty * cost);
    }, 0);

    // Subtotal
    const subtotal = partsTotal + laborTotal;

    // Extras
    let extra = 0;
    (Array.isArray(extraOptions) ? extraOptions : []).forEach(opt => {
      if (opt === '5') extra += subtotal * 0.05;
      if (opt === '15shop') extra += subtotal * 0.15;
      if (opt === '15weld') extra += subtotal * 0.15;
    });

    // === AGREGA ESTA LÓGICA ===
    let totalLabAndPartsFinal;
    if (
      req.body.totalLabAndParts !== undefined &&
      req.body.totalLabAndParts !== null &&
      req.body.totalLabAndParts !== '' &&
      !isNaN(Number(String(req.body.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      totalLabAndPartsFinal = Number(String(req.body.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      totalLabAndPartsFinal = subtotal + extra;
    }
    // ==========================

    // --- AGREGA ESTO ANTES DE GENERAR EL PDF ---
    let extraLabels = [];
    let extraArr = [];
    (Array.isArray(extraOptions) ? extraOptions : []).forEach(opt => {
      if (opt === '15shop') {
        extraLabels.push('15% Shop Miscellaneous');
        extraArr.push(subtotal * 0.15);
      } else if (opt === '15weld') {
        extraLabels.push('15% Welding Supplies');
        extraArr.push(subtotal * 0.15);
      }
    });
    // --------------------------------------------

    // --- INSERTA EN LA BASE DE DATOS ---
    const query = `
      INSERT INTO work_orders (billToCo, trailer, mechanic, mechanics, date, description, parts, totalHrs, totalLabAndParts, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const mechanicsArr = Array.isArray(req.body.mechanics) ? req.body.mechanics : [];
    const values = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrsPost, totalLabAndPartsFinal, status
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
    doc.font('Courier-Bold').fontSize(24).fillColor('#1976d2').text('INVOICE', { align: 'center' });

    doc.font('Courier').fontSize(10).fillColor('#333').text('JET SHOP, LLC.', 400, 40, { align: 'right' });
    doc.text('740 EL CAMINO REAL', { align: 'right' });
    doc.text('GREENFIELD, CA 93927', { align: 'right' });
    doc.moveDown(2);

    // Datos principales
    doc.roundedRect(40, 110, 250, 80, 8).stroke('#1976d2');
    doc.roundedRect(320, 110, 230, 80, 8).stroke('#1976d2');
    doc.font('Courier-Bold').fillColor('#1976d2').fontSize(10);
    doc.text('Customer:', 50, 120);
    doc.text('Trailer:', 50, 140);
    doc.text('Mechanic:', 50, 160);
    doc.text('Date:', 330, 120);
    doc.text('Invoice #:', 330, 140);

    doc.font('Courier').fillColor('#222').fontSize(10);
    doc.text(billToCo || '-', 110, 120);
    doc.text(trailer || '-', 110, 140);
    // Determina el nombre del/los mecánico(s) y sus horas
    let mechanicToShow = mechanic;
    if (
      Array.isArray(mechanicsArr) &&
      mechanicsArr.length > 0 &&
      mechanicsArr.some(m => (m.name || m.mechanic))
    ) {
      mechanicToShow = mechanicsArr
        .map(m => {
          const name = m.name || m.mechanic || '-';
          const hrs = m.hrs !== undefined && m.hrs !== null && m.hrs !== '' ? `(${m.hrs})` : '';
          return `${name} ${hrs}`.trim();
        })
        .join(', ');
    }
    doc.text(mechanicToShow || '-', 110, 160);
    doc.text(formattedDate, 390, 120);
    doc.text(result?.insertId || id, 400, 140);

    // Descripción
    const descText = description || '';
    let descY = 200;
    doc.moveTo(40, descY).lineTo(570, descY).stroke('#1976d2');
    descY += 10;
    doc.font('Courier-Bold').fontSize(11).fillColor('#1976d2');
    doc.text('Description:', 50, descY);
    doc.font('Courier').fontSize(11).fillColor('#222');
    const descHeight = doc.heightOfString(descText, { width: 500 });
    doc.text(descText, 50, descY + 16, { width: 500 });
    let tableTop = descY + 16 + descHeight + 10;

    // Centrar tabla en la hoja
    // Reduce el ancho de la tabla y ajusta columnas
    const tableWidth = 520; // Antes era 620
    const leftMargin = (595.28 - tableWidth) / 2;
    // Define columnas
    const col = [
      leftMargin,                // Start
      leftMargin + 37,           // No.
      leftMargin + 105,          // SKU
      leftMargin + 225,          // DESCRIPTION
      leftMargin + 275,          // U/M
      leftMargin + 320,          // QTY
      leftMargin + 370,          // UNIT COST
      leftMargin + 450,          // TOTAL
      leftMargin + 520           // INVOICE
    ];

    // Encabezado de tabla
    doc.save();
    doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
    doc.rect(col[0], tableTop, col[8] - col[0], 22).fillAndStroke('#e3f2fd', '#1976d2');
    doc.fillColor('#1976d2');
    doc.text('No.', col[0], tableTop + 6, { width: col[1] - col[0], align: 'center' });
    doc.text('SKU', col[1], tableTop + 6, { width: col[2] - col[1], align: 'center' });
    doc.text('DESCRIPTION', col[2], tableTop + 6, { width: col[3] - col[2], align: 'center' });
    doc.text('U/M', col[3], tableTop + 6, { width: col[4] - col[3], align: 'center' });
    doc.text('QTY', col[4], tableTop + 6, { width: col[5] - col[4], align: 'center' });
    doc.text('UNIT COST', col[5], tableTop + 6, { width: col[6] - col[5], align: 'center' });
    doc.text('TOTAL', col[6], tableTop + 6, { width: col[7] - col[6], align: 'center' });
    doc.text('INVOICE', col[7], tableTop + 6, { width: col[8] - col[7], align: 'center' });
    doc.restore();

    let y = tableTop + 22;

    if (partsArr.length > 0) {
      partsArr.forEach((p, i) => {
        doc.rect(col[0], y, col[8] - col[0], 18).strokeColor('#e3f2fd').stroke();
        doc.font('Courier').fontSize(10).fillColor('#222');
        doc.text(i + 1, col[0], y + 4, { width: col[1] - col[0], align: 'center' });
        doc.text(p.sku || '-', col[1], y + 4, { width: col[2] - col[1], align: 'center' });
        doc.text(p.part || '-', col[2], y + 4, { width: col[3] - col[2], align: 'center' });
        doc.text(p.um || '-', col[3], y + 4, { width: col[4] - col[3], align: 'center' });
        doc.text(p.qty || '-', col[4], y + 4, { width: col[5] - col[4], align: 'center' }); // QTY
        doc.text(
          p.cost !== undefined && p.cost !== null && !isNaN(Number(p.cost))
            ? Number(p.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : '$0.00',
          col[5], y + 4, { width: col[6] - col[5], align: 'center' }
        );
        doc.text(
          p.qty && p.cost && !isNaN(Number(p.qty)) && !isNaN(Number(p.cost))
            ? (Number(p.qty) * Number(p.cost)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : '$0.00',
          col[6], y + 4, { width: col[7] - col[6], align: 'center' }
        );
        // INVOICE LINK O NÚMERO
        if (p.invoiceLink) {
          const invoiceNumber = p.invoiceNumber || '';
          doc.font('Courier').fillColor('#1976d2').text(
            invoiceNumber ? invoiceNumber : 'Ver Invoice',
            col[7], y + 4, { width: col[8] - col[7], align: 'center', underline: true }
          );
          const linkText = invoiceNumber ? invoiceNumber : 'Ver Invoice';
          const textWidth = doc.widthOfString(linkText, { font: 'Courier', size: 10 });
          const textHeight = doc.currentLineHeight();
          const linkX = col[7] + ((col[8] - col[7]) - textWidth) / 2;
          doc.link(linkX, y + 4, textWidth, textHeight, p.invoiceLink);
        } else {
          doc.font('Courier').fillColor('#888').text(
            '', col[7], y + 4, { width: col[8] - col[7], align: 'center' }
          );
        }
        y += 18;
      });
    }

    // Línea final de tabla
    doc.rect(col[0], y, col[8] - col[0], 0.5).fillAndStroke('#1976d2', '#1976d2');
    y += 10;
    doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
    doc.text(
      `Subtotal Parts: ${partsTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[8] - col[0], align: 'right' }
    );
    y += 16;
    doc.text(
      `Labor: ${laborTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[8] - col[0], align: 'right' }
    );
    extraLabels.forEach((label, idx) => {
      y += 16;
      doc.text(
        `${label}: ${extraArr[idx].toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        col[0], y, { width: col[8] - col[0], align: 'right' }
      );
    });
    y += 24;
    doc.font('Courier-Bold').fontSize(13).fillColor('#d32f2f').text(
      `TOTAL LAB & PARTS: ${totalLabAndPartsFinal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[8] - col[0], align: 'right' }
    );

    // Términos y firmas en inglés y Courier
    doc.moveDown(2);
    doc.font('Courier-Bold').fontSize(9).fillColor('#222').text('TERMS & CONDITIONS:', 40, doc.y);
    doc.font('Courier').fontSize(8).fillColor('#222').text('This estimate is not a final bill, pricing could change if job specifications change.', 40, doc.y + 12);

    doc.moveDown(2);
    doc.font('Courier').fontSize(9).text('I accept this estimate without any changes ', 40, doc.y + 10);
    doc.text('I accept this estimate with the handwritten changes ', 40, doc.y + 24);

    doc.moveDown(2);
    doc.text('NAME: ____________________________    SIGNATURE: ____________________________', 40, doc.y + 10);
    doc.font('Courier-BoldOblique').fontSize(12).fillColor('#1976d2').text('Thanks for your business!', 40, doc.y + 30);

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

    // --- AGREGA ESTO ---
    // Carga inventario y arma el mapa SKU->UM
    const [inventory] = await db.query('SELECT sku, um FROM inventory');
    const inventoryMap = {};
    inventory.forEach(item => {
      inventoryMap[(item.sku || '').trim().toUpperCase()] = item.um || '-';
    });
    // -------------------

    // 2. Limpia y valida partes
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => {
            const sku = (part.sku || '').trim().toUpperCase();
            // Busca el costo en inventario si no viene o viene mal del frontend
            let cost = Number(String(part.cost).replace(/[^0-9.]/g, ''));
            if (!cost || isNaN(cost)) {
              // Busca el costo en inventario
              const invItem = inventory.find(item => (item.sku || '').trim().toUpperCase() === sku);
              cost = invItem ? Number(invItem.precio) : 0;
            }
            return {
              ...part,
              cost,
              um: part.um || inventoryMap[sku] || '-'
            };
          })
      : [];

    // 3. Calcula totales SIEMPRE
    let totalHrsPut = 0;
    if (Array.isArray(fields.mechanics) && fields.mechanics.length > 0) {
      totalHrsPut = fields.mechanics.reduce((sum, m) => sum + (parseFloat(m.hrs) || 0), 0);
    } else if (fields.totalHrs) {
      totalHrsPut = parseFloat(fields.totalHrs) || 0;
    }
    const laborTotal = totalHrsPut * 60;
    const partsTotal = partsArr.reduce((sum, part) => {
      const cost = Number(part.cost) || 0;
      const qty = Number(part.qty) || 0;
      return sum + (qty * cost);
    }, 0); // <-- ¡Asegúrate de multiplicar qty * cost!
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
        JSON.stringify(partsArr), totalHrsPut, totalLabAndPartsFinal, status, id
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

    doc.font('Courier-Bold').fontSize(24).fillColor('#1976d2').text('INVOICE', { align: 'center' });
    doc.font('Courier').fontSize(10).fillColor('#333').text('JET SHOP, LLC.', 400, 40, { align: 'right' });
    doc.text('740 EL CAMINO REAL', { align: 'right' });
    doc.text('GREENFIELD, CA 93927', { align: 'right' });
    doc.moveDown(2);

    // Datos principales
    doc.roundedRect(40, 110, 250, 80, 8).stroke('#1976d2');
    doc.roundedRect(320, 110, 230, 80, 8).stroke('#1976d2');
    doc.font('Courier-Bold').fillColor('#1976d2').fontSize(10);
    doc.text('Customer:', 50, 120);
    doc.text('Trailer:', 50, 140);
    doc.text('Mechanic:', 50, 160);
    doc.text('Date:', 330, 120);
    doc.text('Invoice #:', 330, 140);

    doc.font('Courier').fillColor('#222').fontSize(10);
    doc.text(billToCo || '-', 110, 120);
    doc.text(trailer || '-', 110, 140);
    // Determina el nombre del/los mecánico(s) y sus horas
    let mechanicToShow = mechanic;
    if (
      Array.isArray(mechanicsArr) &&
      mechanicsArr.length > 0 &&
      mechanicsArr.some(m => (m.name || m.mechanic))
    ) {
      mechanicToShow = mechanicsArr
        .map(m => {
          const name = m.name || m.mechanic || '-';
          const hrs = m.hrs !== undefined && m.hrs !== null && m.hrs !== '' ? `(${m.hrs})` : '';
          return `${name} ${hrs}`.trim();
        })
        .join(', ');
    }
    doc.text(mechanicToShow || '-', 110, 160);
    doc.text(formattedDate, 390, 120);
    doc.text(id, 400, 140);

    const descText = description || '';

    // --- DESCRIPCIÓN BIEN COLOCADA ---
    let descY = 200; // Ajusta según tu diseño
    doc.moveTo(40, descY).lineTo(570, descY).stroke('#1976d2'); // Línea horizontal

    descY += 10;
    doc.font('Courier-Bold').fontSize(11).fillColor('#1976d2');
    doc.text('Description:', 50, descY);
    doc.font('Courier').fontSize(11).fillColor('#222');
    const descHeight = doc.heightOfString(descText, { width: 500 });
    doc.text(descText, 50, descY + 16, { width: 500 });
    let tableTop = descY + 16 + descHeight + 10;

    // Centrar tabla en la hoja
    // Reduce el ancho de la tabla y ajusta columnas
    const tableWidth = 520; // Antes era 620
    const leftMargin = (595.28 - tableWidth) / 2;
    // Define columnas
    const col = [
      leftMargin,                // Start
      leftMargin + 37,           // No.
      leftMargin + 105,          // SKU
      leftMargin + 225,          // DESCRIPTION
      leftMargin + 275,          // U/M
      leftMargin + 320,          // QTY
      leftMargin + 370,          // UNIT COST
      leftMargin + 450,          // TOTAL
      leftMargin + 520           // INVOICE
    ];

    // Encabezado de tabla
    doc.save();
    doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
    doc.rect(col[0], tableTop, col[8] - col[0], 22).fillAndStroke('#e3f2fd', '#1976d2');
    doc.fillColor('#1976d2');
    doc.text('No.', col[0], tableTop + 6, { width: col[1] - col[0], align: 'center' });
    doc.text('SKU', col[1], tableTop + 6, { width: col[2] - col[1], align: 'center' });
    doc.text('DESCRIPTION', col[2], tableTop + 6, { width: col[3] - col[2], align: 'center' });
    doc.text('U/M', col[3], tableTop + 6, { width: col[4] - col[3], align: 'center' });
    doc.text('QTY', col[4], tableTop + 6, { width: col[5] - col[4], align: 'center' });
    doc.text('UNIT COST', col[5], tableTop + 6, { width: col[6] - col[5], align: 'center' });
    doc.text('TOTAL', col[6], tableTop + 6, { width: col[7] - col[6], align: 'center' });
    doc.text('INVOICE', col[7], tableTop + 6, { width: col[8] - col[7], align: 'center' });
    doc.restore();

    let y = tableTop + 22;
    if (partsArr.length > 0) {
      partsArr.forEach((p, i) => {
        doc.rect(col[0], y, col[8] - col[0], 18).strokeColor('#e3f2fd').stroke();
        doc.font('Courier').fontSize(10).fillColor('#222');
        doc.text(i + 1, col[0], y + 4, { width: col[1] - col[0], align: 'center' });
        doc.text(p.sku || '-', col[1], y + 4, { width: col[2] - col[1], align: 'center' });
        doc.text(p.part || '-', col[2], y + 4, { width: col[3] - col[2], align: 'center' });
        doc.text(p.um || '-', col[3], y + 4, { width: col[4] - col[3], align: 'center' });
        doc.text(p.qty || '-', col[4], y + 4, { width: col[5] - col[4], align: 'center' }); // QTY
        doc.text(
          p.cost !== undefined && p.cost !== null && !isNaN(Number(p.cost))
            ? Number(p.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : '$0.00',
          col[5], y + 4, { width: col[6] - col[5], align: 'center' }
        );
        doc.text(
          p.qty && p.cost && !isNaN(Number(p.qty)) && !isNaN(Number(p.cost))
            ? (Number(p.qty) * Number(p.cost)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : '$0.00',
          col[6], y + 4, { width: col[7] - col[6], align: 'center' }
        );
        // INVOICE LINK O NÚMERO
        if (p.invoiceLink) {
          const invoiceNumber = p.invoiceNumber || '';
          doc.font('Courier').fillColor('#1976d2').text(
            invoiceNumber ? invoiceNumber : 'Ver Invoice',
            col[7], y + 4, { width: col[8] - col[7], align: 'center', underline: true }
          );
          const linkText = invoiceNumber ? invoiceNumber : 'Ver Invoice';
          const textWidth = doc.widthOfString(linkText, { font: 'Courier', size: 10 });
          const textHeight = doc.currentLineHeight();
          const linkX = col[7] + ((col[8] - col[7]) - textWidth) / 2;
          doc.link(linkX, y + 4, textWidth, textHeight, p.invoiceLink);
        } else {
          doc.font('Courier').fillColor('#888').text(
            '', col[7], y + 4, { width: col[8] - col[7], align: 'center' }
          );
        }
        y += 18;
      });
    }

    doc.rect(col[0], y, col[8] - col[0], 0.5).fillAndStroke('#1976d2', '#1976d2');
    y += 10;
    doc.font('Courier-Bold').fontSize(10).fillColor('#1976d2');
    doc.text(
      `Subtotal Parts: ${partsTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[8] - col[0], align: 'right' }
    );
    y += 16;
    doc.text(
      `Labor: ${laborTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[8] - col[0], align: 'right' }
    );
    extraLabels.forEach((label, idx) => {
      y += 16;
      doc.text(
        `${label}: ${extraArr[idx].toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        col[0], y, { width: col[8] - col[0], align: 'right' }
      );
    });
    y += 24;
    doc.font('Courier-Bold').fontSize(13).fillColor('#d32f2f').text(
      `TOTAL LAB & PARTS: ${totalLabAndPartsFinal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      col[0], y, { width: col[8] - col[0], align: 'right' }
    );

    // TÉRMINOS Y FIRMAS
    doc.moveDown(2);
    doc.font('Courier-Bold').fontSize(9).fillColor('#222').text('TERMS & CONDITIONS:', 40, doc.y);
    doc.font('Courier').fontSize(8).fillColor('#222').text('This estimate is not a final bill, pricing could change if job specifications change.', 40, doc.y + 12);

    doc.moveDown(2);
    doc.font('Courier').fontSize(9).text('I accept this estimate without any changes ', 40, doc.y + 10);
    doc.text('I accept this estimate with the handwritten changes ', 40, doc.y + 24);

    doc.moveDown(2);
    doc.text('NAME: ____________________________    SIGNATURE: ____________________________', 40, doc.y + 10);
    doc.font('Courier-BoldOblique').fontSize(12).fillColor('#1976d2').text('Thanks for your business!', 40, doc.y + 30);

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


