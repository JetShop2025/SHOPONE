const express = require('express');
const db = require('../db');
const path = require('path');
const router = express.Router();

router.use(express.json());

// Función auxiliar para registrar partes en FIFO directamente
async function registerPartFifo(work_order_id, sku, part_name, qty_used, cost, usuario, pendingPartId = null) {
  const fifoId = `FIFO_${work_order_id}_${sku}_${Date.now()}`;
  console.log(`🔄 [${fifoId}] Iniciando registro FIFO - SKU: ${sku}, Qty: ${qty_used}, PendingPartId: ${pendingPartId}`);
  
  let qtyToDeduct = Number(qty_used);
  const cleanCost = typeof cost === 'string' ? Number(cost.replace(/[^0-9.-]+/g, '')) : cost;
  
  console.log(`📊 [${fifoId}] Memoria inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

  try {
    console.log(`🔍 [${fifoId}] Buscando recibos FIFO disponibles...`);
    
    // Si tenemos un pendingPartId específico, usarlo primero
    let receives = [];
    if (pendingPartId) {
      console.log(`🎯 [${fifoId}] Usando parte pendiente específica ID: ${pendingPartId}`);
      const [specificReceive] = await db.query(
        'SELECT id, invoice, invoiceLink, qty_remaining FROM receives WHERE id = ? AND sku = ? AND qty_remaining > 0',
        [pendingPartId, sku]
      );
      receives = specificReceive || [];
      
      if (receives.length > 0) {
        console.log(`✅ [${fifoId}] Parte pendiente específica encontrada, qty disponible: ${receives[0].qty_remaining}`);
      } else {
        console.log(`⚠️ [${fifoId}] Parte pendiente específica no disponible, buscando otras...`);
      }
    }
    
    // Si no encontramos la parte específica o no se proporcionó, buscar otras disponibles
    if (receives.length === 0) {
      const [generalReceives] = await db.query(
        'SELECT id, invoice, invoiceLink, qty_remaining FROM receives WHERE sku = ? AND qty_remaining > 0 ORDER BY fecha ASC',
        [sku]
      );
      receives = generalReceives || [];
    }
    
    console.log(`📦 [${fifoId}] Encontrados ${receives.length} recibos disponibles`);

    let totalDeducted = 0;
    for (let i = 0; i < receives.length; i++) {
      const receive = receives[i];
      if (qtyToDeduct <= 0) break;
      
      const deductQty = Math.min(receive.qty_remaining, qtyToDeduct);
      console.log(`📝 [${fifoId}] Procesando recibo ${i + 1}/${receives.length} - Deduciendo ${deductQty} de ${receive.qty_remaining} disponibles`);

      // Descuenta del recibo
      await db.query(
        'UPDATE receives SET qty_remaining = qty_remaining - ? WHERE id = ?',
        [deductQty, receive.id]
      );
      console.log(`✓ [${fifoId}] Recibo actualizado - ID: ${receive.id}`);

      // Si el recibo se agota completamente, marcarlo como USED
      const newQtyRemaining = receive.qty_remaining - deductQty;
      if (newQtyRemaining <= 0) {
        await db.query(
          'UPDATE receives SET estatus = "USED" WHERE id = ?',
          [receive.id]
        );
        console.log(`✅ [${fifoId}] Recibo marcado como USED - ID: ${receive.id}`);
      }

      // Registra en work_order_parts
      await db.query(
        'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, invoice, invoiceLink, usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [work_order_id, sku, part_name, deductQty, cleanCost, receive.invoice, receive.invoiceLink, usuario]
      );
      console.log(`✓ [${fifoId}] Parte registrada en work_order_parts`);

      qtyToDeduct -= deductQty;
      totalDeducted += deductQty;
      
      // Log de memoria cada 10 iteraciones
      if ((i + 1) % 10 === 0) {
        console.log(`📊 [${fifoId}] Memoria en iteración ${i + 1}: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      }
    }

    console.log(`✅ [${fifoId}] FIFO completado - Total deducido: ${totalDeducted}`);
    // Si aún queda cantidad por deducir, deducir del inventario master (onHand)
    if (qtyToDeduct > 0) {
      console.log(`⚠️ [${fifoId}] No hay suficientes recibos PENDING, deduciendo ${qtyToDeduct} de inventario master (onHand)`);
      // Obtener inventario actual
      const [invRows] = await db.query('SELECT onHand, salidasWo FROM inventory WHERE sku = ?', [sku]);
      if (invRows.length > 0) {
        const currentOnHand = Number(invRows[0].onHand) || 0;
        const currentSalidasWo = Number(invRows[0].salidasWo) || 0;
        const newOnHand = Math.max(0, currentOnHand - qtyToDeduct);
        const newSalidasWo = currentSalidasWo + qtyToDeduct;
        await db.query('UPDATE inventory SET onHand = ?, salidasWo = ? WHERE sku = ?', [newOnHand, newSalidasWo, sku]);
        // Registrar en work_order_parts (sin invoice/invoiceLink)
        await db.query(
          'INSERT INTO work_order_parts (work_order_id, sku, part_name, qty_used, cost, invoice, invoiceLink, usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [work_order_id, sku, part_name, qtyToDeduct, cleanCost, null, null, usuario]
        );
        // (Opcional) Registrar en log/auditoría
        if (db.logAuditEvent) {
          await db.logAuditEvent(
            usuario,
            'UPDATE',
            'inventory',
            sku,
            {
              action: 'Deducción directa de inventario master por falta de recibos PENDING',
              sku,
              qtyDeducted: qtyToDeduct,
              onHandChange: { antes: currentOnHand, despues: newOnHand },
              salidasWoChange: { antes: currentSalidasWo, despues: newSalidasWo },
              source: 'FIFO_REGISTER_PART',
            }
          );
        }
        totalDeducted += qtyToDeduct;
        qtyToDeduct = 0;
      } else {
        console.error(`💀 [${fifoId}] No se encontró inventario master para SKU: ${sku}`);
        return { success: false, error: 'No se encontró inventario master para el SKU' };
      }
    }
    console.log(`📊 [${fifoId}] Memoria final: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    return { success: true, totalDeducted };
  } catch (error) {
    console.error(`💀 [${fifoId}] ERROR CRÍTICO en registerPartFifo:`, error.message);
    console.error(`💀 [${fifoId}] Stack trace:`, error.stack);
    console.error(`📊 [${fifoId}] Memoria en error: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
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
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    let doc;
    const chunks = [];
    try {
      throw new Error('PRUEBA EJECUCIÓN PDF - SI VES ESTE ERROR, ESTA ES LA FUNCIÓN QUE SE EJECUTA');
      console.error(`[PDF] INICIO generateProfessionalPDF para orden ${id}`);
      doc = new PDFDocument({
        margin: 40,
        size: 'LETTER',
        bufferPages: true,
        autoFirstPage: true,
        compress: true
      });
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          console.error(`[PDF] FIN OK generateProfessionalPDF para orden ${id}`);
          resolve(pdfBuffer);
        } catch (error) {
          console.error(`[PDF] ERROR al concatenar buffer para orden ${id}:`, error);
          reject(error);
        }
      });
      doc.on('error', (error) => {
        console.error(`[PDF] ERROR evento doc.on('error') para orden ${id}:`, error);
        reject(error);
      });

      // --- BEGIN REAL PDF GENERATION CODE ---

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

      // EMPLOYEE WRITTEN HOURS (Drive link)
      if (order.employeeWrittenHours) {
        yPos += 20;
        doc.font('Courier-Bold').fontSize(8).fillColor(black);
        doc.text('EMPLOYEE WRITTEN HOURS:', rightColX + 8, yPos);
        doc.font('Courier').fontSize(7).fillColor(accentBlue);
        doc.text(order.employeeWrittenHours, rightColX + 8, yPos + 12, {
          width: colWidth - 16,
          link: order.employeeWrittenHours,
          underline: true
        });
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
      // Labor SIEMPRE debe ser $60
      const totalHours = 1;
      const laborTotal = 60;
      // SIEMPRE usar el valor exacto de totalLabAndParts de la base de datos
      const grandTotal = Number(order.totalLabAndParts) || 0;


      // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.
      if (isNaN(miscPercent)) miscPercent = 0;
      // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.
      if (isNaN(weldPercent)) weldPercent = 0;
      // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.
      console.error(`[PDF]   - grandTotal usado en PDF: $${grandTotal.toFixed(2)}`);

      // Caja de totales en el lado derecho
      const summaryBoxWidth = 200;
      const summaryBoxHeight = 120;
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


      // SIEMPRE mostrar ambas líneas, aunque sean 0
      // Miscellaneous
      // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.

      // Línea separadora
      doc.strokeColor(primaryBlue).lineWidth(1);
      doc.moveTo(summaryX + 10, yPos + 90).lineTo(summaryX + summaryBoxWidth - 10, yPos + 90).stroke();

      // Total final
      doc.font('Courier-Bold').fontSize(9).fillColor(successGreen);
      doc.text(`TOTAL:`, summaryX + 10, yPos + 98);
      doc.text(`$${grandTotal.toFixed(2)}`, summaryX + summaryBoxWidth - 70, yPos + 98);

      yPos += 130;
      
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

      // --- END REAL PDF GENERATION CODE ---

      console.error(`[PDF] PREVIO a doc.end() para orden ${id}`);
      doc.end();
    } catch (error) {
      console.error(`[PDF] ERROR en try principal de generateProfessionalPDF para orden ${id}:`, error);
      reject(error);
    }
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


      // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.
      if (isNaN(weldPercent)) weldPercent = 0;
      const weldAmount = (subtotalParts + laborTotal) * (weldPercent / 100);

      // Debug log para verificar valores
      console.error(`PDF Debug - Orden ${id}:`);
      console.error(`  - subtotalParts: $${subtotalParts.toFixed(2)}`);
      console.error(`  - laborTotal calculado: $${laborTotal.toFixed(2)} (${totalHours} hrs x $60)`);
      console.error(`  - Miscellaneous %: ${miscPercent}% ($${miscAmount.toFixed(2)})`);
      console.error(`  - Welding Supplies %: ${weldPercent}% ($${weldAmount.toFixed(2)})`);
      console.error(`  - totalLabAndParts de BD: $${Number(order.totalLabAndParts).toFixed(2)}`);
      console.error(`  - grandTotal usado en PDF: $${grandTotal.toFixed(2)}`);

      // Caja de totales en el lado derecho
      const summaryBoxWidth = 200;
      const summaryBoxHeight = 120;
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


      // SIEMPRE mostrar ambas líneas, aunque sean 0
      // Miscellaneous
      let miscPercentLabel = 0;
      if (
        Object.prototype.hasOwnProperty.call(order, 'miscellaneousPercent') &&
        order.miscellaneousPercent !== null &&
        order.miscellaneousPercent !== '' &&
        !isNaN(Number(order.miscellaneousPercent))
      ) {
        miscPercentLabel = Number(order.miscellaneousPercent);
      } else if (
        Object.prototype.hasOwnProperty.call(order, 'miscellaneous') &&
        order.miscellaneous !== null &&
        order.miscellaneous !== '' &&
        !isNaN(Number(order.miscellaneous))
      ) {
        miscPercentLabel = Number(order.miscellaneous);
      }
      if (isNaN(miscPercentLabel)) miscPercentLabel = 0;
      doc.text(`Miscellaneous ${miscPercentLabel}%:`, summaryX + 10, yPos + 60);
      doc.text(`$${miscAmount.toFixed(2)}`, summaryX + summaryBoxWidth - 60, yPos + 60);

      // Welding Supplies
      let weldPercentLabel = 0;
      if (
        Object.prototype.hasOwnProperty.call(order, 'weldPercent') &&
        order.weldPercent !== null &&
        order.weldPercent !== '' &&
        !isNaN(Number(order.weldPercent))
      ) {
        weldPercentLabel = Number(order.weldPercent);
      }
      if (isNaN(weldPercentLabel)) weldPercentLabel = 0;
      doc.text(`Welding Supplies ${weldPercentLabel}%:`, summaryX + 10, yPos + 75);
      doc.text(`$${weldAmount.toFixed(2)}`, summaryX + summaryBoxWidth - 60, yPos + 75);

      // Línea separadora
      doc.strokeColor(primaryBlue).lineWidth(1);
      doc.moveTo(summaryX + 10, yPos + 90).lineTo(summaryX + summaryBoxWidth - 10, yPos + 90).stroke();

      // Total final
      doc.font('Courier-Bold').fontSize(9).fillColor(successGreen);
      doc.text(`TOTAL:`, summaryX + 10, yPos + 98);
      doc.text(`$${grandTotal.toFixed(2)}`, summaryX + summaryBoxWidth - 70, yPos + 98);

      yPos += 130;
      
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
      
      // ...existing code...
      // (REMOVED: duplicate/old generateProfessionalPDF function implementation)
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
    // Use pagination: ?page=1&pageSize=100
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 100, 500); // max 500 per page
    const offset = (page - 1) * pageSize;
    // Get total count for pagination
    const [countRows] = await db.query('SELECT COUNT(*) as total FROM work_orders');
    const total = countRows[0]?.total || 0;
    // Get paginated results
    const [results] = await db.query('SELECT * FROM work_orders ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
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
      // Labor calculation strictly using existing variables
      let totalHrs = 0;
      if (Array.isArray(mechanics) && mechanics.length > 0) {
        totalHrs = mechanics.reduce((sum, m) => sum + (parseFloat(m.hrs) || 0), 0);
      } else if (order.totalHrs) {
        totalHrs = parseFloat(order.totalHrs) || 0;
      }
      // Labor is always totalHrs * 60
      let laborTotal = totalHrs * 60;
      // Use the value from DB for totalLabAndParts, but ensure labor is never omitted
      let totalLabAndParts = Number(order.totalLabAndParts) || 0;
      // If laborTotal is 0 but totalHrs > 0, recalculate laborTotal
      if (laborTotal === 0 && totalHrs > 0) {
        laborTotal = totalHrs * 60;
      }
      // Normalizar fecha a YYYY-MM-DD sin tiempo ni zona
      let normalizedDate = '';
      if (typeof order.date === 'string') {
        const m = order.date.match(/^\d{4}-\d{2}-\d{2}/);
        normalizedDate = m ? m[0] : order.date;
      } else if (order.date) {
        // Evitar conversiones a UTC; confiar en cadena o dejar vacío
        try { normalizedDate = String(order.date).slice(0, 10); } catch { normalizedDate = ''; }
      }
      return {
        ...order,
        date: normalizedDate,
        parts,
        mechanics,
        extraOptions,
        totalHrs,
        laborTotal,
        totalLabAndParts,
        employeeWrittenHours: order.employeeWrittenHours || null
      };
    });
    res.json({ data: parsedResults, total });
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR FETCHING WORK ORDERS');
  }
});

// CREAR ORDEN DE TRABAJO - SIMPLIFICADO EMERGENCIA
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = `CREATE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🚀 [${requestId}] INICIANDO CREACIÓN DE WORK ORDER`);
  console.log(`📊 [${requestId}] Memoria inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  try {
    const fields = req.body;
    console.log(`📝 [${requestId}] Datos recibidos - Parts: ${fields.parts?.length || 0}, Trailer: ${fields.trailer}, Mechanic: ${fields.mechanic}`);
    const parts = fields.parts || [];
    const extraOptions = fields.extraOptions || [];
    const billToCo = fields.billToCo || '';
    const trailer = fields.trailer || '';
    const mechanic = fields.mechanic || '';
    const mechanicsArr = Array.isArray(fields.mechanics) ? fields.mechanics : [];
    // Fecha: aceptar solo YYYY-MM-DD; si no viene, usar la fecha local de hoy como string
    let date = fields.date;
    if (typeof date === 'string') {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        const [mm, dd, yyyy] = date.split('/');
        date = `${yyyy}-${mm}-${dd}`;
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        date = undefined; // formato inválido → usar hoy
      }
    }
    if (!date) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      date = `${yyyy}-${mm}-${dd}`;
    }
    const description = fields.description || '';
    const status = fields.status || 'PENDING';
    const idClassic = fields.idClassic || null;

    // VALIDACIÓN: No permitir crear W.O. si ya existe una para la misma traila en PROCESSING o APPROVED
    if (trailer) {
      const [existing] = await db.query(
        'SELECT id, status, date FROM work_orders WHERE trailer = ? AND (status = "PROCESSING" OR status = "APPROVED")',
        [trailer]
      );
      if (existing && existing.length > 0) {
        return res.status(400).json({
          error: 'Ya existe una Work Order en estado PROCESSING o APPROVED para esta traila.',
          existingWO: existing
        });
      }
    }

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
    const partsTotal = partsArr.reduce((sum, part) => sum + ((Number(part.qty) || 0) * (Number(part.cost) || 0)), 0);
    const subtotal = partsTotal + laborTotal;

    let extra = 0;
    const extras = Array.isArray(extraOptions) ? extraOptions : [];

    // Miscellaneous (editable %)
    let miscPercent = 5;
    if (typeof fields.miscellaneousPercent !== 'undefined' && fields.miscellaneousPercent !== null && fields.miscellaneousPercent !== '') {
      miscPercent = Number(fields.miscellaneousPercent);
    } else if (typeof fields.miscellaneous !== 'undefined' && fields.miscellaneous !== null && fields.miscellaneous !== '') {
      miscPercent = Number(fields.miscellaneous);
    }
    const shopMisc = subtotal * (miscPercent / 100);
    extra += shopMisc;

    // Welding Supplies (editable %)
    let weldPercent = 0;
    if (typeof fields.weldPercent !== 'undefined' && fields.weldPercent !== null && fields.weldPercent !== '') {
      weldPercent = Number(fields.weldPercent);
    }
    if (isNaN(weldPercent)) weldPercent = 0;
    const weldSupplies = subtotal * (weldPercent / 100);
    extra += weldSupplies;

    // Calcula el total final
    let totalLabAndPartsFinal;
    if (
      fields.totalLabAndParts !== undefined &&
      fields.totalLabAndParts !== null &&
      fields.totalLabAndParts !== '' &&
      !isNaN(Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, '')))
    ) {
      // SIEMPRE respeta el valor manual del usuario, aunque sea menor al cálculo automático
      totalLabAndPartsFinal = Number(String(fields.totalLabAndParts).replace(/[^0-9.]/g, ''));
    } else {
      // Usa el cálculo automático
      totalLabAndPartsFinal = subtotal + shopMisc + weldSupplies;
    }
    console.log(`💾 [${requestId}] Preparando inserción en DB...`);
    console.log(`📊 [${requestId}] Memoria antes de DB: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    // INSERTAR EN DB SIMPLE
    const query = `
      INSERT INTO work_orders (billToCo, trailer, mechanic, mechanics, date, description, parts, totalHrs, totalLabAndParts, status, idClassic, extraOptions, miscellaneousPercent, weldPercent, employeeWrittenHours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrsPut, totalLabAndPartsFinal, status, idClassic,
      JSON.stringify(extraOptions || []), miscPercent, weldPercent, fields.employeeWrittenHours || null
    ];
    
    console.log(`🗄️ [${requestId}] Ejecutando query de inserción...`);
    const [result] = await db.query(query, values);
    const id = result.insertId;
    
    console.log(`✅ [${requestId}] WO creada exitosamente - ID: ${id}`);
    console.log(`📊 [${requestId}] Memoria después de DB: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);    // RESPONDER INMEDIATAMENTE
    console.log(`📤 [${requestId}] Enviando respuesta al cliente...`);
    res.status(201).json({
      id: id,
      message: 'Work Order created successfully',
      pdfUrl: `/work-orders/${id}/pdf`
    });
    
    console.log(`⚡ [${requestId}] Respuesta enviada - Tiempo: ${Date.now() - startTime}ms`);
    console.log(`📊 [${requestId}] Memoria antes de FIFO: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

    // TEMPORALMENTE DESHABILITADO - PDF SOLO SE GENERA CUANDO SE SOLICITA
    console.log(`✅ Orden ${id} creada exitosamente - PDF se generará bajo demanda`);

    // Procesar SOLO FIFO (SIN PDF AUTOMÁTICO PARA AHORRAR MEMORIA)
    if (partsArr && partsArr.length > 0) {
      console.log(`🔄 [${requestId}] Iniciando proceso FIFO asíncrono para ${partsArr.length} partes...`);
      
      setImmediate(async () => {
        const fifoStartTime = Date.now();
        const fifoId = `FIFO_${id}_${Date.now()}`;
        
        try {
          console.log(`🔄 [${fifoId}] Iniciando procesamiento FIFO`);
          console.log(`📊 [${fifoId}] Memoria inicial FIFO: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          
          for (let i = 0; i < partsArr.length; i++) {
            const part = partsArr[i];
            console.log(`🔧 [${fifoId}] Procesando parte ${i + 1}/${partsArr.length}: ${part.sku}`);
            
            if (part.sku && part.qty && Number(part.qty) > 0) {
              try {                const result = await registerPartFifo(
                  id,
                  part.sku,
                  part.part || part.description || '',
                  part.qty,
                  part.cost,
                  fields.usuario || 'SYSTEM',
                  part._pendingPartId || null // Pasar el ID de la parte pendiente si existe
                );
                if (result.success) {
                  console.log(`✓ [${fifoId}] Parte ${part.sku} registrada en FIFO`);
                } else {
                  console.error(`✗ [${fifoId}] Error FIFO ${part.sku}: ${result.error}`);
                }
              } catch (error) {
                console.error(`✗ [${fifoId}] Error crítico procesando ${part.sku}:`, error.message);
                console.error(`💀 [${fifoId}] Stack trace:`, error.stack);
              }
            } else {
              console.log(`⚠️ [${fifoId}] Parte saltada (datos inválidos): ${JSON.stringify(part)}`);
            }
            
            // Log de memoria cada 5 partes
            if ((i + 1) % 5 === 0) {
              console.log(`📊 [${fifoId}] Memoria en parte ${i + 1}: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
            }
          }
          
          console.log(`✅ [${fifoId}] FIFO completado - Tiempo: ${Date.now() - fifoStartTime}ms`);
          console.log(`📊 [${fifoId}] Memoria final FIFO: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          console.log(`🏁 [${requestId}] PROCESO COMPLETO - Tiempo total: ${Date.now() - startTime}ms`);
          
        } catch (error) {
          console.error(`💀 [${fifoId}] ERROR CRÍTICO EN PROCESO FIFO:`, error.message);
          console.error(`💀 [${fifoId}] Stack trace completo:`, error.stack);
          console.error(`📊 [${fifoId}] Memoria en error: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          
          // Forzar garbage collection si está disponible
          if (global.gc) {
            console.log(`🧹 [${fifoId}] Ejecutando garbage collection...`);
            global.gc();
            console.log(`📊 [${fifoId}] Memoria después de GC: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          }
        }
      });
    } else {
      console.log(`ℹ️ [${requestId}] No hay partes para procesar FIFO`);
      console.log(`🏁 [${requestId}] PROCESO COMPLETO (sin FIFO) - Tiempo total: ${Date.now() - startTime}ms`);
    }
  } catch (err) {
    console.error(`💀 [${requestId}] ERROR CRÍTICO CREANDO WO:`, err.message);
    console.error(`💀 [${requestId}] Stack trace:`, err.stack);
    console.error(`📊 [${requestId}] Memoria en error: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.error(`⏱️ [${requestId}] Tiempo hasta error: ${Date.now() - startTime}ms`);
    
    // Forzar garbage collection si está disponible
    if (global.gc) {
      console.log(`🧹 [${requestId}] Ejecutando garbage collection en error...`);
      global.gc();
      console.log(`📊 [${requestId}] Memoria después de GC: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    }
    
    res.status(500).json({ 
      error: 'Error al crear la orden de trabajo',
      requestId: requestId,
      errorMessage: err.message
    });
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
      usuario || req.body.usuario || req.headers['x-usuario'] || 'UNKNOWN',
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
  const startTime = Date.now();
  const requestId = `UPDATE_${id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔄 [${requestId}] INICIANDO EDICIÓN DE WORK ORDER ID: ${id}`);
  console.log(`📊 [${requestId}] Memoria inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  // LIMPIAR Y FORMATEAR CAMPOS CRÍTICOS
  let {
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
    idClassic,
    totalLabAndParts,
    miscellaneousPercent,
    weldPercent,
    employeeWrittenHours
  } = fields;

  // Obtener datos actuales de la orden
  const [oldResults] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
  if (!oldResults || oldResults.length === 0) {
    console.log(`❌ [${requestId}] Orden no encontrada`);
    return res.status(404).send('WORK ORDER NOT FOUND');
  }
  const oldData = oldResults[0];

  // Si no se envían partes, usar las actuales
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    try {
      parts = JSON.parse(oldData.parts || '[]');
    } catch { parts = []; }
  }
  // Si no se envían mecánicos, usar los actuales
  if (!fields.mechanics || !Array.isArray(fields.mechanics) || fields.mechanics.length === 0) {
    try {
      fields.mechanics = JSON.parse(oldData.mechanics || '[]');
    } catch { fields.mechanics = []; }
  }

  // 1. Fecha: aceptar solo YYYY-MM-DD; si viene vacía/invalid → preservar la de la DB
  if (typeof date === 'string') {
    const t = date.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
      const [month, day, year] = t.split('/');
      date = `${year}-${month}-${day}`;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      date = t.slice(0, 10);
    } else if (t === '') {
      date = undefined; // no overwriting
    }
  }
  // If no valid date provided, preserve existing DB value (already a string due to dateStrings)
  const oldDateStr = oldData && oldData.date ? String(oldData.date).slice(0,10) : null;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    date = oldDateStr; // keep original
  }

  // 2. Total: asegurar que sea número
  if (typeof totalLabAndParts === 'string') {
    totalLabAndParts = Number(String(totalLabAndParts).replace(/[^0-9.]/g, ''));
  }
  // Si no se envía un total válido, usa el valor actual de la DB
  if ((!totalLabAndParts && totalLabAndParts !== 0) || isNaN(totalLabAndParts)) {
    totalLabAndParts = oldResults && oldResults[0] && oldResults[0].totalLabAndParts ? oldResults[0].totalLabAndParts : 0;
  }

  console.log(`📝 [${requestId}] Datos recibidos - Parts: ${parts?.length || 0}, Status: ${status}, Trailer: ${trailer}, Fecha: ${date}, Total: ${totalLabAndParts}`);
  try {
    console.log(`🔍 [${requestId}] Verificando que la orden exista...`);
    
    // 1. Verifica que la orden exista
    const [oldResults] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!oldResults || oldResults.length === 0) {
      console.log(`❌ [${requestId}] Orden no encontrada`);
      return res.status(404).send('WORK ORDER NOT FOUND');
    }
    
    console.log(`✓ [${requestId}] Orden encontrada - Status actual: ${oldResults[0].status}`);
    console.log(`📊 [${requestId}] Memoria después de consulta: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);    console.log(`🧮 [${requestId}] Procesando y calculando totales...`);
    
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
      
    console.log(`🔧 [${requestId}] Partes procesadas: ${partsArr.length} válidas de ${parts?.length || 0} recibidas`);

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

    // Miscellaneous (editable %)
    let miscPercent = 5;
    if (typeof miscellaneousPercent !== 'undefined' && miscellaneousPercent !== null && miscellaneousPercent !== '') {
      miscPercent = Number(miscellaneousPercent);
    } else if (typeof fields.miscellaneous !== 'undefined' && fields.miscellaneous !== null && fields.miscellaneous !== '') {
      miscPercent = Number(fields.miscellaneous);
    }
    const shopMisc = subtotal * (miscPercent / 100);
    extra += shopMisc;

    // Welding Supplies (editable %)
    let weldPercentFinal = 0;
    if (typeof weldPercent !== 'undefined' && weldPercent !== null && weldPercent !== '') {
      weldPercentFinal = Number(weldPercent);
    } else if (typeof fields.weldPercent !== 'undefined' && fields.weldPercent !== null && fields.weldPercent !== '') {
      weldPercentFinal = Number(fields.weldPercent);
    }
    if (isNaN(weldPercentFinal)) weldPercentFinal = 0;
    const weldSupplies = subtotal * (weldPercentFinal / 100);
    extra += weldSupplies;

    // Calcula el total final
    // Usar SIEMPRE el valor limpio de totalLabAndParts
    let totalLabAndPartsFinal = totalLabAndParts;
    console.log(`💾 [${requestId}] Preparando actualización en DB...`);
    console.log(`📊 [${requestId}] Memoria antes de actualización: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

    // 4. Actualiza la orden en la base de datos
    const mechanicsArr = Array.isArray(fields.mechanics) ? fields.mechanics : [];
  let updateQuery = `
      UPDATE work_orders SET 
        billToCo = ?, trailer = ?, mechanic = ?, mechanics = ?, date = ?, description = ?, parts = ?, totalHrs = ?, totalLabAndParts = ?, status = ?, extraOptions = ?, poClassic = ?, miscellaneousPercent = ?, weldPercent = ?, employeeWrittenHours = ?
    `;
    const updateFields = [
      billToCo, trailer, mechanic, JSON.stringify(mechanicsArr), date, description,
      JSON.stringify(partsArr), totalHrsPut, totalLabAndPartsFinal, status,
      JSON.stringify(extraOptions || []), fields.poClassic || null, miscPercent, weldPercentFinal, employeeWrittenHours || null
    ];
    if (status === 'FINISHED') {
      updateQuery += `, idClassic = ?`;
      updateFields.push(idClassic || null);
    }
    updateQuery += ` WHERE id = ?`;
    updateFields.push(id);

    console.log(`🗄️ [${requestId}] Ejecutando query de actualización...`);
    await db.query(updateQuery, updateFields);
    // AUDIT LOG: Si el único cambio es el estado, registrar solo ese campo
    if (typeof logAccion === 'function') {
      const changes = {};
      if (oldResults[0].status !== status) {
        changes.estado = {
          antes: oldResults[0].status,
          despues: status
        };
      }
      // Si solo cambió el estado, registrar solo ese campo
      if (Object.keys(changes).length === 1) {
        await logAccion(
          usuario || 'SYSTEM',
          'STATUS_CHANGE',
          'work_orders',
          id,
          JSON.stringify({ summary: 'Aprobación de Work Order', changes })
        );
      }
      // Si hay otros cambios, puedes agregar aquí la lógica para registrar el objeto completo si lo deseas
    }
    
    console.log(`✅ [${requestId}] WO actualizada exitosamente`);
    console.log(`📊 [${requestId}] Memoria después de DB: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);    // 5. Responder inmediatamente
    console.log(`📤 [${requestId}] Enviando respuesta al cliente...`);
    res.json({ success: true, id });
    
    console.log(`⚡ [${requestId}] Respuesta enviada - Tiempo: ${Date.now() - startTime}ms`);
    console.log(`📊 [${requestId}] Memoria antes de FIFO: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

    // SOLO PROCESAR FIFO (SIN PDF AUTOMÁTICO PARA AHORRAR MEMORIA)
    if (partsArr && partsArr.length > 0) {
      console.log(`🔄 [${requestId}] Iniciando actualización FIFO asíncrona para ${partsArr.length} partes...`);
      
      setImmediate(async () => {
        const fifoStartTime = Date.now();
        const fifoId = `FIFO_UPDATE_${id}_${Date.now()}`;
        
        try {
          console.log(`🔄 [${fifoId}] Iniciando actualización FIFO`);
          console.log(`📊 [${fifoId}] Memoria inicial FIFO: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          
          // Eliminar partes existentes
          console.log(`🗑️ [${fifoId}] Eliminando partes previas...`);
          try {
            await db.query('DELETE FROM work_order_parts WHERE work_order_id = ?', [id]);
            console.log(`✓ [${fifoId}] Partes previas eliminadas para orden ${id}`);
          } catch (e) {
            console.log(`ℹ️ [${fifoId}] No había partes previas para eliminar`);
          }
          
          console.log(`📊 [${fifoId}] Memoria después de limpieza: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          
          // Registrar nuevas partes en FIFO
          for (let i = 0; i < partsArr.length; i++) {
            const part = partsArr[i];
            console.log(`🔧 [${fifoId}] Actualizando parte ${i + 1}/${partsArr.length}: ${part.sku}`);
            
            if (part.sku && part.qty && Number(part.qty) > 0) {
              try {                const result = await registerPartFifo(
                  id,
                  part.sku,
                  part.part || part.description || '',
                  part.qty,
                  part.cost,
                  fields.usuario || 'SYSTEM',
                  part._pendingPartId || null // Pasar el ID de la parte pendiente si existe
                );
                if (result.success) {
                  console.log(`✓ [${fifoId}] Parte ${part.sku} actualizada en FIFO`);
                } else {
                  console.error(`✗ [${fifoId}] Error FIFO ${part.sku}: ${result.error}`);
                }
              } catch (error) {
                console.error(`✗ [${fifoId}] Error crítico actualizando ${part.sku}:`, error.message);
                console.error(`💀 [${fifoId}] Stack trace:`, error.stack);
              }
            } else {
              console.log(`⚠️ [${fifoId}] Parte saltada (datos inválidos): ${JSON.stringify(part)}`);
            }
            
            // Log de memoria cada 5 partes
            if ((i + 1) % 5 === 0) {
              console.log(`📊 [${fifoId}] Memoria en parte ${i + 1}: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
            }
          }
          
          console.log(`✅ [${fifoId}] FIFO actualizado - Tiempo: ${Date.now() - fifoStartTime}ms`);
          console.log(`📊 [${fifoId}] Memoria final FIFO: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          console.log(`🏁 [${requestId}] ACTUALIZACIÓN COMPLETA - Tiempo total: ${Date.now() - startTime}ms`);
          
        } catch (error) {
          console.error(`💀 [${fifoId}] ERROR CRÍTICO EN ACTUALIZACIÓN FIFO:`, error.message);
          console.error(`💀 [${fifoId}] Stack trace completo:`, error.stack);
          console.error(`📊 [${fifoId}] Memoria en error: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          
          // Forzar garbage collection si está disponible
          if (global.gc) {
            console.log(`🧹 [${fifoId}] Ejecutando garbage collection...`);
            global.gc();
            console.log(`📊 [${fifoId}] Memoria después de GC: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
          }
        }
      });
    } else {
      console.log(`ℹ️ [${requestId}] No hay partes para procesar FIFO`);
      console.log(`🏁 [${requestId}] ACTUALIZACIÓN COMPLETA (sin FIFO) - Tiempo total: ${Date.now() - startTime}ms`);
    }
  } catch (err) {
    console.error(`💀 [${requestId}] ERROR CRÍTICO ACTUALIZANDO WO:`, err.message);
    console.error(`💀 [${requestId}] Stack trace:`, err.stack);
    console.error(`📊 [${requestId}] Memoria en error: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.error(`⏱️ [${requestId}] Tiempo hasta error: ${Date.now() - startTime}ms`);
    
    // Forzar garbage collection si está disponible
    if (global.gc) {
      console.log(`🧹 [${requestId}] Ejecutando garbage collection en error...`);
      global.gc();
      console.log(`📊 [${requestId}] Memoria después de GC: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    }
    
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

// Obtener PDF por ID de orden (desde base de datos) - DESHABILITADO PARA EVITAR CRASHES
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    // Obtener datos completos de la orden para generar PDF actualizado
    const [fullOrder] = await db.query('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!fullOrder || fullOrder.length === 0) {
      return res.status(404).send('WORK ORDER DATA NOT FOUND');
    }
    const order = fullOrder[0];
    try {
      // Generar PDF profesional SIEMPRE con los datos actuales (incluye weldPercent)
      const pdfBuffer = await generateProfessionalPDF(order, id);
      // Enviar el PDF generado SIEMPRE con headers para evitar caché
      const fileName = `workorder_${order.idClassic || id}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      res.send(pdfBuffer);
      console.log(`PDF generado y enviado para orden ${id}`);
      return;
    } catch (pdfError) {
      console.error('Error generando PDF:', pdfError);
      return res.status(500).send('ERROR GENERATING PDF');
    }
  } catch (error) {
    console.error('Error en endpoint PDF:', error);
    res.status(500).json({ 
      error: 'PDF endpoint error',
      message: 'Error accessing PDF functionality'
    });
  }
});

// Regenerar PDF para una orden existente - DESHABILITADO PARA EVITAR CRASHES
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
