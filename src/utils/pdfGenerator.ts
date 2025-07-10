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

export const generateWorkOrderPDF = (workOrderData: WorkOrderData) => {
  const pdf = new jsPDF();
  
  // HEADER - Logo y título
  pdf.setFontSize(20);
  pdf.setTextColor(0, 100, 200);
  pdf.text('JET SHOP', 20, 25);
  
  pdf.setFontSize(28);
  pdf.setTextColor(0, 100, 200);
  pdf.text('INVOICE', 105, 25, { align: 'center' });
  
  // Información de la empresa
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text('JET SHOP, LLC', 150, 20);
  pdf.text('740 EL CAMINO REAL', 150, 25);
  pdf.text('GREENFIELD, CA 93927', 150, 30);
  
  // INFORMACIÓN DEL CLIENTE Y W.O - Cajas con bordes
  // Caja izquierda - Customer y Trailer
  pdf.setDrawColor(0, 100, 200);
  pdf.rect(20, 40, 85, 35);
    pdf.setFontSize(12);
  pdf.setTextColor(0, 100, 200);
  pdf.text('Customer:', 25, 50);
  pdf.setTextColor(0, 0, 0);
  pdf.text(workOrderData.customer || '', 25, 55);
  
  pdf.setTextColor(0, 100, 200);
  pdf.text('Trailer:', 25, 65);
  pdf.setTextColor(0, 0, 0);
  pdf.text(workOrderData.trailer || '', 25, 70);
  
  // Caja derecha - Date, Invoice #, Mechanics, ID CLASSIC
  pdf.rect(110, 40, 85, 35);
    pdf.setTextColor(0, 100, 200);
  pdf.text('Date:', 115, 50);
  pdf.setTextColor(0, 0, 0);
  pdf.text(workOrderData.date || '', 115, 55);
  
  pdf.setTextColor(0, 100, 200);
  pdf.text('Invoice #:', 115, 60);
  pdf.setTextColor(0, 0, 0);
  pdf.text(workOrderData.idClassic || workOrderData.id.toString(), 115, 65);
  
  pdf.setTextColor(0, 100, 200);
  pdf.text('Mechanics:', 115, 70);
  pdf.setTextColor(0, 0, 0);
  pdf.text(workOrderData.mechanics || '', 115, 75);
  
  pdf.setTextColor(0, 100, 200);
  pdf.text('ID CLASSIC:', 150, 50);
  pdf.setTextColor(0, 0, 0);
  pdf.text(workOrderData.idClassic || '', 150, 55);
  
  // DESCRIPCIÓN
  pdf.setFontSize(12);
  pdf.setTextColor(0, 100, 200);
  pdf.text('Description:', 20, 90);
    pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  const description = workOrderData.description || '';
  const splitDescription = pdf.splitTextToSize(description, 175);
  pdf.text(splitDescription, 20, 95);
  
  // TABLA DE PARTES
  const tableData = workOrderData.parts.map((part, index) => [
    index + 1,
    part.sku,
    part.description,
    part.um,
    part.qty,
    `$${part.unitCost.toFixed(2)}`,
    `$${part.total.toFixed(2)}`,
    part.invoice || 'Ver Invoice'
  ]);
    autoTable(pdf, {
    startY: 110,
    head: [['No.', 'SKU', 'DESCRIPTION', 'U/M', 'QTY', 'UNIT COST', 'TOTAL', 'INVOICE']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [173, 216, 230],
      textColor: [0, 0, 0],
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left', cellWidth: 25 },
      2: { halign: 'left', cellWidth: 50 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'right', cellWidth: 25 },
      7: { halign: 'center', cellWidth: 25 }
    },
    margin: { left: 20, right: 20 }
  });
  
  // TOTALES
  const finalY = (pdf as any).autoTable.previous.finalY + 10;
  
  pdf.setFontSize(12);
  pdf.text(`Subtotal Parts: $${workOrderData.subtotalParts.toFixed(2)}`, 140, finalY);
  pdf.text(`Labor: $${workOrderData.laborCost.toFixed(2)}`, 140, finalY + 8);
  
  pdf.setFontSize(14);
  pdf.setTextColor(220, 20, 60);
  pdf.text(`TOTAL LAB & PARTS: $${workOrderData.totalCost.toFixed(2)}`, 140, finalY + 20);
  
  // TERMS & CONDITIONS
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text('TERMS & CONDITIONS:', 20, finalY + 40);
  pdf.setFontSize(8);
  pdf.text('This estimate is not a final bill, pricing could change if job specifications change.', 20, finalY + 48);
  pdf.text('I accept this estimate without any changes', 20, finalY + 60);
  pdf.text('I accept this estimate with the handwritten changes', 20, finalY + 72);
  
  // LÍNEAS PARA FIRMAS
  pdf.line(20, finalY + 85, 120, finalY + 85);
  pdf.line(140, finalY + 85, 190, finalY + 85);
  pdf.text('NAME:', 20, finalY + 92);
  pdf.text('SIGNATURE:', 140, finalY + 92);
  
  // FOOTER
  pdf.setFontSize(12);
  pdf.setTextColor(0, 100, 200);
  pdf.text('Thanks for your business!', 105, finalY + 110, { align: 'center' });
  
  return pdf;
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
