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

export const generateWorkOrderPDF = async (workOrderData: WorkOrderData) => {
  const pdf = new jsPDF();
  
  // Establecer fuente Helvetica para mejor legibilidad
  pdf.setFont('helvetica');
  
  // HEADER - Logo y título mejorado
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
      
      // Verificar que el data URL es válido
      if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
        // Logo centrado en el header
        pdf.addImage(logoDataUrl, 'PNG', 85, 10, 40, 20);
        console.log('✅ Logo cargado exitosamente');
      } else {
        throw new Error('Invalid logo data URL');
      }
    } else {
      throw new Error('Logo response not valid');
    }
  } catch (error) {
    console.warn('No se pudo cargar el logo:', error);
    // Fallback: texto JET SHOP centrado
    pdf.setFontSize(16);
    pdf.setTextColor(0, 100, 200);
    pdf.text('JET SHOP', 105, 20, { align: 'center' });
  }
  
  // Título INVOICE centrado y profesional
  pdf.setFontSize(24);
  pdf.setTextColor(0, 100, 200);
  pdf.text('WORK ORDER INVOICE', 105, 40, { align: 'center' });
  
  // Información de la empresa - centrada
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  pdf.text('JET SHOP, LLC', 105, 50, { align: 'center' });
  pdf.text('740 EL CAMINO REAL, GREENFIELD, CA 93927', 105, 56, { align: 'center' });
    
  // INFORMACIÓN DEL CLIENTE Y W.O - Cajas mejoradas y centradas
  const boxY = 70;
  const boxHeight = 45;
  
  // Caja izquierda - Customer y Trailer
  pdf.setDrawColor(0, 100, 200);
  pdf.setLineWidth(1);
  pdf.rect(25, boxY, 75, boxHeight);
  
  // Header de la caja izquierda
  pdf.setFillColor(0, 100, 200);
  pdf.rect(25, boxY, 75, 8, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text('CUSTOMER INFO', 62.5, boxY + 5, { align: 'center' });
  
  // Contenido de la caja izquierda
  pdf.setFontSize(10);
  pdf.setTextColor(0, 100, 200);
  pdf.text('Customer:', 30, boxY + 18);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.customer || ''), 30, boxY + 25);
  
  pdf.setTextColor(0, 100, 200);
  pdf.text('Trailer:', 30, boxY + 35);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.trailer || ''), 30, boxY + 42);
  
  // Caja derecha - Date, Invoice #, Mechanics, ID CLASSIC
  pdf.setDrawColor(0, 100, 200);
  pdf.rect(110, boxY, 75, boxHeight);
  
  // Header de la caja derecha
  pdf.setFillColor(0, 100, 200);
  pdf.rect(110, boxY, 75, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.text('ORDER INFO', 147.5, boxY + 5, { align: 'center' });
  
  // Contenido de la caja derecha
  pdf.setFontSize(10);
  pdf.setTextColor(0, 100, 200);
  pdf.text('Date:', 115, boxY + 18);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.date || ''), 140, boxY + 18);
  
  pdf.setTextColor(0, 100, 200);
  pdf.text('Invoice #:', 115, boxY + 25);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.id || ''), 150, boxY + 25);
  
  pdf.setTextColor(0, 100, 200);
  pdf.text('Mechanics:', 115, boxY + 32);
  pdf.setTextColor(0, 0, 0);
  const mechanicsText = String(workOrderData.mechanics || '');
  const splitMechanics = pdf.splitTextToSize(mechanicsText, 40);
  pdf.text(splitMechanics, 155, boxY + 32);
  
  pdf.setTextColor(0, 100, 200);
  pdf.text('ID Classic:', 115, boxY + 42);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.idClassic || ''), 155, boxY + 42);  
  // DESCRIPCIÓN - mejorada y centrada
  const descY = boxY + boxHeight + 15;
  pdf.setFontSize(12);
  pdf.setTextColor(0, 100, 200);
  pdf.text('Work Description:', 25, descY);
  
  // Caja para descripción
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.rect(25, descY + 5, 160, 20);
  
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  const description = workOrderData.description || '';
  const splitDescription = pdf.splitTextToSize(description, 150);
  pdf.text(splitDescription, 30, descY + 12);
    
  // TABLA DE PARTES - optimizada y profesional
  const tableStartY = descY + 35;
  
  const tableData = workOrderData.parts.map((part, index) => [
    index + 1,
    part.sku || '',
    part.description || '',
    part.um || '',
    part.qty || 0,
    `$${(part.unitCost || 0).toFixed(2)}`,
    `$${(part.total || 0).toFixed(2)}`,
    part.invoice || 'N/A'
  ]);
  
  autoTable(pdf, {
    startY: tableStartY,
    head: [['#', 'SKU', 'DESCRIPTION', 'U/M', 'QTY', 'UNIT COST', 'TOTAL', 'INVOICE']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 100, 200],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [0, 0, 0],
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },   // #
      1: { halign: 'left', cellWidth: 20 },     // SKU
      2: { halign: 'left', cellWidth: 50 },     // DESCRIPTION
      3: { halign: 'center', cellWidth: 15 },   // U/M
      4: { halign: 'center', cellWidth: 15 },   // QTY
      5: { halign: 'right', cellWidth: 25 },    // UNIT COST
      6: { halign: 'right', cellWidth: 25 },    // TOTAL
      7: { halign: 'center', cellWidth: 25 }    // INVOICE
    },
    margin: { left: 25, right: 25 },
    tableLineColor: [0, 100, 200],
    tableLineWidth: 0.5
  });  
  // TOTALES - mejorado y alineado
  const finalY = (pdf as any).lastAutoTable?.finalY || tableStartY + 50;
  const totalsY = finalY + 15;
  
  // Caja para totales
  pdf.setDrawColor(0, 100, 200);
  pdf.setLineWidth(1);
  pdf.rect(130, totalsY - 5, 55, 35);
  
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Subtotal Parts:', 135, totalsY + 5);
  pdf.text(`$${(workOrderData.subtotalParts || 0).toFixed(2)}`, 180, totalsY + 5, { align: 'right' });
  
  pdf.text('Labor Cost:', 135, totalsY + 12);
  pdf.text(`$${(workOrderData.laborCost || 0).toFixed(2)}`, 180, totalsY + 12, { align: 'right' });
  
  // Línea separadora
  pdf.setDrawColor(0, 100, 200);
  pdf.line(135, totalsY + 16, 180, totalsY + 16);
  
  // Total final
  pdf.setFontSize(12);
  pdf.setTextColor(220, 20, 60);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL:', 135, totalsY + 25);
  pdf.text(`$${(workOrderData.totalCost || 0).toFixed(2)}`, 180, totalsY + 25, { align: 'right' });
  
  // Resetear fuente
  pdf.setFont('helvetica', 'normal');
    
  // TERMS & CONDITIONS - mejorado
  const termsY = totalsY + 45;
  
  pdf.setFontSize(11);
  pdf.setTextColor(0, 100, 200);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TERMS & CONDITIONS:', 25, termsY);
  
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  const terms = [
    '• This estimate is not a final bill, pricing could change if job specifications change.',
    '• Payment is due upon completion of work.',
    '• Customer is responsible for any additional costs due to unforeseen complications.'
  ];
  
  terms.forEach((term, index) => {
    pdf.text(term, 25, termsY + 10 + (index * 7));
  });
  
  // AUTHORIZATION - mejorado
  const authY = termsY + 35;
  
  pdf.setFontSize(10);
  pdf.setTextColor(0, 100, 200);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CUSTOMER AUTHORIZATION:', 25, authY);
  
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.text('☐ I accept this estimate without any changes', 25, authY + 10);
  pdf.text('☐ I accept this estimate with the handwritten changes noted below', 25, authY + 18);
  
  // LÍNEAS PARA FIRMAS - mejoradas
  const sigY = authY + 35;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  
  // Línea para nombre
  pdf.line(25, sigY, 95, sigY);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text('CUSTOMER NAME (PRINT)', 25, sigY + 7);
  
  // Línea para firma
  pdf.line(115, sigY, 185, sigY);
  pdf.text('CUSTOMER SIGNATURE', 115, sigY + 7);
  
  // Línea para fecha
  pdf.line(25, sigY + 20, 95, sigY + 20);
  pdf.text('DATE', 25, sigY + 27);
  
  // FOOTER - mejorado y centrado
  const footerY = sigY + 45;
  
  pdf.setFontSize(12);
  pdf.setTextColor(0, 100, 200);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Thank you for choosing JET SHOP!', 105, footerY, { align: 'center' });
  
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont('helvetica', 'normal');
  pdf.text('For questions about this invoice, please contact us at 740 El Camino Real, Greenfield, CA 93927', 105, footerY + 8, { align: 'center' });
  
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
