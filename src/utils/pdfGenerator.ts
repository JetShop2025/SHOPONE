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
  totalHrs?: number;
  laborRate?: number;
  parts: Array<{
    sku: string;
    description: string;
    um: string;
    qty: number;
    unitCost: number;
    total: number;
    invoiceLink?: string;
  }>;
  laborCost: number;
  subtotalParts: number;
  totalCost: number;
  extraOptions?: string[];
  miscellaneousPercent?: number;
  weldPercent?: number;
}

// First implementation removed - keeping the improved second implementation

export const generateWorkOrderPDF = async (workOrderData: WorkOrderData) => {
  const pdf = new jsPDF('p', 'mm', 'a4'); // Especificar formato A4
  
  // Configurar fuente a Courier New
  pdf.setFont('courier');
  
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
  // Format date to MM/DD/YYYY before rendering
  const formatDateMMDDYYYY = (date: string | undefined): string => {
    if (!date) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-');
      return `${month}/${day}/${year}`;
    }
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    }
    return date;
  };
  pdf.text(formatDateMMDDYYYY(workOrderData.date), rightBoxX + 25, firstRowY + 6);
  
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
  
  // Handle both array and string formats for mechanics
  let mechanicsText = '';
  if (Array.isArray((workOrderData as any).mechanics)) {
    // If it's an array of mechanic objects, extract names and hours
    mechanicsText = (workOrderData as any).mechanics
      .map((m: any) => {
        const hrs = Number(m.hrs) || 0;
        return `${m.name} (${hrs}h)`;
      })
      .filter((text: string) => text.trim() !== '() (0h)')
      .join(', ');
  } else {
    // If it's a string, use it directly
    mechanicsText = String(workOrderData.mechanics || '');
  }
  
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
  if (status === 'PROCESSING') {
    pdf.setTextColor(128, 128, 128); // Gris para PROCESSING
  } else if (status === 'APPROVED') {
    pdf.setTextColor(0, 128, 0); // Verde para APPROVED
  } else if (status === 'FINISHED') {
    pdf.setTextColor(255, 200, 0); // Amarillo para FINISHED
  } else if (status === 'MISSING PARTS') {
    pdf.setTextColor(255, 0, 0); // Rojo para MISSING PARTS
  } else {
    pdf.setTextColor(0, 0, 0); // Negro por defecto
  }
  pdf.setFontSize(12);
  pdf.setFont('courier', 'bold');
  pdf.text(status, rightBoxX + 25, statusY);
  
  // Resetear estilo
  pdf.setFont('courier', 'normal');
  pdf.setTextColor(0, 0, 0);
  // DESCRIPCIÓN
  const descY = firstRowY + boxHeight + 18; // Aumentar espacio para el status
  pdf.setFontSize(10);
  pdf.setTextColor(0, 150, 255);
  pdf.text('Description:', leftMargin, descY);
  
  // Descripción del trabajo - con control de ancho y altura dinámica
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  const description = workOrderData.description || '';
  const splitDescription = pdf.splitTextToSize(description, contentWidth - 10);
  
  // Calcular la altura necesaria para la descripción
  const lineHeight = 4; // Altura de línea en mm
  const descriptionHeight = splitDescription.length * lineHeight;
  
  // Renderizar la descripción completa
  pdf.text(splitDescription, leftMargin, descY + 6);
    // TABLA DE PARTES - CENTRADA Y SIN DESBORDAMIENTO
  // Ajustar posición de tabla según altura de la descripción
  const tableStartY = descY + 20 + descriptionHeight;
  const tableData = workOrderData.parts.map((part, index) => [
    String(index + 1),
    String(part.sku || '').replace(/\s+/g, '').substring(0, 20), // SKU limpio (sin saltos)
    String(part.description || '').replace(/\s+/g, ' ').trim(), // Descripción limpia
    String(part.um || 'EA'),
    String(part.qty || 0),
    `$${(part.unitCost || 0).toFixed(2)}`,
    `$${(part.total || 0).toFixed(2)}`,
    part.invoiceLink ? 'LINK' : '' // Clickeable si hay invoiceLink
  ]);
  autoTable(pdf, {
    startY: tableStartY,
    head: [['#', 'SKU', 'DESCRIPTION', 'U/M', 'QTY', 'UNIT $', 'TOTAL', 'LINK']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      overflow: 'hidden',
      cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
      font: 'courier'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [0, 0, 0],
      cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
      overflow: 'ellipsize',
      font: 'courier'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 6 },      // #
      1: { halign: 'center', cellWidth: 22 },     // SKU
      2: { halign: 'left', cellWidth: 80, overflow: 'linebreak' }, // DESCRIPTION (1 línea normalmente, 2 si requiere)
      3: { halign: 'center', cellWidth: 10 },     // U/M
      4: { halign: 'center', cellWidth: 10 },     // QTY
      5: { halign: 'right', cellWidth: 19 },      // UNIT $
      6: { halign: 'right', cellWidth: 19 },      // TOTAL
      7: { halign: 'center', cellWidth: 14 }      // LINK
    },
    margin: { left: leftMargin, right: rightMargin },
    tableWidth: contentWidth,
    tableLineColor: [66, 139, 202],
    tableLineWidth: 0.3,
    styles: {
      lineColor: [66, 139, 202],
      lineWidth: 0.3,
      cellPadding: 1,
      font: 'courier'
    },
    didDrawCell: function(data) {
      // Hacer enlaces clickeables en la columna LINK (columna 7)
      if (data.column.index === 7 && data.cell.section === 'body') {
        const part = workOrderData.parts[data.row.index];
        if (part.invoiceLink) {
          // Agregar solo el link clickeable
          pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: part.invoiceLink });
        }
      }
    },
    didParseCell: function(data) {
      // Aplicar color azul al texto del LINK cuando hay invoiceLink
      if (data.column.index === 7 && data.cell.section === 'body') {
        const part = workOrderData.parts[data.row.index];
        if (part.invoiceLink) {
          data.cell.styles.textColor = [0, 102, 204];
          data.cell.styles.fontStyle = 'bold';
        }
      }

      // Permitir máximo 2 líneas en DESCRIPTION cuando el texto es extenso
      if (data.column.index === 2 && data.cell.section === 'body') {
        const cellText = Array.isArray(data.cell.text) ? data.cell.text : [String(data.cell.text || '')];
        if (cellText.length > 2) {
          data.cell.text = [cellText[0], `${cellText[1]}...`];
        }
      }
    }
  });
  // TOTALES Y EXTRAS - ALINEADOS A LA DERECHA SIN DESBORDAMIENTO
  const finalY = (pdf as any).lastAutoTable?.finalY || tableStartY + 50;
  const totalsStartX = pageWidth - rightMargin - 70; // 70mm para los totales y extras
  let currentY = finalY + 8;
  
  const extraOptions = workOrderData.extraOptions || [];
  const subtotal = (workOrderData.subtotalParts || 0) + (workOrderData.laborCost || 0);
  
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  const laborRate = Number(workOrderData.laborRate ?? 60);
  const laborHours = Number(workOrderData.totalHrs ?? (laborRate > 0 ? ((workOrderData.laborCost || 0) / laborRate) : 0));
  
  // Subtotal Parts
  pdf.text('Subtotal Parts:', totalsStartX, currentY);
  pdf.text(`$${(workOrderData.subtotalParts || 0).toFixed(2)}`, pageWidth - rightMargin, currentY, { align: 'right' });
  currentY += 6;
  
  // Labor (desglose de horas x tarifa)
  pdf.text(`Labor (${laborHours.toFixed(2)}h x $${laborRate.toFixed(2)}/h):`, totalsStartX, currentY);
  pdf.text(`$${(workOrderData.laborCost || 0).toFixed(2)}`, pageWidth - rightMargin, currentY, { align: 'right' });
  currentY += 6;
  
  // EXTRAS - Integrados con los totales
  // Prioridad: percentages explícitos enviados desde formulario -> fallback a extraOptions
  let miscPercent = Number(workOrderData.miscellaneousPercent ?? 0);
  let weldPercent = Number(workOrderData.weldPercent ?? 0);

  if ((!miscPercent || miscPercent < 0) && extraOptions && extraOptions.length > 0) {
    if (extraOptions.includes('15shop')) {
      miscPercent = 15;
    } else if (extraOptions.includes('5')) {
      miscPercent = 5;
    }
  }

  if ((!weldPercent || weldPercent < 0) && extraOptions && extraOptions.length > 0) {
    if (extraOptions.includes('15weld')) {
      weldPercent = 15;
    }
  }

  const miscAmount = subtotal * ((miscPercent > 0 ? miscPercent : 0) / 100);
  const weldAmount = subtotal * ((weldPercent > 0 ? weldPercent : 0) / 100);
  
  // Mostrar SHOPMISC
  if (miscAmount > 0) {
    pdf.setTextColor(0, 100, 200); // Color azul para SHOPMISC
    pdf.text(`SHOPMISC ${miscPercent}%:`, totalsStartX, currentY);
    pdf.text(`$${miscAmount.toFixed(2)}`, pageWidth - rightMargin, currentY, { align: 'right' });
    currentY += 6;
  }
  
  // Mostrar WELD SUPP si existe
  if (weldAmount > 0) {
    pdf.setTextColor(0, 100, 200); // Color azul para WELD SUPP
    pdf.text(`WELD SUPP ${weldPercent}%:`, totalsStartX, currentY);
    pdf.text(`$${weldAmount.toFixed(2)}`, pageWidth - rightMargin, currentY, { align: 'right' });
    currentY += 6;
  }
  
  // Línea separadora
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.line(totalsStartX, currentY + 2, pageWidth - rightMargin, currentY + 2);
  currentY += 8;
  
  // TOTAL (en rojo)
  pdf.setFontSize(11);
  pdf.setTextColor(220, 20, 60);
  pdf.setFont('courier', 'bold');
  pdf.text('TOTAL LAB & PARTS:', totalsStartX, currentY);
  pdf.text(`$${(workOrderData.totalCost || 0).toFixed(2)}`, pageWidth - rightMargin, currentY, { align: 'right' });
    // Resetear fuente
  pdf.setFont('courier', 'normal');
  
  // CUSTOMER AUTHORIZATION
  const authY = currentY + 15;
  
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text('[ ] I accept this estimate without any changes', leftMargin, authY);
  pdf.text('[ ] I accept this estimate with the handwritten changes noted below', leftMargin, authY + 6);
  
  // TÉRMINOS Y CONDICIONES (Terms and Conditions)
  const termsY = authY + 14;
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Terms and Conditions: Payment due upon receipt. All parts and labor are subject to inspection.', leftMargin, termsY);
  pdf.text('Work warranty: 30 days on all workmanship. Any warranty claims must be made within 30 days of completion.', leftMargin, termsY + 4);
  
  // LÍNEAS PARA FIRMAS - CENTRADAS
  const sigY = termsY + 12;
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
