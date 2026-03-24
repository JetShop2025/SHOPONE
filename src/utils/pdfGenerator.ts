import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WorkOrderData {
  id: number;
  idClassic: string;
  customer: string;
  trailer: string;
  date: string;
  mechanics: string | Array<{ name: string; hrs?: number | string }>;
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
  totalLabAndParts?: number;
  extraOptions?: string[];
  miscellaneousPercent?: number;
  weldPercent?: number;
  miscellaneousFixed?: number;
  weldFixed?: number;
}

type PDFWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

const toSafeHttpUrl = (raw?: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/')) {
    return `${window.location.origin}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
};

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
};

const detectImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' => {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
};

const appendWorkOrderImagesPages = async (pdf: jsPDF, workOrderId: number) => {
  if (!Number.isFinite(workOrderId) || workOrderId <= 0) return;

  try {
    const listRes = await fetch(`/api/work-orders/${workOrderId}/images`);
    if (!listRes.ok) return;

    const listJson = await listRes.json();
    const images = Array.isArray(listJson?.images) ? listJson.images : [];
    if (images.length === 0) return;

    const loadedImages: Array<{ dataUrl: string; fileName: string; phase: 'BEFORE' | 'AFTER' | 'EVIDENCE' }> = [];
    for (const image of images) {
      const url = toSafeHttpUrl(image?.url);
      if (!url) continue;

      try {
        const imageRes = await fetch(url);
        if (!imageRes.ok) continue;
        const imageBlob = await imageRes.blob();
        if (!imageBlob.type.startsWith('image/')) continue;
        const dataUrl = await blobToDataUrl(imageBlob);
        if (!dataUrl.startsWith('data:image')) continue;
        const rawPhase = String(image?.phase || '').toUpperCase();
        const phase: 'BEFORE' | 'AFTER' | 'EVIDENCE' =
          rawPhase === 'BEFORE' || rawPhase === 'AFTER' ? rawPhase : 'EVIDENCE';
        loadedImages.push({ dataUrl, fileName: String(image?.fileName || 'Image'), phase });
      } catch {
        // Skip broken image and continue with next
      }
    }

    if (loadedImages.length === 0) return;

    const pageWidth = 210;
    const pageHeight = 297;
    const pageMargin = 12;
    const titleY = 14;
    const gap = 6;
    const slotWidth = pageWidth - pageMargin * 2;
    const slotHeight = (pageHeight - 45 - gap) / 2;

    const groupedImages: Array<{ title: string; color: [number, number, number]; items: typeof loadedImages }> = [
      {
        title: `BEFORE REPAIR - #${workOrderId}`,
        color: [176, 90, 0],
        items: loadedImages.filter((img) => img.phase === 'BEFORE'),
      },
      {
        title: `AFTER REPAIR - #${workOrderId}`,
        color: [0, 120, 60],
        items: loadedImages.filter((img) => img.phase === 'AFTER'),
      },
      {
        title: `EVIDENCE - #${workOrderId}`,
        color: [10, 56, 84],
        items: loadedImages.filter((img) => img.phase === 'EVIDENCE'),
      },
    ];

    groupedImages.forEach((group) => {
      for (let i = 0; i < group.items.length; i += 2) {
        pdf.addPage();
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(group.color[0], group.color[1], group.color[2]);
        pdf.text(group.title, pageMargin, titleY);

        const chunk = group.items.slice(i, i + 2);
        chunk.forEach((img, idx) => {
          const top = 22 + idx * (slotHeight + gap);
          const bottom = top + slotHeight;

          pdf.setDrawColor(180, 190, 200);
          pdf.rect(pageMargin, top, slotWidth, slotHeight);

          const format = detectImageFormat(img.dataUrl);
          const renderX = pageMargin + 2;
          const renderY = top + 2;
          const renderW = slotWidth - 4;
          const renderH = slotHeight - 8;
          pdf.addImage(img.dataUrl, format, renderX, renderY, renderW, renderH, undefined, 'FAST');

          pdf.setFont('courier', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(90, 90, 90);
          pdf.text(img.fileName, pageMargin + 2, bottom - 1);
        });
      }
    });
  } catch (error) {
    console.warn('No se pudieron anexar imágenes al PDF:', error);
  }
};

// First implementation removed - keeping the improved second implementation

export const generateWorkOrderPDF = async (workOrderData: WorkOrderData) => {
  const pdf = new jsPDF('p', 'mm', 'a4'); // Especificar formato A4
  
  // Configurar fuente a Courier New
  pdf.setFont('courier');
  
  // Márgenes de página (A4: 210mm ancho)
  const pageWidth = 210;
  const pageHeight = 297;
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
  pdf.setTextColor(10, 56, 84);
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
  pdf.setDrawColor(10, 56, 84);
  pdf.setLineWidth(0.8);
  pdf.rect(boxesStartX, firstRowY, leftBoxWidth, boxHeight);
  
  // Contenido caja izquierda
  pdf.setFontSize(10);
  pdf.setTextColor(10, 56, 84);
  pdf.text('Customer:', boxesStartX + 3, firstRowY + 8);
  pdf.setTextColor(0, 0, 0);
  const customerText = String(workOrderData.customer || '');
  pdf.text(customerText.length > 15 ? customerText.substring(0, 15) + '...' : customerText, 
           boxesStartX + 3, firstRowY + 15);
  
  pdf.setTextColor(10, 56, 84);
  pdf.text('Trailer:', boxesStartX + 3, firstRowY + 22);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.trailer || ''), boxesStartX + 3, firstRowY + 28);
    // CAJA DERECHA - Date, Invoice #, ID Classic, Mechanics, Status
  const rightBoxX = boxesStartX + leftBoxWidth + gapBetweenBoxes;
  pdf.setDrawColor(10, 56, 84);
  pdf.rect(rightBoxX, firstRowY, rightBoxWidth, boxHeight);
  
  // Contenido caja derecha
  pdf.setFontSize(10);
  pdf.setTextColor(10, 56, 84);
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
  
  pdf.setTextColor(10, 56, 84);
  pdf.text('Invoice #:', rightBoxX + 3, firstRowY + 12);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.id || ''), rightBoxX + 25, firstRowY + 12);
  
  pdf.setTextColor(10, 56, 84);
  pdf.text('ID Classic:', rightBoxX + 3, firstRowY + 18);
  pdf.setTextColor(0, 0, 0);
  pdf.text(String(workOrderData.idClassic || ''), rightBoxX + 25, firstRowY + 18);
  
  pdf.setTextColor(10, 56, 84);
  pdf.text('Mechanics:', rightBoxX + 3, firstRowY + 24);
  pdf.setTextColor(0, 0, 0);
  
  // Handle both array and string formats for mechanics
  let mechanicsText = '';
  if (Array.isArray(workOrderData.mechanics)) {
    // If it's an array of mechanic objects, extract names and hours
    mechanicsText = workOrderData.mechanics
      .map((m) => {
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
  pdf.setTextColor(10, 56, 84);
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
  const descY = firstRowY + boxHeight + 12;
  pdf.setFontSize(10);
  pdf.setTextColor(10, 56, 84);
  pdf.text('Description:', leftMargin, descY);
  
  // Descripción del trabajo - con control de ancho y altura dinámica
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  const description = workOrderData.description || '';
  const splitDescription = pdf.splitTextToSize(description, contentWidth - 10);
  
  // Calcular la altura necesaria para la descripción
  const lineHeight = 3.5;
  const descriptionHeight = splitDescription.length * lineHeight;
  
  // Renderizar la descripción completa
  pdf.text(splitDescription, leftMargin, descY + 4.5);
    // TABLA DE PARTES - CENTRADA Y SIN DESBORDAMIENTO
  // Ajustar posición de tabla según altura de la descripción
  const tableStartY = descY + 7 + descriptionHeight;
  const tableData = workOrderData.parts.map((part, index) => {
    const safeUnitCost = Number(String((part as any).unitCost ?? 0).replace(/[^0-9.-]/g, '')) || 0;
    const safeTotal = Number(String((part as any).total ?? 0).replace(/[^0-9.-]/g, '')) || 0;
    return [
      String(index + 1),
      String(part.sku || '').replace(/\s+/g, '').substring(0, 20), // SKU limpio (sin saltos)
      String(part.description || '').replace(/\s+/g, ' ').trim(), // Descripción limpia
      String((part as any).um || (part as any).uom || (part as any).unit || 'EA'),
      String(part.qty || 0),
      `$${safeUnitCost.toFixed(2)}`,
      `$${safeTotal.toFixed(2)}`,
      part.invoiceLink ? 'LINK' : '' // Clickeable si hay invoiceLink
    ];
  });
  autoTable(pdf, {
    startY: tableStartY,
    head: [['#', 'SKU', 'DESCRIPTION', 'U/M', 'QTY', 'UNIT $', 'TOTAL', 'LINK']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 56, 84],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      overflow: 'hidden',
      cellPadding: { top: 0.8, right: 1, bottom: 0.8, left: 1 },
      font: 'courier'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [0, 0, 0],
      cellPadding: { top: 0.7, right: 1, bottom: 0.7, left: 1 },
      overflow: 'ellipsize',
      font: 'courier'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 6 },      // #
      1: { halign: 'center', cellWidth: 22 },     // SKU
      2: { halign: 'left', cellWidth: 80, overflow: 'linebreak' }, // DESCRIPTION (1 línea normalmente, 2 si requiere)
      3: { halign: 'center', cellWidth: 11 },     // U/M
      4: { halign: 'center', cellWidth: 10 },     // QTY
      5: { halign: 'right', cellWidth: 19 },      // UNIT $
      6: { halign: 'right', cellWidth: 19 },      // TOTAL
      7: { halign: 'center', cellWidth: 13 }      // LINK
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
          const safeLink = toSafeHttpUrl(part.invoiceLink);
          if (safeLink) {
            pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: safeLink });
          }
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
  let finalY = (pdf as PDFWithAutoTable).lastAutoTable?.finalY || tableStartY + 50;

  // Ensure totals and signature block stay within printable area.
  const reservedBottomBlock = 75;
  if (finalY > pageHeight - reservedBottomBlock) {
    pdf.addPage();
    finalY = 20;
  }
  const totalsStartX = pageWidth - rightMargin - 70; // 70mm para los totales y extras
  let currentY = finalY + 5;
  
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
  const miscFixed = Number(workOrderData.miscellaneousFixed ?? 0);
  const weldFixed = Number(workOrderData.weldFixed ?? 0);

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

  const miscAmount = miscFixed > 0
    ? Math.round(miscFixed * 100) / 100
    : Math.round(subtotal * ((miscPercent > 0 ? miscPercent : 0) / 100) * 100) / 100;
  const weldAmount = weldFixed > 0
    ? Math.round(weldFixed * 100) / 100
    : Math.round(subtotal * ((weldPercent > 0 ? weldPercent : 0) / 100) * 100) / 100;
  
  // Mostrar SHOPMISC
  if (miscAmount > 0) {
    pdf.setTextColor(0, 100, 200); // Color azul para SHOPMISC
    pdf.text(miscFixed > 0 ? 'SHOPMISC:' : `SHOPMISC ${miscPercent}%:`, totalsStartX, currentY);
    pdf.text(`$${miscAmount.toFixed(2)}`, pageWidth - rightMargin, currentY, { align: 'right' });
    currentY += 6;
  }
  
  // Mostrar WELD SUPP si existe
  if (weldAmount > 0) {
    pdf.setTextColor(0, 100, 200); // Color azul para WELD SUPP
    pdf.text(weldFixed > 0 ? 'WELD SUPP:' : `WELD SUPP ${weldPercent}%:`, totalsStartX, currentY);
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
  const storedTotalRaw = workOrderData.totalLabAndParts ?? workOrderData.totalCost;
  const storedTotal = Number(storedTotalRaw);
  // Usar el total guardado aunque sea $0.00 — solo recalcular si nunca fue provisto
  const hasStoredTotal = storedTotalRaw != null && Number.isFinite(storedTotal);
  const pdfTotal = hasStoredTotal
    ? parseFloat(storedTotal.toFixed(2))
    : parseFloat((subtotal + miscAmount + weldAmount).toFixed(2));
  pdf.text(`$${pdfTotal.toFixed(2)}`, pageWidth - rightMargin, currentY, { align: 'right' });
    // Resetear fuente
  pdf.setFont('courier', 'normal');
  
  // CUSTOMER AUTHORIZATION
  const authY = currentY + 10;
  
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text('[ ] I accept this estimate without any changes', leftMargin, authY);
  pdf.text('[ ] I accept this estimate with the handwritten changes noted below', leftMargin, authY + 6);
  
  // TÉRMINOS Y CONDICIONES (Terms and Conditions)
  const termsY = authY + 11;
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Terms and Conditions: Payment due upon receipt. All parts and labor are subject to inspection.', leftMargin, termsY);
  pdf.text('Work warranty: 30 days on all workmanship. Any warranty claims must be made within 30 days of completion.', leftMargin, termsY + 4);
  
  // LÍNEAS PARA FIRMAS - CENTRADAS
  const sigY = termsY + 10;
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
  const footerY = sigY + 12;
  
  pdf.setFontSize(11);
  pdf.setTextColor(10, 56, 84);
  pdf.setFont('helvetica', 'italic');
  pdf.text('Thanks for your business!', pageWidth / 2, footerY, { align: 'center' });

  await appendWorkOrderImagesPages(pdf, Number(workOrderData.id));
  
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
    const safeLink = toSafeHttpUrl(part.invoiceLink);
    if (safeLink) {
      uniqueLinks.add(safeLink);
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
