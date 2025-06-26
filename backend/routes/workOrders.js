const express = require('express');
const db = require('../db');
const path = require('path');
const router = express.Router();

router.use(express.json());

// Función auxiliar para formatear fecha de manera consistente
function formatDateForPdf(date) {
  if (!date) return new Date().toLocaleDateString('en-US').replace(/\//g, '-');
  
  const dateObj = new Date(date);
  // Asegurar que obtenemos la fecha local, no UTC
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

// Función para generar PDF profesional en formato Invoice EXACTO
// Función para generar PDF profesional con diseño PERFECTO y CENTRADO
async function generateProfessionalPDF(order, id) {
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');
  
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'LETTER'
      });
      const chunks = [];
      
      // Capturar el PDF en memoria
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      // VARIABLES DE DISEÑO PERFECTAS
      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);
      const centerX = pageWidth / 2;
      
      // COLORES CORPORATIVOS PROFESIONALES
      const primaryBlue = '#1E3A8A';      // Azul corporativo profundo
      const accentBlue = '#3B82F6';       // Azul brillante
      const successGreen = '#059669';     // Verde éxito
      const darkGray = '#374151';         // Gris oscuro
      const lightGray = '#F3F4F6';        // Gris claro
      const borderGray = '#D1D5DB';       // Gris borde
      const white = '#FFFFFF';
      
      let yPos = margin;
      
      // ================================
      // HEADER SECTION - PERFECTAMENTE CENTRADO
      // ================================
      
      // Rectángulo de header con degradado visual
      doc.rect(margin, yPos, contentWidth, 100).fillColor(lightGray).fill();
      doc.rect(margin, yPos, contentWidth, 100).strokeColor(primaryBlue).lineWidth(2).stroke();
      
      // Logo lado izquierdo
      try {
        const logoPath = path.join(__dirname, '../assets/logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, margin + 20, yPos + 20, { width: 100, height: 60 });
        } else {
          // Logo de texto profesional
          doc.font('Helvetica-Bold').fontSize(28).fillColor(primaryBlue);
          doc.text('JET SHOP', margin + 20, yPos + 25);
          doc.font('Helvetica').fontSize(14).fillColor(darkGray);
          doc.text('LLC', margin + 20, yPos + 55);
        }
      } catch (e) {
        doc.font('Helvetica-Bold').fontSize(28).fillColor(primaryBlue);
        doc.text('JET SHOP', margin + 20, yPos + 25);
        doc.font('Helvetica').fontSize(14).fillColor(darkGray);
        doc.text('LLC', margin + 20, yPos + 55);
      }
      
      // TÍTULO WORK ORDER - CENTRADO PERFECTO
      doc.font('Helvetica-Bold').fontSize(42).fillColor(accentBlue);
      const titleText = 'WORK ORDER';
      const titleWidth = doc.widthOfString(titleText);
      const titleX = centerX - (titleWidth / 2);
      doc.text(titleText, titleX, yPos + 30);
      
      // Información de contacto - lado derecho
      doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryBlue);
      doc.text('CONTACT INFO', margin + contentWidth - 140, yPos + 15);
      doc.font('Helvetica').fontSize(9).fillColor(darkGray);
      doc.text('740 EL CAMINO REAL', margin + contentWidth - 140, yPos + 32);
      doc.text('GREENFIELD, CA 93927', margin + contentWidth - 140, yPos + 45);
      doc.text('Phone: (831) 555-0123', margin + contentWidth - 140, yPos + 58);
      doc.text('Email: info@jetshop.com', margin + contentWidth - 140, yPos + 71);
      
      yPos += 120;
      
      // ================================
      // INFORMACIÓN PRINCIPAL - LAYOUT PERFECTO
      // ================================
      
      // Contenedor principal con dos columnas
      const colWidth = (contentWidth - 20) / 2;
      
      // COLUMNA IZQUIERDA - CUSTOMER INFO
      doc.rect(margin, yPos, colWidth, 120).fillColor(white).fill();
      doc.rect(margin, yPos, colWidth, 120).strokeColor(primaryBlue).lineWidth(1.5).stroke();
      
      // Header de customer info
      doc.rect(margin, yPos, colWidth, 30).fillColor(primaryBlue).fill();
      doc.font('Helvetica-Bold').fontSize(12).fillColor(white);
      const customerHeaderText = 'CUSTOMER INFORMATION';
      const customerHeaderWidth = doc.widthOfString(customerHeaderText);
      const customerHeaderX = margin + (colWidth / 2) - (customerHeaderWidth / 2);
      doc.text(customerHeaderText, customerHeaderX, yPos + 10);
      
      // Datos del cliente
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue);
      doc.text('Customer:', margin + 15, yPos + 45);
      doc.font('Helvetica').fontSize(10).fillColor(darkGray);
      doc.text(order.billToCo || 'N/A', margin + 70, yPos + 45, { width: colWidth - 85 });
      
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue);
      doc.text('Trailer:', margin + 15, yPos + 65);
      doc.font('Helvetica').fontSize(10).fillColor(darkGray);
      doc.text(order.trailer || 'N/A', margin + 70, yPos + 65, { width: colWidth - 85 });
      
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue);
      doc.text('Status:', margin + 15, yPos + 85);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(successGreen);
      doc.text(order.status || 'PENDING', margin + 70, yPos + 85);
      
      // COLUMNA DERECHA - WORK ORDER INFO
      const rightColX = margin + colWidth + 20;
      doc.rect(rightColX, yPos, colWidth, 120).fillColor(white).fill();
      doc.rect(rightColX, yPos, colWidth, 120).strokeColor(primaryBlue).lineWidth(1.5).stroke();
      
      // Header de WO info
      doc.rect(rightColX, yPos, colWidth, 30).fillColor(primaryBlue).fill();
      doc.font('Helvetica-Bold').fontSize(12).fillColor(white);
      const woHeaderText = 'WORK ORDER DETAILS';
      const woHeaderWidth = doc.widthOfString(woHeaderText);
      const woHeaderX = rightColX + (colWidth / 2) - (woHeaderWidth / 2);
      doc.text(woHeaderText, woHeaderX, yPos + 10);
      
      // Datos de la orden
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue);
      doc.text('Date:', rightColX + 15, yPos + 45);
      doc.font('Helvetica').fontSize(10).fillColor(darkGray);
      doc.text(formatDateForPdf(order.date), rightColX + 70, yPos + 45);
      
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue);
      doc.text('W.O. #:', rightColX + 15, yPos + 65);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(accentBlue);
      doc.text(String(order.idClassic || id), rightColX + 70, yPos + 65);
      
      // Mecánicos en la columna derecha
      const mechanics = Array.isArray(order.mechanics) ? order.mechanics : (order.mechanics ? JSON.parse(order.mechanics) : []);
      if (mechanics.length > 0) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue);
        doc.text('Mechanics:', rightColX + 15, yPos + 85);
        
        let mechText = mechanics.map(m => `${m.name || 'Unknown'} (${m.hrs || '0'}h)`).join(', ');
        doc.font('Helvetica').fontSize(9).fillColor(darkGray);
        doc.text(mechText, rightColX + 15, yPos + 100, { width: colWidth - 30 });
      }
      
      yPos += 140;
      
      // ================================
      // DESCRIPCIÓN - CENTRADA Y ELEGANTE
      // ================================
      if (order.description) {
        doc.rect(margin, yPos, contentWidth, 60).fillColor(lightGray).fill();
        doc.rect(margin, yPos, contentWidth, 60).strokeColor(borderGray).stroke();
        
        doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryBlue);
        const descHeaderText = 'WORK DESCRIPTION';
        const descHeaderWidth = doc.widthOfString(descHeaderText);
        const descHeaderX = centerX - (descHeaderWidth / 2);
        doc.text(descHeaderText, descHeaderX, yPos + 10);
        
        doc.font('Helvetica').fontSize(10).fillColor(darkGray);
        doc.text(order.description, margin + 20, yPos + 35, { 
          width: contentWidth - 40, 
          align: 'left',
          lineGap: 2
        });
        yPos += 80;
      }
      
      // ================================
      // TABLA DE PARTES - DISEÑO PERFECTO
      // ================================
      
      // Título de la tabla
      doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryBlue);
      const partsHeaderText = 'PARTS & MATERIALS';
      const partsHeaderWidth = doc.widthOfString(partsHeaderText);
      const partsHeaderX = centerX - (partsHeaderWidth / 2);
      doc.text(partsHeaderText, partsHeaderX, yPos);
      yPos += 30;
      
      // Header de la tabla con diseño perfecto
      const tableHeaderHeight = 35;
      doc.rect(margin, yPos, contentWidth, tableHeaderHeight).fillColor(primaryBlue).fill();
      
      // Definir anchos de columnas perfectamente calculados
      const colWidths = {
        num: 30,      // #
        sku: 80,      // SKU
        desc: 200,    // DESCRIPTION
        qty: 50,      // QTY
        unit: 70,     // UNIT COST
        total: 70,    // TOTAL
        invoice: 62   // INVOICE
      };
      
      let tableX = margin;
      
      // Headers de columnas con texto centrado
      doc.font('Helvetica-Bold').fontSize(10).fillColor(white);
      
      // #
      doc.text('#', tableX + (colWidths.num / 2) - 5, yPos + 12);
      tableX += colWidths.num;
      
      // SKU
      doc.text('SKU', tableX + (colWidths.sku / 2) - 10, yPos + 12);
      tableX += colWidths.sku;
      
      // DESCRIPTION
      doc.text('DESCRIPTION', tableX + (colWidths.desc / 2) - 35, yPos + 12);
      tableX += colWidths.desc;
      
      // QTY
      doc.text('QTY', tableX + (colWidths.qty / 2) - 10, yPos + 12);
      tableX += colWidths.qty;
      
      // UNIT COST
      doc.text('UNIT COST', tableX + (colWidths.unit / 2) - 25, yPos + 12);
      tableX += colWidths.unit;
      
      // TOTAL
      doc.text('TOTAL', tableX + (colWidths.total / 2) - 15, yPos + 12);
      tableX += colWidths.total;
      
      // INVOICE
      doc.text('INVOICE', tableX + (colWidths.invoice / 2) - 20, yPos + 12);
      
      yPos += tableHeaderHeight;
      
      // Obtener datos FIFO
      let fifoPartsData = [];
      try {
        const [fifoResults] = await db.query(
          'SELECT sku, part_name, qty_used, cost, invoice, invoiceLink FROM work_order_parts WHERE work_order_id = ?',
          [id]
        );
        fifoPartsData = fifoResults || [];
      } catch (e) {
        console.log('Error getting FIFO data:', e.message);
      }
      
      // Filas de partes con diseño alternado
      const parts = Array.isArray(order.parts) ? order.parts : (order.parts ? JSON.parse(order.parts) : []);
      let subtotalParts = 0;
      const rowHeight = 30;
      
      parts.forEach((part, index) => {
        if (part.sku && part.qty) {
          // Color alternado para filas
          const fillColor = index % 2 === 0 ? white : '#F8FAFC';
          doc.rect(margin, yPos, contentWidth, rowHeight).fillColor(fillColor).fill();
          doc.rect(margin, yPos, contentWidth, rowHeight).strokeColor(borderGray).lineWidth(0.5).stroke();
          
          const unitCost = Number(part.cost) || 0;
          const qty = Number(part.qty) || 0;
          const total = unitCost * qty;
          subtotalParts += total;
          
          // Líneas verticales para separar columnas
          let lineX = margin + colWidths.num;
          for (let i = 0; i < 6; i++) {
            doc.strokeColor(borderGray).lineWidth(0.5);
            doc.moveTo(lineX, yPos).lineTo(lineX, yPos + rowHeight).stroke();
            const widthKeys = Object.keys(colWidths);
            if (i < widthKeys.length - 1) {
              lineX += colWidths[widthKeys[i + 1]];
            }
          }
          
          // Contenido de las celdas centrado verticalmente
          const textY = yPos + (rowHeight / 2) - 5;
          tableX = margin;
          
          doc.font('Helvetica').fontSize(9).fillColor(darkGray);
          
          // #
          doc.text(String(index + 1), tableX + 10, textY);
          tableX += colWidths.num;
          
          // SKU
          doc.text(part.sku || '', tableX + 5, textY);
          tableX += colWidths.sku;
          
          // DESCRIPTION
          doc.text(part.part || part.description || '', tableX + 5, textY, { width: colWidths.desc - 10 });
          tableX += colWidths.desc;
          
          // QTY
          doc.text(String(qty), tableX + 15, textY);
          tableX += colWidths.qty;
          
          // UNIT COST
          doc.text(`$${unitCost.toFixed(2)}`, tableX + 10, textY);
          tableX += colWidths.unit;
          
          // TOTAL
          doc.font('Helvetica-Bold').fontSize(9).fillColor(successGreen);
          doc.text(`$${total.toFixed(2)}`, tableX + 10, textY);
          tableX += colWidths.total;
          
          // INVOICE LINK
          const fifoParts = fifoPartsData.filter(fp => fp.sku === part.sku);
          if (fifoParts.length > 0 && fifoParts[0].invoiceLink) {
            doc.fillColor(accentBlue).fontSize(8);
            doc.text('View PDF', tableX + 10, textY, {
              link: fifoParts[0].invoiceLink,
              underline: true
            });
          } else {
            doc.fillColor('#9CA3AF').fontSize(8);
            doc.text('N/A', tableX + 15, textY);
          }
          
          yPos += rowHeight;
        }
      });
      
      yPos += 30;
      
      // ================================
      // RESUMEN FINANCIERO - PERFECTO
      // ================================
      
      const totalHours = mechanics.reduce((sum, m) => sum + (Number(m.hrs) || 0), 0);
      const laborTotal = totalHours * 60;
      const grandTotal = Number(order.totalLabAndParts) || (subtotalParts + laborTotal);
      
      // Caja de totales centrada y elegante
      const summaryBoxWidth = 300;
      const summaryBoxHeight = 120;
      const summaryX = centerX - (summaryBoxWidth / 2);
      
      doc.rect(summaryX, yPos, summaryBoxWidth, summaryBoxHeight).fillColor(lightGray).fill();
      doc.rect(summaryX, yPos, summaryBoxWidth, summaryBoxHeight).strokeColor(primaryBlue).lineWidth(2).stroke();
      
      // Header del resumen
      doc.rect(summaryX, yPos, summaryBoxWidth, 30).fillColor(primaryBlue).fill();
      doc.font('Helvetica-Bold').fontSize(14).fillColor(white);
      const summaryHeaderText = 'FINANCIAL SUMMARY';
      const summaryHeaderWidth = doc.widthOfString(summaryHeaderText);
      const summaryHeaderX = summaryX + (summaryBoxWidth / 2) - (summaryHeaderWidth / 2);
      doc.text(summaryHeaderText, summaryHeaderX, yPos + 8);
      
      // Líneas de totales
      doc.font('Helvetica').fontSize(11).fillColor(darkGray);
      doc.text(`Parts Subtotal:`, summaryX + 20, yPos + 45);
      doc.text(`$${subtotalParts.toFixed(2)}`, summaryX + summaryBoxWidth - 80, yPos + 45);
      
      doc.text(`Labor (${totalHours} hrs):`, summaryX + 20, yPos + 65);
      doc.text(`$${laborTotal.toFixed(2)}`, summaryX + summaryBoxWidth - 80, yPos + 65);
      
      // Línea separadora
      doc.strokeColor(primaryBlue).lineWidth(1);
      doc.moveTo(summaryX + 20, yPos + 85).lineTo(summaryX + summaryBoxWidth - 20, yPos + 85).stroke();
      
      // Total final
      doc.font('Helvetica-Bold').fontSize(14).fillColor(successGreen);
      doc.text(`TOTAL:`, summaryX + 20, yPos + 95);
      doc.text(`$${grandTotal.toFixed(2)}`, summaryX + summaryBoxWidth - 100, yPos + 95);
      
      yPos += 150;
      
      // ================================
      // FOOTER - TÉRMINOS Y FIRMAS
      // ================================
      
      // Verificar si necesitamos nueva página
      if (yPos > pageHeight - 200) {
        doc.addPage();
        yPos = margin;
      }
      
      // Términos y condiciones
      doc.rect(margin, yPos, contentWidth, 80).fillColor(lightGray).fill();
      doc.rect(margin, yPos, contentWidth, 80).strokeColor(borderGray).stroke();
      
      doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryBlue);
      const termsHeaderText = 'TERMS & CONDITIONS';
      const termsHeaderWidth = doc.widthOfString(termsHeaderText);
      const termsHeaderX = centerX - (termsHeaderWidth / 2);
      doc.text(termsHeaderText, termsHeaderX, yPos + 10);
      
      doc.font('Helvetica').fontSize(9).fillColor(darkGray);
      doc.text('• This work order is subject to standard terms and conditions.', margin + 20, yPos + 35);
      doc.text('• Pricing may change if job specifications change.', margin + 20, yPos + 50);
      doc.text('• Customer approval required for additional work exceeding estimate.', margin + 20, yPos + 65);
      
      yPos += 100;
      
      // Sección de firmas
      const signatureBoxWidth = (contentWidth - 40) / 2;
      
      // Firma del cliente
      doc.rect(margin, yPos, signatureBoxWidth, 60).strokeColor(borderGray).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue);
      doc.text('CUSTOMER SIGNATURE', margin + 10, yPos + 10);
      
      doc.strokeColor(darkGray).lineWidth(1);
      doc.moveTo(margin + 10, yPos + 40).lineTo(margin + signatureBoxWidth - 10, yPos + 40).stroke();
      
      // Fecha
      doc.rect(margin + signatureBoxWidth + 40, yPos, signatureBoxWidth, 60).strokeColor(borderGray).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue);
      doc.text('DATE', margin + signatureBoxWidth + 50, yPos + 10);
      
      doc.strokeColor(darkGray).lineWidth(1);
      doc.moveTo(margin + signatureBoxWidth + 50, yPos + 40).lineTo(margin + contentWidth - 10, yPos + 40).stroke();
      
      yPos += 80;
      
      // Mensaje final centrado y elegante
      doc.font('Helvetica-Bold').fontSize(16).fillColor(accentBlue);
      const finalText = 'Thank you for choosing JET SHOP LLC!';
      const finalTextWidth = doc.widthOfString(finalText);
      const finalTextX = centerX - (finalTextWidth / 2);
      doc.text(finalText, finalTextX, yPos + 20);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

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
    const [results] = await db.query('SELECT * FROM work_orders ORDER BY id DESC LIMIT 100');
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
      let extraOptions = [];
      try {
        extraOptions = JSON.parse(order.extraOptions || '[]');
      } catch { extraOptions = []; }
      return {
        ...order,
        parts,
        mechanics,
        extraOptions
      };
    });
    res.json(parsedResults);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR FETCHING WORK ORDERS');
  }
});

// CREAR ORDEN DE TRABAJO - SIMPLIFICADO EMERGENCIA
router.post('/', async (req, res) => {
  try {
    const fields = req.body;
    const parts = fields.parts || [];
    const extraOptions = fields.extraOptions || [];
    const billToCo = fields.billToCo || '';
    const trailer = fields.trailer || '';
    const mechanic = fields.mechanic || '';
    const mechanicsArr = Array.isArray(fields.mechanics) ? fields.mechanics : [];
    const date = fields.date || new Date();
    const description = fields.description || '';
    const status = fields.status || 'PENDING';
    const idClassic = fields.idClassic || null;

    // Limpia y valida partes
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => ({
            ...part,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, '')),
            qty: Number(part.qty) || 0
          }))
      : [];

    // Calcula totales
    let totalHrsPut = 0;
    if (Array.isArray(fields.mechanics) && fields.mechanics.length > 0) {
      totalHrsPut = fields.mechanics.reduce((sum, m) => sum + (parseFloat(m.hrs) || 0), 0);
    }
    if (!totalHrsPut && fields.totalHrs) {
      totalHrsPut = parseFloat(fields.totalHrs) || 0;
    }
    const laborTotal = totalHrsPut * 60;
    const partsTotal = partsArr.reduce((sum, part) => sum + (Number(part.cost) || 0), 0);
    const subtotal = partsTotal + laborTotal;

    let extra = 0;
    const extras = Array.isArray(extraOptions) ? extraOptions : [];
    
    // SIEMPRE aplicar 5% automático
    extra += subtotal * 0.05;
    
    extras.forEach(opt => {
      if (opt === '15shop') {
        extra += subtotal * 0.15;
      }
      if (opt === '15weld') {
        extra += subtotal * 0.15;
      }
    });

    // Calcula el total final
    let totalLabAndPartsFinal;
    if (
      fields.totalLabAndParts !== undefined &&
      fields.totalLabAndParts !== null &&
      fields.totalLabAndParts !== '' &&
      !isNaN(Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      // Respeta el valor manual del usuario
      totalLabAndPartsFinal = Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      // Usa el cálculo automático
      totalLabAndPartsFinal = subtotal + extra;
    }

    // INSERTAR EN DB SIMPLE
    const query = `
      INSERT INTO work_orders (billToCo, trailer, mechanic, mechanics, date, description, parts, totalHrs, totalLabAndParts, status, idClassic, extraOptions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrsPut, totalLabAndPartsFinal, status, idClassic,
      JSON.stringify(extraOptions || [])
    ];
    const [result] = await db.query(query, values);
    const id = result.insertId;    // RESPONDER INMEDIATAMENTE SIN PROCESOS PESADOS
    const formattedDate = formatDateForPdf(date);      // Generar PDF automáticamente en segundo plano y guardarlo en la base de datos
    setTimeout(async () => {
      try {
        console.log(`Iniciando proceso FIFO y PDF para orden ${id}...`);
        
        // Obtener los datos completos de la orden recién creada
        const [orderData] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
        if (orderData && orderData.length > 0) {
          
          // Registrar partes en el sistema FIFO
          if (partsArr && partsArr.length > 0) {
            console.log(`Registrando ${partsArr.length} partes en el sistema FIFO...`);
            for (const part of partsArr) {
              if (part.sku && part.qty && Number(part.qty) > 0) {
                try {
                  console.log(`Registrando parte: ${part.sku}, qty: ${part.qty}`);
                  
                  // Llamar directamente al endpoint FIFO
                  const response = await fetch('http://localhost:5050/work-order-parts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      work_order_id: id,
                      sku: part.sku,
                      part_name: part.part || part.description || '',
                      qty_used: part.qty,
                      cost: part.cost,
                      usuario: fields.usuario || 'SYSTEM'
                    })
                  });
                  
                  if (response.ok) {
                    console.log(`✓ Parte ${part.sku} registrada en FIFO exitosamente`);
                  } else {
                    console.error(`✗ Error HTTP ${response.status} registrando parte ${part.sku}`);
                  }
                } catch (fifoError) {
                  console.error(`✗ Error registrando parte ${part.sku} en FIFO:`, fifoError.message);
                }
              }
            }
          }
          
          // Esperar un momento para que el FIFO procese las partes
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Generar PDF con datos FIFO actualizados
          console.log(`Generando PDF para orden ${id}...`);
          const pdfBuffer = await generateProfessionalPDF(orderData[0], id);
          await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
          console.log(`✓ PDF creado y guardado en BD para orden ${id}`);
        }
      } catch (pdfError) {
        console.error('✗ Error en proceso FIFO/PDF:', pdfError.message);
      }
    }, 1000);
    
    res.status(201).json({
      id: id,
      message: 'Work Order created successfully',
      pdfUrl: `/work-orders/${id}/pdf`
    });

  } catch (err) {
    console.error('Error creando WO:', err);
    res.status(500).json({ error: 'Error al crear la orden de trabajo' });
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

// EDITAR ORDEN DE TRABAJO - SIMPLIFICADO
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
    usuario,
    idClassic
  } = fields;

  try {
    // 1. Verifica que la orden exista
    const [oldResults] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }

    // 2. Limpia y valida partes
    const partsArr = Array.isArray(parts)
      ? parts
          .filter(part => part.sku && String(part.sku).trim() !== '')
          .map(part => ({
            ...part,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, '')),
            qty: Number(part.qty) || 0
          }))
      : [];

    // 3. Calcula totales
    let totalHrsPut = 0;
    if (Array.isArray(fields.mechanics) && fields.mechanics.length > 0) {
      totalHrsPut = fields.mechanics.reduce((sum, m) => sum + (parseFloat(m.hrs) || 0), 0);
    } 
    if (!totalHrsPut && fields.totalHrs) {
      totalHrsPut = parseFloat(fields.totalHrs) || 0;
    }
    const laborTotal = totalHrsPut * 60;
    const partsTotal = partsArr.reduce((sum, part) => {
      const cost = Number(part.cost) || 0;
      return sum + cost;
    }, 0);
    const subtotal = partsTotal + laborTotal;

    let extra = 0;
    const extras = Array.isArray(extraOptions) ? extraOptions : [];
    
    // SIEMPRE aplicar 5% automático
    extra += subtotal * 0.05;
    
    extras.forEach(opt => {
      if (opt === '15shop') {
        extra += subtotal * 0.15;
      } 
      if (opt === '15weld') {
        extra += subtotal * 0.15;
      }
    });
    
    // Calcula el total final
    let totalLabAndPartsFinal;
    if (
      fields.totalLabAndParts !== undefined &&
      fields.totalLabAndParts !== null &&
      fields.totalLabAndParts !== '' &&
      !isNaN(Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      // Respeta el valor manual del usuario
      totalLabAndPartsFinal = Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      // Usa el cálculo automático
      totalLabAndPartsFinal = subtotal + extra;
    }

    // 4. Actualiza la orden en la base de datos
    const mechanicsArr = Array.isArray(fields.mechanics) ? fields.mechanics : [];
    let updateQuery = `
      UPDATE work_orders SET 
        billToCo = ?, trailer = ?, mechanic = ?, mechanics = ?, date = ?, description = ?, parts = ?, totalHrs = ?, totalLabAndParts = ?, status = ?, extraOptions = ?
    `;
    const updateFields = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrsPut, totalLabAndPartsFinal, status,
      JSON.stringify(extraOptions || [])
    ];
    if (status === 'FINISHED') {
      updateQuery += `, idClassic = ?`;
      updateFields.push(fields.idClassic || null);
    }
    updateQuery += ` WHERE id = ?`;
    updateFields.push(id);    await db.query(updateQuery, updateFields);    // 5. Generar PDF automáticamente después de actualizar y guardarlo en la base de datos
    setTimeout(async () => {
      try {
        console.log(`Iniciando actualización FIFO y PDF para orden ${id}...`);
        
        // Actualizar partes en el sistema FIFO
        if (partsArr && partsArr.length > 0) {
          // Primero eliminar las partes existentes de esta orden
          try {
            await db.query('DELETE FROM work_order_parts WHERE work_order_id = ?', [id]);
            console.log(`✓ Partes previas eliminadas para orden ${id}`);
          } catch (e) {
            console.log('No había partes previas para eliminar');
          }
          
          // Registrar las nuevas partes en FIFO
          console.log(`Registrando ${partsArr.length} partes actualizadas en FIFO...`);
          for (const part of partsArr) {
            if (part.sku && part.qty && Number(part.qty) > 0) {
              try {
                console.log(`Actualizando parte: ${part.sku}, qty: ${part.qty}`);
                
                const response = await fetch('http://localhost:5050/work-order-parts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    work_order_id: id,
                    sku: part.sku,
                    part_name: part.part || part.description || '',
                    qty_used: part.qty,
                    cost: part.cost,
                    usuario: fields.usuario || 'SYSTEM'
                  })
                });
                
                if (response.ok) {
                  console.log(`✓ Parte ${part.sku} actualizada en FIFO exitosamente`);
                } else {
                  console.error(`✗ Error HTTP ${response.status} actualizando parte ${part.sku}`);
                }
              } catch (fifoError) {
                console.error(`✗ Error actualizando parte ${part.sku} en FIFO:`, fifoError.message);
              }
            }
          }
        }
        
        // Esperar para que FIFO procese
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Obtener los datos actualizados y generar PDF
        const [orderData] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
        if (orderData && orderData.length > 0) {
          console.log(`Generando PDF actualizado para orden ${id}...`);
          const pdfBuffer = await generateProfessionalPDF(orderData[0], id);
          await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
          console.log(`✓ PDF actualizado y guardado en BD para orden ${id}`);
        }
      } catch (pdfError) {
        console.error('✗ Error en actualización FIFO/PDF:', pdfError.message);
      }
    }, 1000);

    res.json({ success: true, id });

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

// Obtener PDF por ID de orden (desde base de datos)
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const [results] = await db.query('SELECT pdf_file, idClassic FROM work_orders WHERE id = ?', [id]);
    
    if (!results || results.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    
    const order = results[0];
    
    // Si no hay PDF en la base de datos, generar uno nuevo
    if (!order.pdf_file) {
      console.log(`PDF no encontrado para orden ${id}, generando nuevo PDF...`);
      
      // Obtener datos completos de la orden para generar PDF
      const [fullOrder] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
      if (!fullOrder || fullOrder.length === 0) {
        return res.status(404).send('WORK ORDER DATA NOT FOUND');
      }
      
      try {
        // Generar PDF profesional
        const pdfBuffer = await generateProfessionalPDF(fullOrder[0], id);
        
        // Guardar PDF en la base de datos
        await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
        
        // Enviar el PDF generado
        const fileName = `workorder_${order.idClassic || id}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.send(pdfBuffer);
        
        console.log(`PDF generado y guardado para orden ${id}`);
        return;
        
      } catch (pdfError) {
        console.error('Error generando PDF:', pdfError);
        return res.status(500).send('ERROR GENERATING PDF');
      }
    }
    
    // Enviar PDF existente desde la base de datos
    const fileName = `workorder_${order.idClassic || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(order.pdf_file);
    
  } catch (error) {
    console.error('Error obteniendo PDF:', error);
    res.status(500).send('ERROR GETTING PDF');
  }
});

// Regenerar PDF para una orden existente
// Regenerar PDF para una orden existente (guardado en base de datos)
router.post('/:id/generate-pdf', async (req, res) => {
  const { id } = req.params;
  try {
    // Obtener datos de la orden
    const [results] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!results || results.length === 0) {
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    
    const order = results[0];
    
    try {
      // Generar PDF profesional
      const pdfBuffer = await generateProfessionalPDF(order, id);
      
      // Guardar PDF en la base de datos
      await db.query('UPDATE work_orders SET pdf_file = ? WHERE id = ?', [pdfBuffer, id]);
      
      console.log(`PDF regenerado y guardado en BD para orden ${id}`);
      res.json({ 
        message: 'PDF regenerated successfully and saved to database',
        pdfUrl: `/work-orders/${id}/pdf`
      });
      
    } catch (pdfError) {
      console.error('Error generando PDF:', pdfError);
      res.status(500).json({ error: 'Error generating PDF' });
    }
    
  } catch (err) {
    console.error('Error regenerating PDF:', err);
    res.status(500).json({ error: 'Error regenerating PDF' });
  }
});

module.exports = router;
