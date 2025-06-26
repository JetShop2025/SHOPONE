const express = require('express');
const db = require('../db');
const path = require('path');
const router = express.Router();

router.use(express.json());

// Función auxiliar para registrar partes en FIFO directamente
async function registerPartFifo(work_order_id, sku, part_name, qty_used, cost, usuario) {
  let qtyToDeduct = Number(qty_used);
  const cleanCost = typeof cost === 'string' ? Number(cost.replace(/[^0-9.-]+/g, '')) : cost;

  try {
    // Busca recibos FIFO con partes disponibles
    const [receives] = await db.query(
      'SELECT id, invoice, invoiceLink, qty_remaining FROM receives WHERE sku = ? AND qty_remaining > 0 ORDER BY fecha ASC',
      [sku]
    );

    let totalDeducted = 0;
    for (const receive of receives) {
      if (qtyToDeduct <= 0) break;
      const deductQty = Math.min(receive.qty_remaining, qtyToDeduct);

      // Descuenta del recibo
      await db.query(
        'UPDATE receives SET qty_remaining = qty_remaining - ? WHERE id = ?',
        [deductQty, receive.id]
      );

      // Registra en work_order_parts
      await db.query(
        'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, invoice, invoiceLink, usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [work_order_id, sku, part_name, deductQty, cleanCost, receive.invoice, receive.invoiceLink, usuario]
      );

      qtyToDeduct -= deductQty;
      totalDeducted += deductQty;
    }

    return { success: true, totalDeducted };
  } catch (error) {
    console.error('Error en registerPartFifo:', error);
    return { success: false, error: error.message };
  }
}

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

// Función para generar PDF profesional - ULTRA OPTIMIZADA PARA MEMORIA
async function generateProfessionalPDF(order, id) {
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');
  
  return new Promise(async (resolve, reject) => {
    let doc;
    const chunks = [];
    
    try {
      // Configuración mínima para reducir memoria
      doc = new PDFDocument({ 
        margin: 40,
        size: 'LETTER',
        bufferPages: true,
        autoFirstPage: true,
        compress: true // Comprimir PDF
      });
      
      // Handlers optimizados
      doc.on('data', chunk => {
        chunks.push(chunk);
        // Limitar el número de chunks en memoria
        if (chunks.length > 100) {
          console.warn('Demasiados chunks PDF, posible memory leak');
        }
      });
      
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          // Limpiar inmediatamente
          chunks.length = 0;
          resolve(pdfBuffer);
        } catch (error) {
          reject(error);
        } finally {
          // Forzar cleanup
          if (chunks.length > 0) {
            chunks.splice(0, chunks.length);
          }
        }
      });
      
      doc.on('error', (error) => {
        if (chunks.length > 0) {
          chunks.splice(0, chunks.length);
        }
        reject(error);
      });

      // VARIABLES DE DISEÑO
      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);
      const centerX = pageWidth / 2;
      
      // COLORES
      const primaryBlue = '#1E3A8A';
      const accentBlue = '#3B82F6';
      const successGreen = '#059669';
      const darkGray = '#374151';
      const lightGray = '#F3F4F6';
      const borderGray = '#D1D5DB';
      const white = '#FFFFFF';
      const black = '#000000';
      
      let yPos = margin;
      
      // ================================
      // HEADER SECTION - SIN FONDO
      // ================================
      
      // Logo lado izquierdo
      try {
        const logoPath = path.join(__dirname, '../assets/logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, margin, yPos, { width: 80, height: 50 });
        } else {
          // Logo de texto
          doc.font('Courier-Bold').fontSize(18).fillColor(primaryBlue);
          doc.text('JET SHOP', margin, yPos + 10);
          doc.font('Courier').fontSize(10).fillColor(darkGray);
          doc.text('LLC', margin, yPos + 30);
        }
      } catch (e) {
        doc.font('Courier-Bold').fontSize(18).fillColor(primaryBlue);
        doc.text('JET SHOP', margin, yPos + 10);
        doc.font('Courier').fontSize(10).fillColor(darkGray);
        doc.text('LLC', margin, yPos + 30);
      }
      
      // TÍTULO INVOICE - MÁS PEQUEÑO Y CENTRADO
      doc.font('Courier-Bold').fontSize(24).fillColor(primaryBlue);
      const titleText = 'INVOICE';
      const titleWidth = doc.widthOfString(titleText);
      const titleX = centerX - (titleWidth / 2);
      doc.text(titleText, titleX, yPos + 15);
      
      // Información de contacto - lado derecho
      doc.font('Courier').fontSize(8).fillColor(darkGray);
      doc.text('740 EL CAMINO REAL', margin + contentWidth - 120, yPos + 5);
      doc.text('GREENFIELD, CA 93927', margin + contentWidth - 120, yPos + 15);
      doc.text('Phone: (831) 555-0123', margin + contentWidth - 120, yPos + 25);
      doc.text('Email: info@jetshop.com', margin + contentWidth - 120, yPos + 35);
      
      yPos += 70;
      
      // ================================
      // INFORMACIÓN PRINCIPAL - FONDO BLANCO
      // ================================
      
      const colWidth = (contentWidth - 20) / 2;
      
      // COLUMNA IZQUIERDA - CUSTOMER INFO (FONDO BLANCO)
      doc.rect(margin, yPos, colWidth, 80).strokeColor(primaryBlue).lineWidth(1).stroke();
      
      // Header de customer info
      doc.rect(margin, yPos, colWidth, 20).fillColor(primaryBlue).fill();
      doc.font('Courier-Bold').fontSize(9).fillColor(white);
      const customerHeaderText = 'CUSTOMER INFORMATION';
      const customerHeaderWidth = doc.widthOfString(customerHeaderText);
      const customerHeaderX = margin + (colWidth / 2) - (customerHeaderWidth / 2);
      doc.text(customerHeaderText, customerHeaderX, yPos + 6);
      
      // Datos del cliente
      doc.font('Courier-Bold').fontSize(8).fillColor(black);
      doc.text('Customer:', margin + 8, yPos + 30);
      doc.font('Courier').fontSize(8).fillColor(black);
      doc.text(order.billToCo || 'N/A', margin + 55, yPos + 30, { width: colWidth - 65 });
      
      doc.font('Courier-Bold').fontSize(8).fillColor(black);
      doc.text('Trailer:', margin + 8, yPos + 45);
      doc.font('Courier').fontSize(8).fillColor(black);
      doc.text(order.trailer || 'N/A', margin + 55, yPos + 45, { width: colWidth - 65 });
      
      doc.font('Courier-Bold').fontSize(8).fillColor(black);
      doc.text('Status:', margin + 8, yPos + 60);
      doc.font('Courier-Bold').fontSize(8).fillColor(successGreen);
      doc.text(order.status || 'PENDING', margin + 55, yPos + 60);
      
      // COLUMNA DERECHA - WORK ORDER INFO (FONDO BLANCO)
      const rightColX = margin + colWidth + 20;
      doc.rect(rightColX, yPos, colWidth, 80).strokeColor(primaryBlue).lineWidth(1).stroke();
      
      // Header de WO info
      doc.rect(rightColX, yPos, colWidth, 20).fillColor(primaryBlue).fill();
      doc.font('Courier-Bold').fontSize(9).fillColor(white);
      const woHeaderText = 'WORK ORDER DETAILS';
      const woHeaderWidth = doc.widthOfString(woHeaderText);
      const woHeaderX = rightColX + (colWidth / 2) - (woHeaderWidth / 2);
      doc.text(woHeaderText, woHeaderX, yPos + 6);
      
      // Datos de la orden
      doc.font('Courier-Bold').fontSize(8).fillColor(black);
      doc.text('Date:', rightColX + 8, yPos + 30);
      doc.font('Courier').fontSize(8).fillColor(black);
      doc.text(formatDateForPdf(order.date), rightColX + 55, yPos + 30);
      
      doc.font('Courier-Bold').fontSize(8).fillColor(black);
      doc.text('W.O. #:', rightColX + 8, yPos + 45);
      doc.font('Courier-Bold').fontSize(8).fillColor(accentBlue);
      doc.text(String(order.idClassic || id), rightColX + 55, yPos + 45);
      
      // Mecánicos
      const mechanics = Array.isArray(order.mechanics) ? order.mechanics : (order.mechanics ? JSON.parse(order.mechanics) : []);
      if (mechanics.length > 0) {
        doc.font('Courier-Bold').fontSize(8).fillColor(black);
        doc.text('Mechanics:', rightColX + 8, yPos + 60);
        
        let mechText = mechanics.map(m => `${m.name || 'Unknown'} (${m.hrs || '0'}h)`).join(', ');
        doc.font('Courier').fontSize(7).fillColor(black);
        doc.text(mechText, rightColX + 8, yPos + 70, { width: colWidth - 16 });
      }
      
      yPos += 100;
      
      // ================================
      // DESCRIPCIÓN - FONDO BLANCO
      // ================================
      if (order.description) {
        doc.rect(margin, yPos, contentWidth, 40).strokeColor(borderGray).stroke();
        
        doc.font('Courier-Bold').fontSize(9).fillColor(primaryBlue);
        const descHeaderText = 'WORK DESCRIPTION';
        const descHeaderWidth = doc.widthOfString(descHeaderText);
        const descHeaderX = centerX - (descHeaderWidth / 2);
        doc.text(descHeaderText, descHeaderX, yPos + 8);
        
        doc.font('Courier').fontSize(8).fillColor(black);
        doc.text(order.description, margin + 15, yPos + 22, { 
          width: contentWidth - 30, 
          align: 'left',
          lineGap: 1
        });
        yPos += 50;
      }
      
      // ================================
      // TABLA DE PARTES - CON CAMPO U/M
      // ================================
      
      // Título de la tabla
      doc.font('Courier-Bold').fontSize(10).fillColor(primaryBlue);
      const partsHeaderText = 'PARTS & MATERIALS';
      const partsHeaderWidth = doc.widthOfString(partsHeaderText);
      const partsHeaderX = centerX - (partsHeaderWidth / 2);
      doc.text(partsHeaderText, partsHeaderX, yPos);
      yPos += 20;
      
      // Header de la tabla
      const tableHeaderHeight = 25;
      doc.rect(margin, yPos, contentWidth, tableHeaderHeight).fillColor(primaryBlue).fill();
      
      // Definir anchos de columnas con U/M
      const colWidths = {
        sku: 70,      // SKU
        desc: 180,    // DESCRIPTION
        um: 40,       // U/M
        qty: 40,      // QTY
        unit: 60,     // UNIT COST
        total: 60,    // TOTAL
        invoice: 72   // INVOICE
      };
      
      let tableX = margin;
      
      // Headers de columnas
      doc.font('Courier-Bold').fontSize(8).fillColor(white);
      
      // SKU
      doc.text('SKU', tableX + (colWidths.sku / 2) - 10, yPos + 8);
      tableX += colWidths.sku;
      
      // DESCRIPTION
      doc.text('DESCRIPTION', tableX + (colWidths.desc / 2) - 30, yPos + 8);
      tableX += colWidths.desc;
      
      // U/M
      doc.text('U/M', tableX + (colWidths.um / 2) - 8, yPos + 8);
      tableX += colWidths.um;
      
      // QTY
      doc.text('QTY', tableX + (colWidths.qty / 2) - 8, yPos + 8);
      tableX += colWidths.qty;
      
      // UNIT COST
      doc.text('UNIT COST', tableX + (colWidths.unit / 2) - 20, yPos + 8);
      tableX += colWidths.unit;
      
      // TOTAL
      doc.text('TOTAL', tableX + (colWidths.total / 2) - 12, yPos + 8);
      tableX += colWidths.total;
      
      // INVOICE
      doc.text('INVOICE', tableX + (colWidths.invoice / 2) - 15, yPos + 8);
      
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
      
      // Filas de partes
      const parts = Array.isArray(order.parts) ? order.parts : (order.parts ? JSON.parse(order.parts) : []);
      let subtotalParts = 0;
      const rowHeight = 20;
      
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
          let lineX = margin + colWidths.sku;
          const widthKeys = Object.keys(colWidths);
          for (let i = 0; i < widthKeys.length - 1; i++) {
            doc.strokeColor(borderGray).lineWidth(0.5);
            doc.moveTo(lineX, yPos).lineTo(lineX, yPos + rowHeight).stroke();
            if (i < widthKeys.length - 2) {
              lineX += colWidths[widthKeys[i + 1]];
            }
          }
          
          // Contenido de las celdas
          const textY = yPos + (rowHeight / 2) - 3;
          tableX = margin;
          
          doc.font('Courier').fontSize(7).fillColor(black);
          
          // SKU
          doc.text(part.sku || '', tableX + 3, textY);
          tableX += colWidths.sku;
          
          // DESCRIPTION
          doc.text(part.part || part.description || '', tableX + 3, textY, { width: colWidths.desc - 6 });
          tableX += colWidths.desc;
          
          // U/M (Unidad de medida - por defecto "EA" para Each)
          doc.text('EA', tableX + 12, textY);
          tableX += colWidths.um;
          
          // QTY
          doc.text(String(qty), tableX + 12, textY);
          tableX += colWidths.qty;
          
          // UNIT COST
          doc.text(`$${unitCost.toFixed(2)}`, tableX + 5, textY);
          tableX += colWidths.unit;
          
          // TOTAL
          doc.font('Courier-Bold').fontSize(7).fillColor(successGreen);
          doc.text(`$${total.toFixed(2)}`, tableX + 5, textY);
          tableX += colWidths.total;
          
          // INVOICE LINK
          const fifoParts = fifoPartsData.filter(fp => fp.sku === part.sku);
          if (fifoParts.length > 0 && fifoParts[0].invoiceLink) {
            doc.fillColor(accentBlue).fontSize(6);
            doc.text('View PDF', tableX + 8, textY, {
              link: fifoParts[0].invoiceLink,
              underline: true
            });
          } else {
            doc.fillColor('#9CA3AF').fontSize(6);
            doc.text('N/A', tableX + 15, textY);
          }
          
          yPos += rowHeight;
        }
      });
      
      yPos += 15;
        // ================================
      // RESUMEN FINANCIERO - LADO DERECHO
      // ================================
      
      // Calcular horas totales de los mecánicos
      const totalHours = mechanics.reduce((sum, m) => sum + (Number(m.hrs) || 0), 0);
      const laborTotal = totalHours * 60;
      // SIEMPRE usar el valor exacto de totalLabAndParts de la base de datos
      const grandTotal = Number(order.totalLabAndParts) || 0;
      
      // Debug log para verificar valores
      console.log(`PDF Debug - Orden ${id}:`);
      console.log(`  - subtotalParts: $${subtotalParts.toFixed(2)}`);
      console.log(`  - laborTotal calculado: $${laborTotal.toFixed(2)} (${totalHours} hrs x $60)`);
      console.log(`  - totalLabAndParts de BD: $${Number(order.totalLabAndParts).toFixed(2)}`);
      console.log(`  - grandTotal usado en PDF: $${grandTotal.toFixed(2)}`);
      
      // Caja de totales en el lado derecho
      const summaryBoxWidth = 200;
      const summaryBoxHeight = 80;
      const summaryX = margin + contentWidth - summaryBoxWidth;
      
      doc.rect(summaryX, yPos, summaryBoxWidth, summaryBoxHeight).fillColor(lightGray).fill();
      doc.rect(summaryX, yPos, summaryBoxWidth, summaryBoxHeight).strokeColor(primaryBlue).lineWidth(1).stroke();
      
      // Header del resumen
      doc.rect(summaryX, yPos, summaryBoxWidth, 20).fillColor(primaryBlue).fill();
      doc.font('Courier-Bold').fontSize(9).fillColor(white);
      const summaryHeaderText = 'FINANCIAL SUMMARY';
      const summaryHeaderWidth = doc.widthOfString(summaryHeaderText);
      const summaryHeaderX = summaryX + (summaryBoxWidth / 2) - (summaryHeaderWidth / 2);
      doc.text(summaryHeaderText, summaryHeaderX, yPos + 6);
      
      // Líneas de totales
      doc.font('Courier').fontSize(8).fillColor(black);
      doc.text(`Parts Subtotal:`, summaryX + 10, yPos + 30);
      doc.text(`$${subtotalParts.toFixed(2)}`, summaryX + summaryBoxWidth - 60, yPos + 30);
      
      doc.text(`Labor (${totalHours} hrs):`, summaryX + 10, yPos + 45);
      doc.text(`$${laborTotal.toFixed(2)}`, summaryX + summaryBoxWidth - 60, yPos + 45);
      
      // Línea separadora
      doc.strokeColor(primaryBlue).lineWidth(1);
      doc.moveTo(summaryX + 10, yPos + 60).lineTo(summaryX + summaryBoxWidth - 10, yPos + 60).stroke();
      
      // Total final
      doc.font('Courier-Bold').fontSize(9).fillColor(successGreen);
      doc.text(`TOTAL:`, summaryX + 10, yPos + 68);
      doc.text(`$${grandTotal.toFixed(2)}`, summaryX + summaryBoxWidth - 70, yPos + 68);
      
      yPos += 100;
      
      // ================================
      // TÉRMINOS Y CONDICIONES - SIN FONDO, SIN FIRMAS
      // ================================
      
      doc.rect(margin, yPos, contentWidth, 50).strokeColor(borderGray).stroke();
      
      doc.font('Courier-Bold').fontSize(9).fillColor(primaryBlue);
      const termsHeaderText = 'TERMS & CONDITIONS';
      const termsHeaderWidth = doc.widthOfString(termsHeaderText);
      const termsHeaderX = centerX - (termsHeaderWidth / 2);
      doc.text(termsHeaderText, termsHeaderX, yPos + 8);
      
      doc.font('Courier').fontSize(7).fillColor(black);
      doc.text('• This estimate is not a final bill, pricing could change if job specifications change.', margin + 15, yPos + 22);
      doc.text('• I accept this estimate without any changes.', margin + 15, yPos + 32);
      doc.text('• I accept this estimate with the handwritten changes.', margin + 15, yPos + 42);
      
      yPos += 60;
      
      // Mensaje final centrado
      doc.font('Courier-Bold').fontSize(10).fillColor(accentBlue);
      const finalText = 'Thanks for your business!';
      const finalTextWidth = doc.widthOfString(finalText);
      const finalTextX = centerX - (finalTextWidth / 2);
      doc.text(finalText, finalTextX, yPos);
        doc.end();
      
    } catch (error) {
      if (doc) {
        doc.end();
      }
      reject(error);
    } finally {
      // Forzar garbage collection si está disponible
      if (global.gc) {
        global.gc();
      }
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
    const id = result.insertId;    // RESPONDER INMEDIATAMENTE
    res.status(201).json({
      id: id,
      message: 'Work Order created successfully',
      pdfUrl: `/work-orders/${id}/pdf`
    });

    // TEMPORALMENTE DESHABILITADO - PDF SOLO SE GENERA CUANDO SE SOLICITA
    console.log(`✅ Orden ${id} creada exitosamente - PDF se generará bajo demanda`);

    // Procesar SOLO FIFO (SIN PDF AUTOMÁTICO PARA AHORRAR MEMORIA)
    if (partsArr && partsArr.length > 0) {
      setImmediate(async () => {
        try {
          console.log(`Registrando ${partsArr.length} partes en FIFO para orden ${id}...`);
          for (const part of partsArr) {
            if (part.sku && part.qty && Number(part.qty) > 0) {
              try {
                const result = await registerPartFifo(
                  id,
                  part.sku,
                  part.part || part.description || '',
                  part.qty,
                  part.cost,
                  fields.usuario || 'SYSTEM'
                );
                if (result.success) {
                  console.log(`✓ Parte ${part.sku} registrada en FIFO`);
                }
              } catch (error) {
                console.error(`✗ Error FIFO ${part.sku}:`, error.message);
              }
            }
          }
          console.log(`✅ FIFO completado para orden ${id}`);
        } catch (error) {
          console.error('✗ Error en proceso FIFO:', error.message);
        }
      });
    }

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
    updateFields.push(id);    await db.query(updateQuery, updateFields);    // 5. Responder inmediatamente
    res.json({ success: true, id });

    // SOLO PROCESAR FIFO (SIN PDF AUTOMÁTICO PARA AHORRAR MEMORIA)
    if (partsArr && partsArr.length > 0) {
      setImmediate(async () => {
        try {
          console.log(`Actualizando FIFO para orden ${id}...`);
          
          // Eliminar partes existentes
          try {
            await db.query('DELETE FROM work_order_parts WHERE work_order_id = ?', [id]);
            console.log(`✓ Partes previas eliminadas para orden ${id}`);
          } catch (e) {
            console.log('No había partes previas para eliminar');
          }
          
          // Registrar nuevas partes en FIFO
          for (const part of partsArr) {
            if (part.sku && part.qty && Number(part.qty) > 0) {
              try {
                const result = await registerPartFifo(
                  id,
                  part.sku,
                  part.part || part.description || '',
                  part.qty,
                  part.cost,
                  fields.usuario || 'SYSTEM'
                );
                if (result.success) {
                  console.log(`✓ Parte ${part.sku} actualizada en FIFO`);
                }
              } catch (error) {
                console.error(`✗ Error actualizando ${part.sku}:`, error.message);
              }
            }
          }
          console.log(`✅ FIFO actualizado para orden ${id}`);
        } catch (error) {
          console.error('✗ Error en actualización FIFO:', error.message);
        }
      });
    }

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
