import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WorkOrderData {
  id: number;
  idClassic: string;
  customer: string;
  trailer: string;
  date: string;
  mechanics: string;
  description: string;
  status?: string;
  parts: Array<{
    sku: string;
    description: string;
    um: string;
    qty: number;
    unitCost: number;
    total: number;
    invoice: string;
    invoiceLink?: string;
  }>;
  laborCost: number;
  subtotalParts: number;
  totalCost: number;
}

// First implementation removed - keeping the improved second implementation

export const generateWorkOrderPDF = async (workOrderData: WorkOrderData) => {
  const pdf = new jsPDF('p', 'mm', 'a4'); // Especificar formato A4
  
  // Configurar fuente
  pdf.setFont('helvetica');
  
  // Márgenes de página (A4: 210mm ancho)
  const pageWidth = 210;
  const leftMargin = 15;
  const rightMargin = 15;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 180mm
  
  // HEADER CENTRADO Y SIN DESBORDAMIENTO
  try {
    // Cargar logo desde el backend
    const logoResponse = await fetch('/api/assets/logo.png');
    if (logoResponse.ok && logoResponse.headers.get('content-type')?.includes('image')) {
      const logoBlob = await logoResponse.blob();
      const logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error reading logo file'));
        reader.readAsDataURL(logoBlob);
      });
      
      if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
        // Logo centrado en el lado izquierdo
        pdf.addImage(logoDataUrl, 'PNG', leftMargin, 15, 35, 20);
        console.log('✅ Logo cargado exitosamente');
      } else {
        throw new Error('Invalid logo data URL');
      }
    } else {
      throw new Error('Logo response not valid');
    }
  } catch (error) {
    console.warn('No se pudo cargar el logo:', error);
    // Fallback: texto JET SHOP
    pdf.setFontSize(14);
    pdf.setTextColor(0, 100, 200);
    pdf.text('JET SHOP', leftMargin, 28);
  }
  
  // TÍTULO "INVOICE" perfectamente centrado
  pdf.setFontSize(28);
  pdf.setTextColor(0, 150, 255);
  pdf.text('INVOICE', pageWidth / 2, 30, { align: 'center' });
  
  // INFORMACIÓN DE LA EMPRESA alineada a la derecha
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text('JET SHOP, LLC', pageWidth - rightMargin, 18, { align: 'right' });
  pdf.text('740 EL CAMINO REAL', pageWidth - rightMargin, 24, { align: 'right' });
  pdf.text('GREENFIELD, CA 93927', pageWidth - rightMargin, 30, { align: 'right' });
  
  // CAJAS PRINCIPALES - CENTRADAS Y BALANCEADAS
  const firstRowY = 45;
  const boxHeight = 30;
  const leftBoxWidth = 80;
  const rightBoxWidth = 80;
  const gapBetweenBoxes = 10;
  
  // Calcular posiciones para centrar ambas cajas
  const totalBoxesWidth = leftBoxWidth + gapBetweenBoxes + rightBoxWidth;
  const boxesStartX = (pageWidth - totalBoxesWidth) / 2;
  
  // CAJA IZQUIERDA - Customer y Trailer
  pdf.setDrawColor(0, 150, 255);
  pdf.setLineWidth(0.8);
  pdf.rect(boxesStartX, firstRowY, leftBoxWidth, boxHeight);
  
  // Contenido caja izquierda
  pdf.setFontSize(10);
  pdf.setTextColor(0, 150, 255);
  pdf.text('Customer:', boxesStartX + 3, firstRowY + 8);
  pdf.setTextColor(0, 0, 0);
  const customerText = String(workOrderData.customer || '');
  pdf.text(customerText.length > 15 ? customerText.substring(0, 15) + '...' : customerText, 
           boxesStartX + 3, firstRowY + 15);
  
  pdf.setTextColor(0, 150, 255);
  pdf.text('Trailer:', boxesStartX + 3, firstRowY + 22);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.trailer || ''), boxesStartX + 3, firstRowY + 28);
    // CAJA DERECHA - Date, Invoice #, ID Classic, Mechanics, Status
  const rightBoxX = boxesStartX + leftBoxWidth + gapBetweenBoxes;
  pdf.setDrawColor(0, 150, 255);
  pdf.rect(rightBoxX, firstRowY, rightBoxWidth, boxHeight);
  
  // Contenido caja derecha
  pdf.setFontSize(10);
  pdf.setTextColor(0, 150, 255);
  pdf.text('Date:', rightBoxX + 3, firstRowY + 6);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.date || ''), rightBoxX + 25, firstRowY + 6);
  
  pdf.setTextColor(0, 150, 255);
  pdf.text('Invoice #:', rightBoxX + 3, firstRowY + 12);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.id || ''), rightBoxX + 25, firstRowY + 12);
  
  pdf.setTextColor(0, 150, 255);
  pdf.text('ID Classic:', rightBoxX + 3, firstRowY + 18);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.idClassic || ''), rightBoxX + 25, firstRowY + 18);
  
  pdf.setTextColor(0, 150, 255);
  pdf.text('Mechanics:', rightBoxX + 3, firstRowY + 24);
  pdf.setTextColor(0, 0, 0);
  const mechanicsText = String(workOrderData.mechanics || '');
  // Usar splitTextToSize para que el texto se ajuste al ancho disponible
  const splitMechanics = pdf.splitTextToSize(mechanicsText, rightBoxWidth - 28);
  pdf.text(splitMechanics, rightBoxX + 25, firstRowY + 24);
  
  // STATUS - Agregar después de las cajas principales
  const statusY = firstRowY + boxHeight + 6;
  pdf.setFontSize(10);
  pdf.setTextColor(0, 150, 255);
  pdf.text('STATUS:', rightBoxX + 3, statusY);
  pdf.setTextColor(0, 0, 0);
  
  // Resaltar el status según su valor
  const status = String(workOrderData.status || 'PROCESSING');
  if (status === 'FINISHED') {
    pdf.setTextColor(0, 150, 0); // Verde para FINISHED
  } else if (status === 'APPROVED') {
    pdf.setTextColor(255, 165, 0); // Naranja para APPROVED
  } else {
    pdf.setTextColor(255, 0, 0); // Rojo para PROCESSING
  }
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(status, rightBoxX + 25, statusY);
  
  // Resetear estilo
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
    // DESCRIPCIÓN
  const descY = firstRowY + boxHeight + 18; // Aumentar espacio para el status
  pdf.setFontSize(10);
  pdf.setTextColor(0, 150, 255);
  pdf.text('Description:', leftMargin, descY);
  
  // Descripción del trabajo - con control de ancho
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  const description = workOrderData.description || '';
  const splitDescription = pdf.splitTextToSize(description, contentWidth - 20);
  pdf.text(splitDescription, leftMargin, descY + 6);
  
  // TABLA DE PARTES - CENTRADA Y SIN DESBORDAMIENTO
  const tableStartY = descY + 20;
  const tableData = workOrderData.parts.map((part, index) => [
    String(index + 1),
    String(part.sku || '').substring(0, 12), // Limitar SKU
    String(part.description || '').substring(0, 30), // Limitar descripción
    String(part.um || 'EA'),
    String(part.qty || 0),
    `$${(part.unitCost || 0).toFixed(2)}`,
    `$${(part.total || 0).toFixed(2)}`,
    part.invoiceLink ? 'LINK' : 'N/A'
  ]);
  autoTable(pdf, {
    startY: tableStartY,
    head: [['No.', 'SKU', 'DESCRIPTION', 'U/M', 'QTY', 'UNIT COST', 'TOTAL', 'INVOICE']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [0, 0, 0],
      cellPadding: 1.5,
      overflow: 'ellipsize'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },    // No.
      1: { halign: 'center', cellWidth: 22 },    // SKU
      2: { halign: 'left', cellWidth: 50 },      // DESCRIPTION
      3: { halign: 'center', cellWidth: 12 },    // U/M
      4: { halign: 'center', cellWidth: 12 },    // QTY
      5: { halign: 'right', cellWidth: 25 },     // UNIT COST
      6: { halign: 'right', cellWidth: 25 },     // TOTAL
      7: { halign: 'center', cellWidth: 22 }     // INVOICE
    },
    margin: { left: leftMargin, right: rightMargin },
    tableLineColor: [66, 139, 202],
    tableLineWidth: 0.3,
    styles: {
      lineColor: [66, 139, 202],
      lineWidth: 0.3,
      cellPadding: 1.5
    },
    didDrawCell: function(data) {
      // Hacer enlaces clickeables en la columna INVOICE (columna 7)
      if (data.column.index === 7 && data.cell.section === 'body') {
        const part = workOrderData.parts[data.row.index];
        if (part.invoiceLink) {
          // Agregar enlace clickeable
          pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: part.invoiceLink });
          // Cambiar color del texto para indicar que es un enlace
          pdf.setTextColor(0, 100, 200);
          pdf.setFont('helvetica', 'underline');
          pdf.text('LINK', data.cell.x + data.cell.width/2, data.cell.y + data.cell.height/2 + 1, { align: 'center' });
        }
      }
    }
  });
  
  // TOTALES - ALINEADOS A LA DERECHA SIN DESBORDAMIENTO
  const finalY = (pdf as any).lastAutoTable?.finalY || tableStartY + 50;
  const totalsY = finalY + 8;
  const totalsStartX = pageWidth - rightMargin - 60; // 60mm para los totales
  
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  
  // Subtotal Parts
  pdf.text('Subtotal Parts:', totalsStartX, totalsY);
  pdf.text(`$${(workOrderData.subtotalParts || 0).toFixed(2)}`, pageWidth - rightMargin, totalsY, { align: 'right' });
  
  // Labor
  pdf.text('Labor:', totalsStartX, totalsY + 6);
  pdf.text(`$${(workOrderData.laborCost || 0).toFixed(2)}`, pageWidth - rightMargin, totalsY + 6, { align: 'right' });
  
  // Línea separadora
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.line(totalsStartX, totalsY + 9, pageWidth - rightMargin, totalsY + 9);
  
  // TOTAL (en rojo)
  pdf.setFontSize(11);
  pdf.setTextColor(220, 20, 60);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL LAB & PARTS:', totalsStartX, totalsY + 15);
  pdf.text(`$${(workOrderData.totalCost || 0).toFixed(2)}`, pageWidth - rightMargin, totalsY + 15, { align: 'right' });
  
  // Resetear fuente
  pdf.setFont('helvetica', 'normal');
  
  // TERMS & CONDITIONS
  const termsY = totalsY + 25;
  
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TERMS & CONDITIONS:', leftMargin, termsY);
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const terms = [
    'This estimate is not a final bill, pricing could change if job specifications change.',
    'Payment is due upon completion of work.',
    'Customer is responsible for any additional costs due to unforeseen complications.'
  ];
  
  terms.forEach((term, index) => {
    const splitTerm = pdf.splitTextToSize(term, contentWidth);
    pdf.text(splitTerm, leftMargin, termsY + 6 + (index * 6));
  });
  
  // CUSTOMER AUTHORIZATION
  const authY = termsY + 25;
  
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text('☐ I accept this estimate without any changes', leftMargin, authY);
  pdf.text('☐ I accept this estimate with the handwritten changes noted below', leftMargin, authY + 6);
  
  // LÍNEAS PARA FIRMAS - CENTRADAS
  const sigY = authY + 18;
  const lineWidth = 70;
  const gapBetweenLines = 20;
  const linesStartX = (pageWidth - (lineWidth * 2 + gapBetweenLines)) / 2;
  
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  
  // Línea para nombre
  pdf.line(linesStartX, sigY, linesStartX + lineWidth, sigY);
  pdf.setFontSize(7);
  pdf.text('NAME:', linesStartX, sigY + 5);
  
  // Línea para firma
  const secondLineX = linesStartX + lineWidth + gapBetweenLines;
  pdf.line(secondLineX, sigY, secondLineX + lineWidth, sigY);
  pdf.text('SIGNATURE:', secondLineX, sigY + 5);
  
  // FOOTER CENTRADO
  const footerY = sigY + 15;
  
  pdf.setFontSize(11);
  pdf.setTextColor(0, 150, 255);
  pdf.setFont('helvetica', 'italic');
  pdf.text('Thanks for your business!', pageWidth / 2, footerY, { align: 'center' });
  
  return pdf;
};

export const savePDFToDatabase = async (workOrderId: number, pdfBlob: Blob) => {
  try {
    const formData = new FormData();
    formData.append('pdf', pdfBlob, `work_order_${workOrderId}.pdf`);
    
    const response = await fetch(`/api/work-orders/${workOrderId}/pdf`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Error saving PDF: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📄 PDF guardado en BD:', result);
    return result;
  } catch (error) {
    console.error('❌ Error guardando PDF en BD:', error);
    throw error;
  }
};

export const openInvoiceLinks = (parts: Array<{ invoiceLink?: string; invoice?: string }>) => {
  // Obtener enlaces únicos
  const uniqueLinks = new Set<string>();
  
  parts.forEach(part => {
    if (part.invoiceLink && part.invoiceLink.trim()) {
      uniqueLinks.add(part.invoiceLink.trim());
    }
  });
  
  console.log(`📄 Abriendo ${uniqueLinks.size} enlaces únicos de facturas`);
  
  // Abrir cada enlace en una pestaña nueva
  Array.from(uniqueLinks).forEach((link, index) => {
    setTimeout(() => {
      window.open(link, '_blank', 'noopener,noreferrer');
    }, index * 100); // Pequeño delay para evitar problemas de popup blocker
  });
};

export const downloadPDF = (pdf: jsPDF, filename: string) => {
  pdf.save(filename);
};

// Función para abrir PDF en nueva pestaña sin descargarlo
export const openPDFInNewTab = (pdf: jsPDF, filename: string = 'work_order.pdf') => {
  try {
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Abrir en nueva pestaña
    const newWindow = window.open(pdfUrl, '_blank');
    
    if (newWindow) {
      console.log('✅ PDF abierto en nueva pestaña:', filename);
      
      // Limpiar la URL del objeto después de un tiempo para liberar memoria
      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 60000); // 1 minuto
    } else {
      console.warn('⚠️ No se pudo abrir nueva pestaña, posible bloqueador de popups');
      // Fallback: descargar si no se puede abrir
      downloadPDF(pdf, filename);
    }
  } catch (error) {
    console.error('❌ Error abriendo PDF en nueva pestaña:', error);
    // Fallback: descargar si hay error
    downloadPDF(pdf, filename);
  }
};
