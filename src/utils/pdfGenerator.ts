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

// First implementation removed - keeping the improved second implementation

export const generateWorkOrderPDF = async (workOrderData: WorkOrderData) => {
  const pdf = new jsPDF();
  
  // Configurar fuente
  pdf.setFont('helvetica');
  
  // HEADER EXACTO COMO LA IMAGEN 1
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
        // Logo en posición exacta como imagen 1 (izquierda superior)
        pdf.addImage(logoDataUrl, 'PNG', 20, 15, 40, 25);
        console.log('✅ Logo cargado exitosamente');
      } else {
        throw new Error('Invalid logo data URL');
      }
    } else {
      throw new Error('Logo response not valid');
    }
  } catch (error) {
    console.warn('No se pudo cargar el logo:', error);
    // Fallback: texto JET SHOP en la posición del logo
    pdf.setFontSize(16);
    pdf.setTextColor(0, 100, 200);
    pdf.text('JET SHOP', 20, 30);
  }
  
  // TÍTULO "INVOICE" en el centro exacto como imagen 1
  pdf.setFontSize(30);
  pdf.setTextColor(0, 150, 255);
  pdf.text('INVOICE', 105, 35, { align: 'center' });
  
  // INFORMACIÓN DE LA EMPRESA en la esquina superior derecha exacto como imagen 1
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text('JET SHOP, LLC', 150, 20);
  pdf.text('740 EL CAMINO REAL', 150, 26);
  pdf.text('GREENFIELD, CA 93927', 150, 32);
  
  // PRIMERA FILA DE CAJAS (Customer/Trailer a la izquierda, Date/Invoice#/Mechanics/ID a la derecha)
  const firstRowY = 50;
  const boxHeight = 35;
  
  // CAJA IZQUIERDA - Customer y Trailer (exacto como imagen 1)
  pdf.setDrawColor(0, 150, 255);
  pdf.setLineWidth(1);
  pdf.rect(20, firstRowY, 85, boxHeight);
  
  // Contenido caja izquierda
  pdf.setFontSize(11);
  pdf.setTextColor(0, 150, 255);
  pdf.text('Customer:', 25, firstRowY + 10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.customer || ''), 25, firstRowY + 18);
  
  pdf.setTextColor(0, 150, 255);
  pdf.text('Trailer:', 25, firstRowY + 26);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.trailer || ''), 25, firstRowY + 32);
  
  // CAJA DERECHA - Date, Invoice #, Mechanics, ID Classic (exacto como imagen 1)
  pdf.setDrawColor(0, 150, 255);
  pdf.rect(115, firstRowY, 75, boxHeight);
  
  // Contenido caja derecha
  pdf.setFontSize(11);
  pdf.setTextColor(0, 150, 255);
  pdf.text('Date:', 120, firstRowY + 10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.date || ''), 155, firstRowY + 10);
  
  pdf.setTextColor(0, 150, 255);
  pdf.text('Invoice #:', 120, firstRowY + 18);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.id || ''), 155, firstRowY + 18);
  
  pdf.setTextColor(0, 150, 255);
  pdf.text('Mechanics:', 120, firstRowY + 26);
  pdf.setTextColor(0, 0, 0);
  const mechanicsText = String(workOrderData.mechanics || '');
  pdf.text(mechanicsText, 155, firstRowY + 26);
  
  pdf.setTextColor(0, 150, 255);
  pdf.text('ID Classic:', 120, firstRowY + 34);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.idClassic || ''), 155, firstRowY + 34);
  
  // DESCRIPCIÓN (exacto como imagen 1)
  const descY = firstRowY + boxHeight + 15;
  pdf.setFontSize(11);
  pdf.setTextColor(0, 150, 255);
  pdf.text('Description:', 20, descY);
  
  // Descripción del trabajo
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  const description = workOrderData.description || '';
  const splitDescription = pdf.splitTextToSize(description, 170);
  pdf.text(splitDescription, 20, descY + 8);
  
  // TABLA DE PARTES (exacto como imagen 1 - formato correcto)
  const tableStartY = descY + 25;
  
  const tableData = workOrderData.parts.map((part, index) => [
    String(index + 1),
    String(part.sku || ''),
    String(part.description || ''),
    String(part.um || 'EA'),
    String(part.qty || 0),
    `$${(part.unitCost || 0).toFixed(2)}`,
    `$${(part.total || 0).toFixed(2)}`,
    String(part.invoice || 'Ver Invoice')
  ]);
  
  autoTable(pdf, {
    startY: tableStartY,
    head: [['No.', 'SKU', 'DESCRIPTION', 'U/M', 'QTY', 'UNIT COST', 'TOTAL', 'INVOICE']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [66, 139, 202], // Color azul exacto como imagen 1
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
      cellPadding: 2
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },    // No.
      1: { halign: 'center', cellWidth: 25 },    // SKU
      2: { halign: 'left', cellWidth: 55 },      // DESCRIPTION
      3: { halign: 'center', cellWidth: 15 },    // U/M
      4: { halign: 'center', cellWidth: 15 },    // QTY
      5: { halign: 'right', cellWidth: 25 },     // UNIT COST
      6: { halign: 'right', cellWidth: 25 },     // TOTAL
      7: { halign: 'center', cellWidth: 25 }     // INVOICE
    },
    margin: { left: 20, right: 20 },
    tableLineColor: [66, 139, 202],
    tableLineWidth: 0.5,
    styles: {
      lineColor: [66, 139, 202],
      lineWidth: 0.5
    }
  });
  
  // TOTALES (posición exacta como imagen 1 - esquina inferior derecha)
  const finalY = (pdf as any).lastAutoTable?.finalY || tableStartY + 60;
  const totalsY = finalY + 10;
  
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  
  // Subtotal Parts
  pdf.text('Subtotal Parts:', 140, totalsY);
  pdf.text(`$${(workOrderData.subtotalParts || 0).toFixed(2)}`, 185, totalsY, { align: 'right' });
  
  // Labor
  pdf.text('Labor:', 140, totalsY + 8);
  pdf.text(`$${(workOrderData.laborCost || 0).toFixed(2)}`, 185, totalsY + 8, { align: 'right' });
  
  // Línea separadora
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(140, totalsY + 12, 185, totalsY + 12);
  
  // TOTAL (en rojo como imagen 1)
  pdf.setFontSize(12);
  pdf.setTextColor(220, 20, 60);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL LAB & PARTS:', 140, totalsY + 20);
  pdf.text(`$${(workOrderData.totalCost || 0).toFixed(2)}`, 185, totalsY + 20, { align: 'right' });
  
  // Resetear fuente
  pdf.setFont('helvetica', 'normal');
  
  // TERMS & CONDITIONS (exacto como imagen 1)
  const termsY = totalsY + 35;
  
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TERMS & CONDITIONS:', 20, termsY);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('This estimate is not a final bill, pricing could change if job specifications change.', 20, termsY + 8);
  pdf.text('Payment is due upon completion of work.', 20, termsY + 15);
  pdf.text('Customer is responsible for any additional costs due to unforeseen complications.', 20, termsY + 22);
  
  // CUSTOMER AUTHORIZATION (exacto como imagen 1)
  const authY = termsY + 35;
  
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text('☐ I accept this estimate without any changes', 20, authY);
  pdf.text('☐ I accept this estimate with the handwritten changes noted below', 20, authY + 8);
  
  // LÍNEAS PARA FIRMAS (exacto como imagen 1)
  const sigY = authY + 25;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  
  // Línea para nombre
  pdf.line(20, sigY, 100, sigY);
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text('NAME:', 20, sigY + 7);
  
  // Línea para firma
  pdf.line(120, sigY, 190, sigY);
  pdf.text('SIGNATURE:', 120, sigY + 7);
  
  // FOOTER (exacto como imagen 1)
  const footerY = sigY + 25;
  
  pdf.setFontSize(12);
  pdf.setTextColor(0, 150, 255);
  pdf.setFont('helvetica', 'italic');
  pdf.text('Thanks for your business!', 105, footerY, { align: 'center' });
  
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
