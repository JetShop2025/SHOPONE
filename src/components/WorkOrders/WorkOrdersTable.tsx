import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import WorkOrderForm from './WorkOrderForm';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/es';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import 'jspdf-autotable';
import HourmeterModal from './HourmeterModal';
import { useNewWorkOrder } from './useNewWorkOrder';
import { keepAliveService } from '../../services/keepAlive';
import { generateWorkOrderPDF, openInvoiceLinks, openPDFInNewTab, savePDFToDatabase } from '../../utils/pdfGenerator';
// Removed logger utility to reduce extra code weight
dayjs.extend(isBetween);
dayjs.extend(weekOfYear);

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

// TypeScript interfaces for API responses
interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
}

interface PaginatedWorkOrdersResponse {
  data: any[];
  pagination: PaginationInfo;
}

interface WorkOrdersApiResponse {
  pagination?: PaginationInfo;
  data?: any[];
}

const billToCoOptions = [
  "JETSHO","PRIGRE","GABGRE","GALGRE","RAN100","JCGLOG","JGTBAK","VIDBAK","JETGRE","ALLSAN","AGMGRE","TAYRET","TRUSAL","BRAGON","FRESAL","SEBSOL","LFLCOR","GARGRE","MCCGRE","LAZGRE","MEJADE","CHUSAL"
];

function getTrailerOptions(billToCo: string): string[] {
  if (billToCo === "GALGRE") {
    const especiales = [
      "1-100 TRK",
      "1-103 TRK",
      "1-101 TRK",
      "1-102 TRK",
      "1-105 TRK",
      "1-106 TRK",
      "1-107 TRK",
      "1-111 TRK"
    ];
    const normales = Array.from({length: 54}, (_, i) => `1-${100+i}`);
    return [...especiales, ...normales];
  }
  if (billToCo === "JETGRE") {
    const especiales = ["2-01 TRK"];
    const normales = Array.from({length: 16}, (_, i) => `2-${(i+1).toString().padStart(3, '0')}`);
    return [...especiales, ...normales];
  }
  if (billToCo === "PRIGRE") return Array.from({length: 24}, (_, i) => `3-${(300+i).toString()}`);
  if (billToCo === "RAN100") return Array.from({length: 20}, (_, i) => `4-${(400+i).toString()}`);
  if (billToCo === "GABGRE") return Array.from({length: 30}, (_, i) => `5-${(500+i).toString()}`);
  return [];
}

// Función para obtener opciones de trailer con indicador de partes pendientes
function getTrailerOptionsWithPendingIndicator(billToCo: string, trailersWithPending: string[]): string[] {
  const baseOptions = getTrailerOptions(billToCo);
  return baseOptions.map(trailer => {
    const hasPending = trailersWithPending.includes(trailer);
    return hasPending ? `${trailer} 🔔` : trailer;
  });
}

function getWeekRange(weekStr: string) {
  const [year, week] = weekStr.split('-W');
  const start = dayjs().year(Number(year)).week(Number(week)).startOf('week');
  const end = dayjs().year(Number(year)).week(Number(week)).endOf('week');
  return { start, end };
}

const STATUS_OPTIONS = ['PROCESSING', 'APPROVED', 'FINISHED'];

const buttonBase = {
  padding: '10px 28px',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(25,118,210,0.10)',
  border: 'none',
  marginRight: 8,
};

const primaryBtn = {
  background: '#1976d2',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  fontWeight: '600',
  cursor: 'pointer',
  marginRight: '8px',
  fontSize: '14px'
};

const dangerBtn = {
  background: '#d32f2f',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  fontWeight: '600',
  cursor: 'pointer',
  marginRight: '8px',
  fontSize: '14px'
};

const secondaryBtn = {
  background: '#fff',
  color: '#1976d2',
  border: '1px solid #1976d2',
  padding: '8px 16px',
  borderRadius: '6px',
  fontWeight: '600',
  cursor: 'pointer',
  marginRight: '8px',
  fontSize: '14px'
};

// Removed unused style constants

function calcularTotalWO(order: any) {
  // Si el usuario editó el total manualmente, respétalo
  // Si el usuario editó el total manualmente, respétalo y muéstralo tal cual
  if (
    typeof order.totalLabAndParts === 'string' &&
    order.totalLabAndParts.trim() &&
    order.totalLabAndParts.trim() !== '$NaN'
  ) {
    return order.totalLabAndParts.trim();
  }
  if (
    typeof order.totalLabAndParts === 'number' && !isNaN(order.totalLabAndParts)
  ) {
    return `$${order.totalLabAndParts.toFixed(2)}`;
  }
  // Si no hay valor válido, mostrar $0.00
  return '$0.00';
}

const WorkOrdersTable: React.FC = () => {
  // Handler for Edit Work Order submit
  const handleEditWorkOrderSubmit = async (data: any) => {
      // Validar y limpiar campos obligatorios antes de enviar
      const safeData = { ...data };
      // Si mechanic es array, usar el primero como string para compatibilidad
      if (Array.isArray(safeData.mechanics) && safeData.mechanics.length > 0) {
        safeData.mechanic = safeData.mechanics[0]?.name || '';
      } else if (typeof safeData.mechanic !== 'string') {
        safeData.mechanic = '';
      }
      // Asegurar que date, description, status, totalLabAndParts no sean nulos
      safeData.date = safeData.date || '';
      safeData.description = safeData.description || '';
      safeData.status = safeData.status || 'PROCESSING';
      safeData.totalLabAndParts = safeData.totalLabAndParts || '$0.00';
      // Asegurar que parts y mechanics sean arrays
      safeData.parts = Array.isArray(safeData.parts) ? safeData.parts : [];
      safeData.mechanics = Array.isArray(safeData.mechanics) ? safeData.mechanics : [];
    if (!editWorkOrder) {
      alert('No work order loaded for editing.');
      return;
    }
    setLoading(true);
    try {
      const originalParts = Array.isArray(editWorkOrder.parts) ? editWorkOrder.parts : [];
      const currentParts = data.parts || [];
      const newPartsToDeduct = [];
      for (const currentPart of currentParts) {
        if (currentPart.sku && currentPart.qty && Number(currentPart.qty) > 0) {
          const originalPart = originalParts.find((op: any) =>
            (op.sku && op.sku === currentPart.sku) ||
            (op.part_name && op.part_name === currentPart.sku)
          );
          if (!originalPart) {
            newPartsToDeduct.push({ sku: currentPart.sku, qty: Number(currentPart.qty) });
          } else {
            const originalQty = Number(originalPart.qty_used || originalPart.qty || 0);
            const currentQty = Number(currentPart.qty);
            if (currentQty > originalQty) {
              const qtyDifference = currentQty - originalQty;
              newPartsToDeduct.push({ sku: currentPart.sku, qty: qtyDifference });
            }
          }
        }
      }
      // Deduct inventory using FIFO if needed
      if (newPartsToDeduct.length > 0) {
        try {
          const fifoResponse = await axios.post(`${API_URL}/inventory/deduct-fifo`, {
            parts: newPartsToDeduct,
            usuario: localStorage.getItem('username') || 'unknown'
          });
          const fifoResult = fifoResponse.data;
          for (const part of newPartsToDeduct) {
            let fifoInfoForPart = null;
          if (fifoResult && (fifoResult as any).details && Array.isArray((fifoResult as any).details)) {
            fifoInfoForPart = (fifoResult as any).details.find((f: any) => f.sku === part.sku);
          }
            const currentPartInForm = currentParts.find((p: any) => p.sku === part.sku);
            const originalPartInDB = originalParts.find((op: any) =>
              (op.sku && op.sku === part.sku) ||
              (op.part_name && op.part_name === part.sku)
            );
            if (originalPartInDB && originalPartInDB.id) {
              const newTotalQty = Number(currentPartInForm?.qty || 0);
              await axios.put(`${API_URL}/work-order-parts/${originalPartInDB.id}`, {
                qty_used: newTotalQty,
                cost: Number(String(currentPartInForm?.cost || 0).replace(/[^0-9.]/g, '')),
                fifo_info: fifoInfoForPart,
                usuario: localStorage.getItem('username') || ''
              });
            } else {
              await axios.post(`${API_URL}/work-order-parts`, {
                work_order_id: editWorkOrder.id,
                sku: part.sku,
                part_name: inventory.find(i => i.sku === part.sku)?.part || '',
                qty_used: part.qty,
                cost: Number(String(currentPartInForm?.cost || 0).replace(/[^0-9.]/g, '')),
                fifo_info: fifoInfoForPart,
                usuario: localStorage.getItem('username') || ''
              });
            }
          }
        } catch (fifoError) {
          await axios.post(`${API_URL}/inventory/deduct`, {
            parts: newPartsToDeduct,
            usuario: localStorage.getItem('username') || 'unknown'
          });
        }
      }
      // Update the work order
      // 1. Fecha: enviar SIEMPRE en formato YYYY-MM-DD
      // Keep original date unless user provided a valid value; avoid accidental shifts
      let dateToSend = data.date;
      const originalDate = editWorkOrder.date || '';
      const normalize = (d?: string) => {
        if (!d) return '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
          const [mm, dd, yyyy] = d.split('/');
          return `${yyyy}-${mm}-${dd}`;
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0,10);
        return '';
      };
      const normalized = normalize(dateToSend);
      if (normalized) {
        dateToSend = normalized;
      } else {
        // If user cleared or malformed date, preserve original
        dateToSend = normalize(originalDate) || originalDate || '';
      }
      // 2. Total: enviar SIEMPRE como número (sin $)
      let totalToSend = data.totalLabAndParts;
      if (typeof totalToSend === 'string') {
        totalToSend = Number(String(totalToSend).replace(/[^0-9.]/g, ''));
      }
      if (!totalToSend || isNaN(totalToSend)) {
        totalToSend = 0;
      }
      // 3. Guardar el valor EXACTO que el usuario editó/calculó, sin recalcular ni modificar
  const dataToSend = { ...safeData, date: dateToSend, totalLabAndParts: totalToSend };
      await axios.put(`${API_URL}/work-orders/${editWorkOrder.id}`, dataToSend);
      // Mark pending parts as used
      const partesConPendingId = currentParts.filter((p: any) => p._pendingPartId);
      for (const part of partesConPendingId) {
        try {
          await axios.put(`${API_URL}/receive/${part._pendingPartId}/mark-used`, {
            usuario: localStorage.getItem('username') || ''
          });
        } catch (error) {}
      }
      if (partesConPendingId.length > 0) {
        await fetchTrailersWithPendingParts();
      }
      // Generate new PDF after edit
      try {
        const workOrderRes = await axios.get(`${API_URL}/work-orders/${editWorkOrder.id}`);
        const workOrderData = workOrderRes.data as any;
        const partsRes = await axios.get(`${API_URL}/work-order-parts/${editWorkOrder.id}`);
        const partsWithInvoices = partsRes.data as any[];
        // Usar SIEMPRE el valor que el usuario puso en el formulario, sin recalcular ni modificar
        const pdfData = {
          id: workOrderData.id,
          idClassic: workOrderData.idClassic || workOrderData.id.toString(),
          customer: workOrderData.billToCo || workOrderData.customer || '',
          trailer: workOrderData.trailer || '',
          // Usar SIEMPRE el valor exacto que el usuario seleccionó/guardó
          date: workOrderData.date || workOrderData.fecha || '',
          mechanics: Array.isArray(workOrderData.mechanics)
            ? workOrderData.mechanics.map((m: any) => `${m.name} (${m.hrs}h)`).join(', ')
            : workOrderData.mechanics || workOrderData.mechanic || '',
          description: workOrderData.description || '',
          status: workOrderData.status || editWorkOrder.status || 'PROCESSING',
          parts: partsWithInvoices.map((part: any) => {
            const invItem = inventory.find(item => String(item.sku).toLowerCase() === String(part.sku).toLowerCase());
            let um = String((invItem?.um ?? invItem?.unit ?? 'EA') as any).toUpperCase();
            if (um === 'GAL') um = 'GALM';
            return {
              sku: part.sku,
              description: part.part_name || part.sku,
              um,
              qty: part.qty_used,
              unitCost: part.cost || 0,
              total: (part.qty_used && part.cost && !isNaN(Number(part.qty_used)) && !isNaN(Number(part.cost)))
                ? Number(part.qty_used) * Number(part.cost)
                : 0,
              invoice: part.invoice_number || 'N/A',
              invoiceLink: part.invoice_link
            };
          }),
          laborCost: Number(workOrderData.laborCost) || 0,
          subtotalParts: Number(workOrderData.subtotalParts) || 0,
          // Usar SIEMPRE el valor exacto que el usuario editó/calculó, sin recalcular ni modificar
          totalLabAndParts: !isNaN(Number(dataToSend.totalLabAndParts)) ? Number(dataToSend.totalLabAndParts) : 0,
          totalCost: !isNaN(Number(dataToSend.totalLabAndParts)) ? Number(dataToSend.totalLabAndParts) : 0,
          extraOptions: editWorkOrder.extraOptions || extraOptions || [],
          // NUEVO: Agregar el porcentaje de Miscellaneous EXACTO que el usuario colocó
          // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.
        };
        const pdf = await generateWorkOrderPDF(pdfData);
        const pdfBlob = pdf.output('blob');
        try {
          await savePDFToDatabase(editWorkOrder.id, pdfBlob);
        } catch (dbError) {}
        openPDFInNewTab(pdf, `work_order_${workOrderData.idClassic || editWorkOrder.id}.pdf`);
        openInvoiceLinks(pdfData.parts);
        await axios.post(`${API_URL}/work-orders/${editWorkOrder.id}/generate-pdf`);
      } catch (pdfError) {}
      await fetchWorkOrders();
      await fetchTrailersWithPendingParts();
      setWorkOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === editWorkOrder.id
            ? { ...order, ...editWorkOrder, ...data,
                // Asegura que el total nunca sea NaN ni undefined
                totalLabAndParts: !isNaN(Number(dataToSend.totalLabAndParts)) ? Number(dataToSend.totalLabAndParts) : 0,
                date: dataToSend.date || editWorkOrder.date || ''
              }
            : order
        )
      );
      setShowEditForm(false);
      setEditWorkOrder(null);
      setEditId('');
      setEditError('');
      // Always show a valid total value in the alert
      let totalValue = dataToSend.totalLabAndParts;
      if (!totalValue || isNaN(Number(String(totalValue).replace(/[^0-9.]/g, '')))) {
        totalValue = '$0.00';
      }
      alert(`Work Order updated successfully and PDF regenerated. Total: ${totalValue}`);
    } catch (err) {
      alert('Error updating Work Order.');
    } finally {
      setLoading(false);
    }
  };
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [pendingParts, setPendingParts] = useState<any[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [editWorkOrder, setEditWorkOrder] = useState<any | null>(null);
  const [editError, setEditError] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);  const [newWorkOrder, setNewWorkOrder, resetNewWorkOrder] = useNewWorkOrder();
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedPendingParts, setSelectedPendingParts] = useState<number[]>([]);
  const [trailersWithPendingParts, setTrailersWithPendingParts] = useState<string[]>([]);
  const [pendingPartsQty, setPendingPartsQty] = useState<{ [id: number]: string }>({});  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [extraOptions, setExtraOptions] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<{ visible: boolean, x: number, y: number, info: any }>({ visible: false, x: 0, y: 0, info: null });
  const [showHourmeter, setShowHourmeter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);  const [reconnecting, setReconnecting] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'waking' | 'offline'>('online');  const [retryCount, setRetryCount] = useState(0);
  const [compactColumns, setCompactColumns] = useState(false);
  const [fitToWidth, setFitToWidth] = useState(true);
  const [tableScale, setTableScale] = useState(1);
  // Manual zoom when Fit-to-width is OFF (persisted)
  const [zoomScale, setZoomScale] = useState<number>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('woZoomScale') : null;
    const parsed = stored ? Number(stored) : 1;
    if (!parsed || isNaN(parsed)) return 1;
    return Math.min(1.5, Math.max(0.5, parsed));
  });
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const tableRef = React.useRef<HTMLTableElement | null>(null);

  React.useEffect(() => {
    if (!fitToWidth) { setTableScale(1); return; }
    const recalc = () => {
      const container = containerRef.current;
      const table = tableRef.current;
      if (!container || !table) return;
      const containerWidth = container.clientWidth - 8;
      const tableWidth = table.scrollWidth;
      if (tableWidth > 0) {
        const s = Math.min(1, Math.max(0.5, containerWidth / tableWidth));
        setTableScale(s);
      }
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [fitToWidth, compactColumns, workOrders.length]);

  // Persist manual zoom
  useEffect(() => {
    try { window.localStorage.setItem('woZoomScale', String(zoomScale)); } catch {}
  }, [zoomScale]);

  // Effective scale to apply to the table (auto when fit-to-width; manual when not)
  const effectiveScale = fitToWidth ? tableScale : zoomScale;
  const maxRetries = 3;
  const [idClassicError, setIdClassicError] = useState('');  // Nueva funcionalidad: búsqueda inteligente por ID Classic
  const [searchIdClassic, setSearchIdClassic] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
    // Variables para paginación OPTIMIZADA para plan gratuito
  const [currentPageData, setCurrentPageData] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const pageSize = 100; // REDUCIDO a 100 para plan gratuito de Render
  
  // NUEVO: Estados para W.O. activas siempre accesibles
  const [activeWorkOrders, setActiveWorkOrders] = useState<any[]>([]);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [activeWOsCount, setActiveWOsCount] = useState(0);
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, order: any | null }>({ visible: false, x: 0, y: 0, order: null });
  // Function to check if ID Classic already exists
  const checkIdClassicExists = (idClassic: string): boolean => {
    if (!idClassic || idClassic.trim() === '') return false;
    return workOrders.some(order => 
      order.idClassic && 
      order.idClassic.toLowerCase() === idClassic.toLowerCase()
    );
  };
  // Function to validate ID Classic in real-time
  const validateIdClassic = (idClassic: string, status?: string) => {
    // Clear any existing error first
    setIdClassicError('');
    
    // Get current status (from parameter or current work order)
    const currentStatus = status || (showEditForm ? editWorkOrder?.status : newWorkOrder.status) || '';
    
    // If status is FINISHED, ID Classic is required
    if (currentStatus === 'FINISHED') {
      if (!idClassic || idClassic.trim() === '') {
        setIdClassicError('⚠️ ID Classic is required when status is FINISHED!');
        return false;
      }
      
      // Check if ID Classic already exists (excluding current work order if editing)
      const existingOrder = workOrders.find(order => 
        order.idClassic && 
        order.idClassic.toLowerCase() === idClassic.toLowerCase() &&
        order.id !== (showEditForm ? editWorkOrder?.id : undefined)
      );
      
      if (existingOrder) {
        setIdClassicError(`⚠️ Work Order with ID Classic "${idClassic}" already exists!`);
        return false;
      }
    } else {
      // If status is not FINISHED, ID Classic should not be entered
      if (idClassic && idClassic.trim() !== '') {
        setIdClassicError('⚠️ ID Classic can only be set when status is FINISHED!');
        return false;
      }
    }
    
    return true;
  };

  // Función para formatear fecha sin problemas de zona horaria
  const formatDateSafely = (dateString: string) => {
    if (!dateString) return '';
    try {
      // Si la fecha está en formato YYYY-MM-DD, parsearlo manualmente
      if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${month}/${day}/${year}`;
      }
      // Para otros formatos, usar Date pero con cuidado
      const date = new Date(dateString + 'T00:00:00'); // Forzar hora local
      return date.toLocaleDateString('en-US');
    } catch (error) {
      console.error('Error formateando fecha:', dateString, error);
      return dateString;
    }
  };  // Función para cargar las órdenes con paginación de 1000 registros
  const fetchWorkOrders = useCallback(async (isRetry = false, pageToLoad?: number) => {
    try {
      setFetchingData(true);
      const targetPage = pageToLoad || currentPageData;
      // Si hay búsqueda específica por ID Classic, usar búsqueda directa (pero paginada)
      if (searchIdClassic.trim()) {
        // Siempre paginar la búsqueda por ID Classic
        const res = await axios.get(`${API_URL}/work-orders`, {
          params: {
            searchIdClassic: searchIdClassic.trim(),
            page: targetPage,
            pageSize: pageSize
          },
          timeout: 30000
        });
        // Si el backend soporta paginación en búsqueda, usarla
        if (res.data && typeof res.data === 'object' && 'pagination' in res.data) {
          const paginatedResponse = res.data as PaginatedWorkOrdersResponse;
          const { data, pagination } = paginatedResponse;
          setWorkOrders(data || []);
          setCurrentPageData(pagination.currentPage);
          setTotalPages(pagination.totalPages);
          setTotalRecords(pagination.totalRecords);
          setHasNextPage(pagination.hasNextPage);
          setHasPreviousPage(pagination.hasPreviousPage);
        } else {
          // Fallback: si no hay paginación, mostrar solo los primeros pageSize
          const searchResults = Array.isArray(res.data) ? res.data : [];
          setWorkOrders(searchResults.slice(0, pageSize));
          setCurrentPageData(1);
          setTotalPages(1);
          setTotalRecords(searchResults.length);
          setHasNextPage(false);
          setHasPreviousPage(false);
        }
        setServerStatus('online');
        setRetryCount(0);
        return;
      }
      // Carga paginada normal (nunca traer todo)
      const res = await axios.get<WorkOrdersApiResponse | any[]>(`${API_URL}/work-orders`, {
        params: {
          page: targetPage,
          pageSize: pageSize,
          includeArchived: false
        },
        timeout: 30000
      });
      if (res.data && typeof res.data === 'object' && 'pagination' in res.data) {
        const paginatedResponse = res.data as PaginatedWorkOrdersResponse;
        const { data, pagination } = paginatedResponse;
        setWorkOrders(data || []);
        setCurrentPageData(pagination.currentPage);
        setTotalPages(pagination.totalPages);
        setTotalRecords(pagination.totalRecords);
        setHasNextPage(pagination.hasNextPage);
        setHasPreviousPage(pagination.hasPreviousPage);
      } else {
        // Fallback: nunca mostrar más de pageSize
        const fetchedOrders = Array.isArray(res.data) ? res.data : [];
        setWorkOrders(fetchedOrders.slice(0, pageSize));
        setCurrentPageData(1);
        setTotalPages(1);
        setTotalRecords(fetchedOrders.length);
        setHasNextPage(false);
        setHasPreviousPage(false);
      }
      setServerStatus('online');
      setRetryCount(0);
    } catch (err: any) {
      console.error('Error cargando órdenes:', err);
      if ((err?.response?.status === 502 || err?.response?.status === 503 || err.code === 'ECONNABORTED') && retryCount < maxRetries) {
        if (!isRetry) {
          setServerStatus('waking');
          try {
            await keepAliveService.manualPing();
          } catch (keepAliveError) {}
          setRetryCount(prev => prev + 1);
          const retryDelay = Math.min(30000 * Math.pow(2, retryCount), 120000);
          setTimeout(() => {
            fetchWorkOrders(true, pageToLoad || currentPageData);
          }, retryDelay);
        }
      } else if (searchIdClassic.trim() && (err?.response?.status === 404 || (Array.isArray(err?.response?.data) && err?.response?.data.length === 0))) {
        setWorkOrders([]);
        setTotalPages(1);
        setTotalRecords(0);
        setHasNextPage(false);
        setHasPreviousPage(false);
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } finally {
      setFetchingData(false);
    }
  }, [retryCount, searchIdClassic, currentPageData, pageSize]);
    // Polling inteligente - ajusta frecuencia según estado del servidor (OPTIMIZADO para plan gratuito)
  useEffect(() => {
    fetchWorkOrders();
    
    let interval: NodeJS.Timeout;
    
    if (serverStatus === 'online') {
      // Servidor online: polling MUY reducido cada 5 minutos para plan gratuito
      interval = setInterval(() => fetchWorkOrders(), 300000); // 5 minutos
    } else if (serverStatus === 'waking') {
      // Servidor despertando: polling cada 2 minutos
      interval = setInterval(() => fetchWorkOrders(), 120000); // 2 minutos
    }
    // Si está offline, no hacer polling automático para no sobrecargar
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchWorkOrders, serverStatus]);
  
  // Nueva función robusta para buscar por ID Classic sin sobrecargar el servidor
  // NUEVA función especializada y ultra-segura para buscar por ID Classic
  // - Nunca hace petición si el filtro está vacío o tiene menos de 4 caracteres numéricos
  // - Solo permite búsqueda si el input es 100% numérico y de longitud >= 4 (ajustar si tu formato es diferente)
  // - Nunca recarga todas las órdenes si el filtro es vacío o inválido
  // - Siempre filtra en frontend para coincidencia exacta (case-insensitive)
  // - Maneja todos los errores y timeouts de forma robusta
  const searchWorkOrderByIdClassic = useCallback(async (searchTerm: string) => {
    const trimmed = (searchTerm || '').trim();
    // Solo permitir búsqueda si es numérico y longitud >= 4 (ajusta si tu formato es diferente)
    const isValid = /^\d{4,}$/.test(trimmed);
    if (!trimmed) {
      setWorkOrders([]);
      setSearchError('');
      setIsSearching(false);
      return;
    }
    if (!isValid) {
      setWorkOrders([]);
      setSearchError('Ingrese un ID Classic válido (mínimo 4 dígitos numéricos).');
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setSearchError('');
    try {
      // Petición con timeout ultra-corto y paginación
      const res = await axios.get(`${API_URL}/work-orders`, {
        params: {
          searchIdClassic: trimmed,
          page: 1,
          pageSize: pageSize
        },
        timeout: 5000
      });
      let results: any[] = [];
      if (
        res.data &&
        typeof res.data === 'object' &&
        'pagination' in res.data &&
        Array.isArray((res.data as any).data)
      ) {
        results = (res.data as any).data;
      } else if (Array.isArray(res.data)) {
        results = (res.data as any[]).slice(0, pageSize);
      }
      // Filtrar en frontend para coincidencia exacta (case-insensitive)
      const exactMatches = results.filter((order: any) =>
        order.idClassic && order.idClassic.toString().toLowerCase() === trimmed.toLowerCase()
      );
      setWorkOrders(exactMatches);
      if (exactMatches.length === 0) {
        setSearchError('No se encontró ninguna Work Order con ese ID Classic.');
      }
    } catch (err: any) {
      if (err && err.response && (err.response.status === 502 || err.response.status === 503)) {
        setSearchError('El servidor está temporalmente inactivo o sobrecargado. Intente más tarde.');
      } else if (err && err.response && err.response.status === 404) {
        setWorkOrders([]);
        setSearchError('No se encontró ninguna Work Order con ese ID Classic.');
      } else if (err && err.code === 'ECONNABORTED') {
        setSearchError('La búsqueda tardó demasiado. Intente de nuevo con un ID más específico.');
      } else {
        setSearchError('Error inesperado al buscar la Work Order.');
      }
    } finally {
      setIsSearching(false);
    }
  }, [pageSize]);

  useEffect(() => {
    if (searchError) {
      alert(searchError);
    }
  }, [searchError]);

  // Función para cargar inventario con reintentos inteligentes
  const fetchInventory = useCallback(async () => {
    try {
      // Only log if debugging
      const res = await axios.get(`${API_URL}/inventory`, { timeout: 15000 });
      const inventoryData = Array.isArray(res.data) ? res.data : [];
      setInventory(inventoryData);
      // Only log if debugging
    } catch (err) {
      console.error('❌ Error cargando inventario:', err);
      setInventory([]);
    }
  }, []);

  // Cargar inventario inicialmente y cuando el servidor esté online
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Recargar inventario cuando el servidor se recupere
  useEffect(() => {
    if (serverStatus === 'online' && inventory.length === 0) {
      console.log('🔄 Servidor online y sin inventario, recargando...');
      fetchInventory();
    }
  }, [serverStatus, inventory.length, fetchInventory]);
  useEffect(() => {
    // Solo cargar una vez al abrir el formulario
    if (showForm) {
      console.log('🔄 Cargando trailers con partes pendientes...');
      axios.get(`${API_URL}/receive?estatus=PENDING`)
        .then(res => {
          // Cast explícito para TypeScript
          // Elimina el tipado estricto para acceder a estatus y qty
          const receives = res.data as any[];
          console.log('📦 Receives PENDING cargados:', receives.length, 'registros');
          console.log('📦 Primeros 3 receives:', receives.slice(0, 3));
          // Filtrar solo los que tienen destino_trailer, estatus !== 'USED' y qty > 0
          const trailers = Array.from(
            new Set(
              receives
                .filter(r => r.destino_trailer && r.estatus !== 'USED' && Number(r.qty) > 0)
                .map(r => r.destino_trailer)
            )
          );
          setTrailersWithPendingParts(trailers);
          console.log('🚛 Trailers con partes pendientes encontrados:', trailers);
        })
        .catch(err => {
          console.error('❌ Error cargando receives PENDING:', err);
          setTrailersWithPendingParts([]);        });
    }
  }, [showForm]);
  
  // Cargar trailers con partes pendientes al inicializar
  useEffect(() => {
    fetchTrailersWithPendingParts();
  }, []);
  
  // Solo cargar partes pendientes cuando el trailer cambie, no en cada render ni al abrir/cerrar el formulario
  useEffect(() => {
    if (newWorkOrder.trailer) {
      console.log('� Cargando partes pendientes para trailer:', newWorkOrder.trailer);
      fetchPendingParts(newWorkOrder.trailer);
    } else {
      console.log('🔄 Limpiando partes pendientes (sin trailer seleccionado)');
      setPendingParts([]);
    }
  }, [newWorkOrder.trailer]);

  const filteredOrders = workOrders.filter(order => {
    if (!order.date) return false;

    // Si no hay filtro de semana, no filtra por semana
    let inWeek = true;
    if (selectedWeek) {
      const { start, end } = getWeekRange(selectedWeek);
      const orderDate = dayjs(order.date.slice(0, 10));
      inWeek = orderDate.isBetween(start, end, 'day', '[]');
    }    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesDay = !selectedDay || order.date.slice(0, 10) === selectedDay;

    return inWeek && matchesStatus && matchesDay;
  });

  // Cambios generales
  const handleWorkOrderChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any
  ) => {
    // Si es un evento (input, select, textarea)
    if (e && e.target) {
      const { name, value, type } = e.target;
      // Permitir edición y selección libre en el input de fecha tipo date
      if (type === 'date' && showForm) {
        // Siempre guardar el valor en formato YYYY-MM-DD
        setNewWorkOrder(prev => ({ ...prev, date: value }));
        return;
      }
      if (type === 'date' && showEditForm && editWorkOrder) {
        setEditWorkOrder((prev: any) => ({ ...prev, date: value }));
        return;
      }
      if (showForm) {
        setNewWorkOrder(prev => {
          const updated = { ...prev, [name]: value };
          if (name === 'idClassic' || name === 'status') {
            const idClassicValue = name === 'idClassic' ? value : updated.idClassic;
            const statusValue = name === 'status' ? value : updated.status;
            validateIdClassic(idClassicValue || '', statusValue);
          }
          return updated;
        });
      } else if (showEditForm && editWorkOrder) {
        setEditWorkOrder((prev: any) => {
          const updated = { ...prev, [name]: value };
          if (name === 'idClassic' || name === 'status') {
            const idClassicValue = name === 'idClassic' ? value : updated.idClassic;
            const statusValue = name === 'status' ? value : updated.status;
            validateIdClassic(idClassicValue || '', statusValue);
          }
          return updated;
        });
      }
    }
    // Si es un objeto (por ejemplo, desde useEffect o cambios automáticos)
    else if (typeof e === 'object') {
      if (showForm) {
        setNewWorkOrder(e);
      } else if (showEditForm && editWorkOrder) {
        setEditWorkOrder(e);
      }
    }
  };
  const handlePartChange = (index: number, field: string, value: string) => {
    // Función para buscar parte en inventario por SKU con logging mejorado
    const findPartBySku = (sku: string) => {
      if (!sku || !inventory || inventory.length === 0) {
        console.log('❌ findPartBySku: SKU vacío o inventario no disponible');
        return null;
      }
      
      console.log('🔍 Buscando SKU:', sku, 'en inventario de', inventory.length, 'items');
      
      // Buscar por SKU exacto (case insensitive)
      const exactMatch = inventory.find((item: any) => 
        String(item.sku).toLowerCase() === String(sku).toLowerCase()
      );
      
      if (exactMatch) {
        console.log('✅ Parte encontrada por SKU exacto:', {
          sku: exactMatch.sku,
          name: exactMatch.part || exactMatch.description || exactMatch.name,
          precio: exactMatch.precio,
          cost: exactMatch.cost,
          price: exactMatch.price,
          allFields: Object.keys(exactMatch)
        });
        return exactMatch;
      }
      
      // Si no encuentra coincidencia exacta, buscar que contenga el SKU
      const partialMatch = inventory.find((item: any) => 
        String(item.sku).toLowerCase().includes(String(sku).toLowerCase())
      );
      
      if (partialMatch) {
        console.log('⚠️ Parte encontrada por coincidencia parcial:', {
          sku: partialMatch.sku,
          name: partialMatch.part || partialMatch.description || partialMatch.name,
          precio: partialMatch.precio,
          cost: partialMatch.cost,
          price: partialMatch.price
        });
        return partialMatch;
      }
      
      console.log('❌ No se encontró parte para SKU:', sku);
      return null;
    };

    if (showForm) {
      const updatedParts = [...newWorkOrder.parts];
      updatedParts[index][field as 'part' | 'sku' | 'qty' | 'cost'] = value;

      // Auto-completado cuando se cambia el SKU
      if (field === 'sku' && value && value.trim() !== '') {
        const foundPart = findPartBySku(value);
        console.log('🔍 Buscando parte con SKU:', value);
        console.log('📦 Parte encontrada:', foundPart);
        
        if (foundPart) {
          // Autocompletar nombre de la parte
          updatedParts[index].part = foundPart.part || foundPart.description || foundPart.name || '';
          
          // Autocompletar costo - PRIORIDAD AL CAMPO 'precio' de la tabla inventory
          let cost = 0;
          console.log('🔍 Campos de precio disponibles:', {
            precio: foundPart.precio,
            cost: foundPart.cost,
            price: foundPart.price,
            allKeys: Object.keys(foundPart)
          });
          
          if (foundPart.precio !== undefined && foundPart.precio !== null && foundPart.precio !== '') {
            cost = parseFloat(String(foundPart.precio)) || 0;
            console.log('💰 Usando campo "precio":', foundPart.precio, '→', cost);
          } else if (foundPart.cost !== undefined && foundPart.cost !== null && foundPart.cost !== '') {
            cost = parseFloat(String(foundPart.cost)) || 0;
            console.log('💰 Usando campo "cost":', foundPart.cost, '→', cost);
          } else if (foundPart.price !== undefined && foundPart.price !== null && foundPart.price !== '') {
            cost = parseFloat(String(foundPart.price)) || 0;
            console.log('💰 Usando campo "price":', foundPart.price, '→', cost);
          } else if (foundPart.unitCost !== undefined && foundPart.unitCost !== null && foundPart.unitCost !== '') {
            cost = parseFloat(String(foundPart.unitCost)) || 0;
            console.log('💰 Usando campo "unitCost":', foundPart.unitCost, '→', cost);
          } else if (foundPart.unit_cost !== undefined && foundPart.unit_cost !== null && foundPart.unit_cost !== '') {
            cost = parseFloat(String(foundPart.unit_cost)) || 0;
            console.log('💰 Usando campo "unit_cost":', foundPart.unit_cost, '→', cost);
          } else {
            console.log('❌ No se encontró ningún campo de precio válido');
          }
          
          // Formatear el costo correctamente
          if (cost > 0) {
            updatedParts[index].cost = cost.toFixed(2);
          } else {
            updatedParts[index].cost = '0.00';
          }
          
          console.log('✅ Auto-completando parte:', {
            sku: value,
            part: updatedParts[index].part,
            cost: updatedParts[index].cost,
            originalCostValue: cost,
            foundPartKeys: Object.keys(foundPart)
          });
        } else {
          console.log('❌ No se encontró parte para SKU:', value);
        }
      }

      setNewWorkOrder((prev: typeof newWorkOrder) => ({ ...prev, parts: updatedParts }));
    } else if (showEditForm && editWorkOrder) {
      const updatedParts = [...editWorkOrder.parts];
      updatedParts[index][field as 'part' | 'sku' | 'qty' | 'cost'] = value;

      // Auto-completado cuando se cambia el SKU
      if (field === 'sku' && value && value.trim() !== '') {
        const foundPart = findPartBySku(value);
        if (foundPart) {
          // Autocompletar nombre de la parte
          updatedParts[index].part = foundPart.part || foundPart.description || foundPart.name || '';
          
          // Autocompletar costo - PRIORIDAD AL CAMPO 'precio' de la tabla inventory
          let cost = 0;
          if (foundPart.precio !== undefined && foundPart.precio !== null && foundPart.precio !== '') {
            cost = parseFloat(String(foundPart.precio)) || 0;
          } else if (foundPart.cost !== undefined && foundPart.cost !== null && foundPart.cost !== '') {
            cost = parseFloat(String(foundPart.cost)) || 0;
          } else if (foundPart.price !== undefined && foundPart.price !== null && foundPart.price !== '') {
            cost = parseFloat(String(foundPart.price)) || 0;
          } else if (foundPart.unitCost !== undefined && foundPart.unitCost !== null && foundPart.unitCost !== '') {
            cost = parseFloat(String(foundPart.unitCost)) || 0;
          } else if (foundPart.unit_cost !== undefined && foundPart.unit_cost !== null && foundPart.unit_cost !== '') {
            cost = parseFloat(String(foundPart.unit_cost)) || 0;
          }
          
          // Formatear el costo correctamente
          updatedParts[index].cost = cost > 0 ? cost.toFixed(2) : '0.00';
          
          console.log('✅ Auto-completando parte en edición:', {
            sku: value,
            part: updatedParts[index].part,
            cost: updatedParts[index].cost,
            foundPart
          });
        }      }

      setEditWorkOrder((prev: any) => ({ ...prev, parts: updatedParts }));
    }
  };

  // Guardar nueva orden
  const handleAddWorkOrder = async (datosOrden: any) => {
    setLoading(true);
    try {
      // 0a. Validate ID Classic is required when status is FINISHED
      if (datosOrden.status === 'FINISHED') {
        if (!datosOrden.idClassic || datosOrden.idClassic.trim() === '') {
          setIdClassicError('⚠️ ID Classic is required when status is FINISHED!');
          alert('Error: ID Classic is required when status is FINISHED. Please enter an ID Classic.');
          setLoading(false);
          return;
        }
      }

      // 0b. Validate ID Classic doesn't already exist (when provided)
      if (datosOrden.idClassic && checkIdClassicExists(datosOrden.idClassic)) {
        setIdClassicError(`⚠️ Work Order with ID Classic "${datosOrden.idClassic}" already exists!`);
        alert(`Error: Work Order with ID Classic "${datosOrden.idClassic}" already exists. Please use a different ID.`);
        setLoading(false);
        return;
      }

      // 0c. Validar que no exista una W.O. activa (PROCESSING o APPROVED) para la misma traila
      const trailerToCheck = datosOrden.trailer?.trim();
      if (trailerToCheck) {
        const duplicateWO = workOrders.find(
          wo => wo.trailer && wo.trailer.toString().trim().toLowerCase() === trailerToCheck.toLowerCase() &&
            (wo.status === 'PROCESSING' || wo.status === 'APPROVED')
        );
        if (duplicateWO) {
          const msg = `Ya existe una Work Order para la traila "${trailerToCheck}" en estado PROCESSING o APPROVED (ID: ${duplicateWO.id}, Fecha: ${duplicateWO.date ? duplicateWO.date.slice(0,10) : ''}).\n¿Desea continuar y crear la orden de todos modos?`;
          const proceed = window.confirm(msg);
          if (!proceed) {
            setLoading(false);
            return;
          }
        }
      }

      // 1. Prepara las partes a descontar
      const partesUsadas = datosOrden.parts
        .filter((p: any) => p.sku && p.qty && Number(p.qty) > 0)
        .map((p: any) => ({
          sku: p.sku,
          qty: Number(p.qty)
        }));      // 2. Descuenta del inventario usando FIFO
      let fifoResult: any = null;
      if (partesUsadas.length > 0) {
        try {
          const fifoResponse = await axios.post(`${API_URL}/inventory/deduct-fifo`, {
            parts: partesUsadas,
            usuario: localStorage.getItem('username') || 'unknown'
          });
          fifoResult = fifoResponse.data;
          console.log('✅ FIFO deduction successful:', fifoResult);
        } catch (fifoError) {
          console.error('❌ FIFO deduction failed, falling back to regular deduction:', fifoError);
          // Fallback al método anterior si FIFO falla
          await axios.post(`${API_URL}/inventory/deduct`, {
            parts: partesUsadas,
            usuario: localStorage.getItem('username') || 'unknown'
          });
        }
      }

      // 3. Prepara partes para guardar en la orden
      const partesParaGuardar = datosOrden.parts
        .filter((p: any) => p.sku && String(p.sku).trim() !== '') // Solo partes con SKU
        .map((p: any) => ({
          sku: p.sku,
          part: p.part,
          qty: Number(p.qty),
          cost: Number(String(p.cost).replace(/[^0-9.]/g, ''))
        }));

      // LIMPIA EL TOTAL ANTES DE ENVIAR
      const totalLabAndPartsLimpio = Number(String(datosOrden.totalLabAndParts).replace(/[^0-9.]/g, ''));
      // Formatear la fecha SOLO si está en formato MM/DD/YYYY, para mostrar y PDF, pero backend acepta lo que el usuario puso
      let dateToSend = datosOrden.date;
      // NO modificar el formato para el backend, solo enviar lo que el usuario puso
      const res = await axios.post(`${API_URL}/work-orders`, {
        ...datosOrden,
        totalLabAndParts: totalLabAndPartsLimpio, // <-- ENVÍA EL TOTAL LIMPIO
        parts: partesParaGuardar,
        extraOptions,
        usuario: localStorage.getItem('username') || ''
      });
      const data = res.data as { id: number, pdfUrl?: string };
      const newWorkOrderId = data.id;      // REGISTRA PARTES USADAS EN work_order_parts con información FIFO
      for (const part of partesParaGuardar) {
        // Buscar información FIFO para esta parte
        let fifoInfoForPart = null;
        if (fifoResult && fifoResult.details) {
          fifoInfoForPart = fifoResult.details.find((f: any) => f.sku === part.sku);
        }
        
        await axios.post(`${API_URL}/work-order-parts`, {
          work_order_id: newWorkOrderId,
          sku: part.sku,
          part_name: inventory.find(i => i.sku === part.sku)?.part || '',
          qty_used: part.qty,
          cost: Number(String(part.cost).replace(/[^0-9.]/g, '')), // <-- LIMPIA AQUÍ TAMBIÉN
          fifo_info: fifoInfoForPart, // Pasar información FIFO
          usuario: localStorage.getItem('username') || ''        });
      }

      // MARCAR PARTES PENDIENTES COMO USED (crítico para campanitas)
      // Buscar partes que vienen de partes pendientes (_pendingPartId)
      const partesConPendingId = datosOrden.parts.filter((p: any) => p._pendingPartId);
      console.log(`🔍 Partes pendientes encontradas en nueva WO: ${partesConPendingId.length}`);
      
      for (const part of partesConPendingId) {
        try {
          console.log(`🔄 Marcando parte pendiente ${part._pendingPartId} como USED en nueva WO...`);
          await axios.put(`${API_URL}/receive/${part._pendingPartId}/mark-used`, {
            usuario: localStorage.getItem('username') || ''
          });
          console.log(`✅ Parte pendiente ${part._pendingPartId} marcada como USED en nueva WO`);
        } catch (error) {
          console.error(`❌ Error marcando parte pendiente ${part._pendingPartId} como USED en nueva WO:`, error);
        }
      }

      console.log('✅ Partes pendientes procesadas. Sistema FIFO también manejó automáticamente otras partes.');// Muestra mensaje de éxito
      alert(`¡Orden de trabajo #${newWorkOrderId} creada exitosamente!`);// NUEVA FUNCIONALIDAD: Generar PDF y abrir enlaces de facturas
      try {
        console.log('🔄 Intentando generar PDF para work order:', newWorkOrderId);
        
        // Obtener datos completos de la orden recién creada
        const workOrderRes = await axios.get(`${API_URL}/work-orders/${newWorkOrderId}`, { timeout: 10000 });
        const workOrderData = workOrderRes.data as any;
        
        console.log('✅ Datos de work order obtenidos:', workOrderData);
        
        // Validar que tenemos los datos mínimos necesarios
        if (!workOrderData || !workOrderData.id) {
          console.error('❌ Datos de work order inválidos o incompletos');
          return;
        }
          // Obtener partes usadas con sus enlaces de facturas
        const partsRes = await axios.get(`${API_URL}/work-order-parts/${newWorkOrderId}`, { timeout: 10000 });
        const partsWithInvoices = Array.isArray(partsRes.data) ? partsRes.data : [];
        
        console.log('✅ Partes de work order obtenidas:', partsWithInvoices.length, 'partes');
        
        // Enriquecer partes con invoice links del inventario si no los tienen
        const enrichedParts = partsWithInvoices.map((part: any) => {
          // Si la parte ya tiene invoiceLink, usarlo
          if (part.invoiceLink) {
            return { ...part, invoice_number: 'FIFO Invoice' };
          }
          
          // Si no, buscar en el inventario
          const inventoryItem = inventory.find((item: any) => item.sku === part.sku);
          return {
            ...part,
            invoiceLink: inventoryItem?.invoiceLink || null,
            invoice_number: inventoryItem?.invoiceLink ? 'Inventory Invoice' : 'N/A'
          };
        });
          console.log('✅ Partes enriquecidas con invoice data:', enrichedParts);

        // Preparar datos para el PDF con validaciones robustas
        const pdfData = {
          id: workOrderData.id || newWorkOrderId,
          idClassic: workOrderData.idClassic || workOrderData.id?.toString() || newWorkOrderId.toString(),
          customer: workOrderData.billToCo || workOrderData.customer || '',
          trailer: workOrderData.trailer || '',
          date: formatDateSafely(workOrderData.date || workOrderData.fecha || ''),
          mechanics: Array.isArray(workOrderData.mechanics) ? 
            workOrderData.mechanics.map((m: any) => `${m.name} (${m.hrs}h)`).join(', ') :
            workOrderData.mechanics || workOrderData.mechanic || '',
          description: workOrderData.description || '',
          status: workOrderData.status || datosOrden.status || 'PROCESSING', // Incluir status actual
          parts: enrichedParts.map((part: any) => {
            // Buscar la parte original del formulario para obtener descripción y U/M personalizada
            const formPart = (datosOrden.parts || []).find((p: any) => p.sku === part.sku);
            // Buscar en inventario para obtener U/M por defecto si no hay personalizada
            const inventoryItem = inventory.find((item: any) => item.sku === part.sku);
            return {
              sku: part.sku || '',
              // Descripción: si el usuario la modificó en el form, usar esa, si no, la de inventario o la de la BD
              description: (formPart && formPart.part && formPart.part.trim() !== '' ? formPart.part : (inventoryItem?.part || inventoryItem?.description || part.part_name || part.sku || 'N/A')),
              // U/M: si el usuario la modificó en el form, usar esa, si no, la de inventario, si no, la de la BD, si no, 'EA'
              um: (formPart && formPart.um && formPart.um.trim() !== '' ? formPart.um : (inventoryItem?.um || inventoryItem?.unit || part.um || 'EA')),
              qty: Number(part.qty_used) || 0,
              unitCost: Number(part.cost) || 0,
              total: (Number(part.qty_used) || 0) * (Number(part.cost) || 0),
              invoice: part.invoice_number || 'N/A',
              invoiceLink: part.invoiceLink  // Usar el campo correcto de la BD
            };
          }),
          laborCost: (() => {
            // Si el backend ya envió el total correcto, calcular labor como total - partes
            const totalLabAndParts = Number(workOrderData.totalLabAndParts) || 0;
            const subtotalParts = enrichedParts.reduce((sum, part) => sum + ((Number(part.qty_used) || 0) * (Number(part.cost) || 0)), 0);
            const labor = totalLabAndParts - subtotalParts;
            // Si labor es negativo, forzar a 0
            return labor >= 0 ? labor : 0;
          })(),
          subtotalParts: enrichedParts.reduce((sum: number, part: any) => 
            sum + ((Number(part.qty_used) || 0) * (Number(part.cost) || 0)), 0),
          totalCost: Number(workOrderData.totalLabAndParts) || 0,
          extraOptions: datosOrden.extraOptions || extraOptions || [],
          // NUEVO: Agregar el porcentaje de Miscellaneous EXACTO que el usuario colocó
          // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.
        };
        
        console.log('📄 Datos preparados para PDF:', pdfData);
          // Generar PDF
        const pdf = await generateWorkOrderPDF(pdfData);
        
        // Generar blob para guardar en BD
        const pdfBlob = pdf.output('blob');
        
        // Guardar PDF en la base de datos
        try {
          await savePDFToDatabase(workOrderData.id, pdfBlob);
          console.log('✅ PDF guardado en BD correctamente');
        } catch (dbError) {
          console.warn('⚠️ No se pudo guardar PDF en BD:', dbError);
        }
          // Abrir PDF en nueva pestaña
        openPDFInNewTab(pdf, `work_order_${pdfData.idClassic}.pdf`);

  // Open invoice links once (includes any Google Drive links)
  openInvoiceLinks(pdfData.parts);

  // Removed duplicate openings (backend PDF + per-link Drive) to avoid blank tabs
  console.log('✅ PDF generated and invoice links opened (deduplicated)');
      } catch (pdfError: any) {
        console.error('❌ Error generando PDF:', pdfError);
        console.error('❌ Detalles del error:', {
          message: pdfError.message,
          response: pdfError.response?.data,
          status: pdfError.response?.status
        });
          // Crear PDF básico con los datos que tenemos
        try {          const basicPdfData = {
            id: newWorkOrderId,
            idClassic: newWorkOrderId.toString(),
            customer: datosOrden.billToCo || '',
            trailer: datosOrden.trailer || '',
            date: formatDateSafely(datosOrden.date || ''),
            mechanics: Array.isArray(datosOrden.mechanics) ? 
              datosOrden.mechanics.map((m: any) => `${m.name} (${m.hrs}h)`).join(', ') : '',
            description: datosOrden.description || '',
            status: datosOrden.status || 'PROCESSING', // Incluir status actual
            parts: datosOrden.parts.map((part: any) => {
              const invItem = inventory.find((item: any) => String(item.sku).toLowerCase() === String(part.sku || '').toLowerCase());
              let um = String((invItem?.um ?? invItem?.unit ?? 'EA') as any).toUpperCase();
              if (um === 'GAL') um = 'GALM';
              return {
                sku: part.sku || '',
                description: part.part || 'N/A',
                um,
                qty: Number(part.qty) || 0,
                unitCost: Number(part.cost) || 0,
                total: (Number(part.qty) || 0) * (Number(part.cost) || 0),
                invoice: 'N/A',
                invoiceLink: undefined
              };
            }),
            laborCost: Number(datosOrden.totalHrs || 0) * 60 || 0,
            subtotalParts: datosOrden.parts.reduce((sum: number, part: any) => 
              sum + ((Number(part.qty) || 0) * (Number(part.cost) || 0)), 0),
            totalCost: Number(datosOrden.totalLabAndParts) || 0,
            extraOptions: datosOrden.extraOptions || extraOptions || [],
            // NUEVO: Agregar el porcentaje de Welding Supplies EXACTO que el usuario colocó
            // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.
          };
            const pdf = await generateWorkOrderPDF(basicPdfData);
          openPDFInNewTab(pdf, `work_order_${newWorkOrderId}_basic.pdf`);
  // PDF básico fallback generado (log removed)
        } catch (fallbackError) {
          console.error('❌ Error generando PDF básico:', fallbackError);
        }
      }

      if (data.pdfUrl) {
        window.open(`${API_URL}${data.pdfUrl}`, '_blank', 'noopener,noreferrer');
      }        // Cierra el formulario y resetea COMPLETAMENTE
      setShowForm(false);
      
      // Reseteo completo del formulario
  // Work Order guardada - limpiando formulario (log removed)
      resetNewWorkOrder();
      setExtraOptions([]);
      setPendingPartsQty({});
      setSelectedPendingParts([]);
      setIdClassicError('');      // Actualiza la tabla inmediatamente
      await fetchWorkOrders();
      
      // 🔔 ACTUALIZAR TRAILERS CON PARTES PENDIENTES para quitar campanitas
  // Actualizando trailers con partes pendientes tras crear WO (log removed)
      await fetchTrailersWithPendingParts();
  // Trailers con partes pendientes actualizados (log removed)
      
    } catch (err: any) {
      console.error('Error al guardar la orden:', err);
      alert(`Error al guardar la orden: ${err.response?.data?.error || err.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  // Función para obtener partes pendientes para una traila
  const fetchPendingParts = async (trailer: string) => {
    if (!trailer) {
      setPendingParts([]);
      return;
    }
    try {
  // Obteniendo partes pendientes (log removed)
      const res = await axios.get(`${API_URL}/receive/pending/${encodeURIComponent(trailer)}`);
  // Partes pendientes obtenidas (log removed)
      setPendingParts(res.data as any[]);
    } catch (error) {
  // Error obteniendo partes pendientes (log removed)
      setPendingParts([]);    }
  };

  const partesSeleccionadas = pendingParts.filter((p: any) => selectedPendingParts.includes(p.id));

  // NOTA: useEffect problemático removido - causaba que se borraran las partes agregadas manualmente
  // El sistema ahora usa botones "Add Part" individuales en lugar de selección múltiple

  // Calcula el total cada vez que cambian las partes o las horas
  useEffect(() => {
    // SOLO calcular el total si el campo está vacío o el usuario no lo ha editado manualmente
    if (showForm) {
      // Si el usuario NO ha editado manualmente el total, calcular automático
      const totalValue = String(newWorkOrder.totalLabAndParts);
      if (!totalValue || totalValue === '' || totalValue === '0' || totalValue === '0.00') {
        const totalHrs = parseFloat(newWorkOrder.totalHrs) || 0;
        const partsCost = newWorkOrder.parts.reduce((sum: number, p: any) => sum + (parseFloat(p.cost) || 0), 0);
        const totalLabAndParts = (totalHrs * 60) + partsCost;
        setNewWorkOrder(prev => ({
          ...prev,
          totalLabAndParts: totalLabAndParts ? totalLabAndParts.toFixed(2) : ''
        }));
      }
      // Si el usuario ya puso un valor manual, NO modificarlo
    }
  }, [newWorkOrder.parts, newWorkOrder.totalHrs, showForm, setNewWorkOrder]);

  useEffect(() => {
    // ✅ NO MODIFICAR NADA AL ABRIR EL EDITOR
    // Preservar TODOS los valores originales tal como se guardaron
    // Solo este useEffect sirve para detectar cambios, pero NO modifica valores
    
    // El formulario debe mostrar exactamente los valores que están en la base de datos
    // sin ningún tipo de recálculo automático
  }, [editWorkOrder?.mechanics, showEditForm]);
  const handleEdit = () => {
    if (selectedRow === null) return;
    const pwd = window.prompt('Enter password to edit:');
    if (pwd === '6214') {
      const found = workOrders.find(wo => wo.id === selectedRow);
      if (found) {
        setEditWorkOrder({
          ...found,
          date: found.date ? found.date.slice(0, 10) : '',
          parts: Array.isArray(found.parts) ? found.parts : [],
          mechanics: Array.isArray(found.mechanics) ? found.mechanics : [],
          // Si tu backend guarda extraOptions como array, úsalo directo
          extraOptions: Array.isArray(found.extraOptions) ? found.extraOptions : [],
        });
        setExtraOptions(Array.isArray(found.extraOptions) ? found.extraOptions : []);
        
        // 🔥 IMPORTANTE: Cargar partes pendientes automáticamente si ya hay un trailer seleccionado.
        if (found.trailer) {
          // Cargar partes pendientes para trailer preseleccionado (log removed)
          fetchPendingParts(found.trailer);
        } else {
          // Si no hay trailer, limpiar partes pendientes
          setPendingParts([]);
        }
        
        setShowEditForm(true);
      }
    } else if (pwd !== null) {
      alert('Incorrect password');
    }
  };

  const handleDelete = async (id: number) => {
    if (id == null) return;
    const pwd = window.prompt('Enter password to delete:');
    if (pwd === '6214') {
      if (window.confirm('Are you sure you want to delete this order?')) {
        try {
          // @ts-ignore
          await axios.delete(`${API_URL}/work-orders/${id}`, {
            headers: { 'Content-Type': 'application/json' },
            data: { usuario: localStorage.getItem('username') || '' }
          } as any);
          setWorkOrders(workOrders.filter((order: any) => order.id !== id));
          setSelectedRow(null);
          alert('Order deleted successfully');
        } catch {
          alert('Error deleting order');
        }
      }
    } else if (pwd !== null) {
      alert('Incorrect password');
    }
  };

  const exportToExcel = () => {
    // Prepara los datos
    const data = filteredOrders.map(order => ({
      ID: order.id,
      'Bill To Co': order.billToCo,
      Trailer: order.trailer,
      Mechanic: order.mechanic,
      Date: order.date?.slice(0, 10),
      Description: order.description,
      Status: order.status,
      'Total HRS': order.totalHrs,
      'Total LAB & PRTS': calcularTotalWO(order),
      ...order.parts.slice(0, 5).reduce((acc: any, part: any, idx: number) => {
        acc[`PRT${idx + 1}`] = part?.sku || '';
        acc[`Qty${idx + 1}`] = part?.qty || '';
        acc[`Costo${idx + 1}`] = part?.cost || '';
        return acc;
      }, {})
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WorkOrders');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'work_orders.xlsx');
  };
  // exportToPDF function removed - was unused

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };
  const modalContentStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    padding: 32,
    minWidth: 400,
    maxWidth: 520,
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
  };

  const addEmptyPart = () => {
    if (showEditForm && editWorkOrder) {
      // Agregar parte vacía al editWorkOrder
      setEditWorkOrder((prev: any) => ({
        ...prev,
        parts: [
          ...(prev.parts || []),
          { part: '', sku: '', qty: '', cost: '' }
        ]
      }));
    } else {
      // Agregar parte vacía al newWorkOrder
      setNewWorkOrder(prev => ({
        ...prev,
        parts: [
          ...prev.parts,
          { part: '', sku: '', qty: '', cost: '' }
        ]
      }));
    }
  };
  // Función para agregar una parte pendiente automáticamente
  const addPendingPart = (pendingPart: any, qtyToUse: number) => {
    console.log('🎯 Agregando parte pendiente a WO:', { pendingPart, qtyToUse });
    
    // Buscar información completa de la parte en el inventario
    const inventoryPart = inventory.find(item => 
      String(item.sku).toLowerCase() === String(pendingPart.sku).toLowerCase()
    );
    
    console.log('📋 Parte encontrada en inventario:', inventoryPart);
    
    // Determinar costo: si viene de receive pendiente, PRIORIDAD al costTax de ese receive
    let cost = 0;
    if (pendingPart && pendingPart.costTax != null && pendingPart.costTax !== '') {
      cost = parseFloat(String(pendingPart.costTax)) || 0;
      console.log('💰 Usando costo por-recepción (costTax) del pendiente:', pendingPart.costTax, '→', cost);
    } else if (inventoryPart) {
      // Fallback: lógica de inventario
      if (inventoryPart.precio != null && inventoryPart.precio !== '') {
        cost = parseFloat(String(inventoryPart.precio)) || 0;
      } else if (inventoryPart.cost != null && inventoryPart.cost !== '') {
        cost = parseFloat(String(inventoryPart.cost)) || 0;
      } else if (inventoryPart.price != null && inventoryPart.price !== '') {
        cost = parseFloat(String(inventoryPart.price)) || 0;
      } else if (inventoryPart.unitCost != null && inventoryPart.unitCost !== '') {
        cost = parseFloat(String(inventoryPart.unitCost)) || 0;
      } else if (inventoryPart.unit_cost != null && inventoryPart.unit_cost !== '') {
        cost = parseFloat(String(inventoryPart.unit_cost)) || 0;
      }
    }
    
  // Crear nueva parte para agregar
    const newPart = {
      sku: pendingPart.sku,
      part: pendingPart.item || pendingPart.part || inventoryPart?.part || inventoryPart?.description || '',
      qty: qtyToUse.toString(),
      cost: cost > 0 ? cost.toFixed(2) : '0.00',
      _pendingPartId: pendingPart.id // Guardar referencia para el procesamiento posterior
    };
      console.log('✅ Nueva parte creada:', newPart);
      // Agregar la parte al formulario correspondiente
    if (showEditForm && editWorkOrder) {
      // Agregar al editWorkOrder - buscar primer slot vacío
      setEditWorkOrder((prev: any) => {
        const updatedParts = [...(prev.parts || [])];
        const emptyIndex = updatedParts.findIndex(p => !p.part && !p.sku);
        
        if (emptyIndex !== -1) {
          // Reemplazar el primer slot vacío
          updatedParts[emptyIndex] = newPart;
        } else {
          // Si no hay slots vacíos, agregar al final
          updatedParts.push(newPart);
        }
        
        return { ...prev, parts: updatedParts };
      });
    } else {
      // Agregar al newWorkOrder - buscar primer slot vacío
      setNewWorkOrder(prev => {
        const updatedParts = [...prev.parts];
        const emptyIndex = updatedParts.findIndex(p => !p.part && !p.sku);
        
        if (emptyIndex !== -1) {
          // Reemplazar el primer slot vacío
          updatedParts[emptyIndex] = newPart;
        } else {
          // Si no hay slots vacíos, agregar al final
          updatedParts.push(newPart);
        }
        
        return { ...prev, parts: updatedParts };
      });
    }
    // Quitar inmediatamente esta parte pendiente del panel verde (UX: ocultar al primer uso)
    setPendingParts(prevPending => prevPending.filter(pp => pp.id !== pendingPart.id));
    // Limpiar la cantidad seleccionada para esta parte
    setPendingPartsQty(prev => {
      const next = { ...prev } as any;
      try { delete next[pendingPart.id]; } catch {}
      return next;
    });
    
    console.log(`🎉 Parte ${pendingPart.sku} agregada exitosamente a la WO con costo $${cost.toFixed(2)}`);
  };
  // handlePartClick function removed - was unused

  // Función para ocultar el tooltip
  const hideTooltip = () => setTooltip({ visible: false, x: 0, y: 0, info: null });

  // Helper: extract multiple URLs from EMPLOYEE WRITTEN HOURS field
  const extractUrls = (text?: string): string[] => {
    if (!text || typeof text !== 'string') return [];
    try {
      const regex = /(https?:\/\/[^\s,;|]+)/gi;
      const matches = text.match(regex) || [];
      // Deduplicate and trim
      const unique = Array.from(new Set(matches.map(s => s.trim())));
      return unique;
    } catch {
      return [];
    }
  };

  const openAllLinks = (urls: string[]) => {
    urls.forEach((u) => {
      try { window.open(u, '_blank', 'noopener,noreferrer'); } catch {}
    });
  };

  const handlePartHover = (e: React.MouseEvent, sku: string) => {
    const partInfo = inventory.find(i => String(i.sku).toLowerCase() === String(sku).toLowerCase());
    if (partInfo) {
      // Derivar posible URL de imagen
      const possibleFields = ['imageUrl','image','img','photo','picture','thumbnail','thumb'];
      let imageUrl = '';
      for (const f of possibleFields) {
        if (partInfo[f]) { imageUrl = partInfo[f]; break; }
      }
      // Si no hay campo directo y hay campo 'sku', construir ruta tentativa
      if (!imageUrl && partInfo.sku) {
        const baseApi = (process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api');
        // Remover /api final para archivos estáticos
        const base = baseApi.replace(/\/api$/,'');
        imageUrl = `${base}/inventory-images/${encodeURIComponent(partInfo.sku)}.jpg`;
      }
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        info: { ...partInfo, _previewImage: imageUrl }
      });
    }
  };

  // Función para cargar trailers con partes pendientes
  const fetchTrailersWithPendingParts = async () => {
    try {
      console.log('🔍 Cargando trailers con partes pendientes...');
      // Agregar timestamp para evitar cache
      const timestamp = Date.now();
      const res = await axios.get(`${API_URL}/receive/trailers/with-pending?t=${timestamp}`);
      console.log('✅ Trailers con partes pendientes:', res.data);
      setTrailersWithPendingParts(res.data as string[]);
    } catch (error) {
      console.error('❌ Error cargando trailers con partes pendientes:', error);
      setTrailersWithPendingParts([]);    }
  };

  // Función para visualizar PDF de Work Order existente
  const handleViewPDF = async (workOrderId: number) => {
    try {
      console.log('🔄 Generando PDF para Work Order existente:', workOrderId);
      
      // 1. Obtener datos de la Work Order desde la tabla actual (más confiable)
      const workOrderFromTable = workOrders.find(wo => wo.id === workOrderId);
      console.log('📊 Work Order desde tabla:', workOrderFromTable);
      
      // 2. También obtener desde API como respaldo
      const workOrderResponse = await axios.get(`${API_URL}/work-orders/${workOrderId}`);
      const workOrderData = workOrderResponse.data as any;
      console.log('📊 Work Order desde API:', workOrderData);
      
      // 3. Usar datos de la tabla como prioridad, API como respaldo
      const finalWorkOrderData = workOrderFromTable || workOrderData;
      console.log('📊 Datos finales de Work Order:', finalWorkOrderData);
      
      // 4. Obtener partes de la Work Order (intentar desde tabla primero, luego API)
      let workOrderParts: any[] = [];
      
      // Si tiene partes en la tabla, usarlas
      if (finalWorkOrderData.parts && Array.isArray(finalWorkOrderData.parts) && finalWorkOrderData.parts.length > 0) {
        console.log('📦 Usando partes desde tabla:', finalWorkOrderData.parts);
        workOrderParts = finalWorkOrderData.parts.map((part: any, index: number) => ({
          id: `table_${index}`,
          sku: part.sku || '',
          part_name: part.part || part.description || '',
          qty_used: Number(part.qty) || 0,
          cost: Number(String(part.cost).replace(/[^0-9.]/g, '')) || 0,
          invoiceLink: null,
          invoice_number: 'N/A'
        }));
      } else {
        // Si no hay partes en tabla, obtener del API
        try {
          const partsResponse = await axios.get(`${API_URL}/work-order-parts/${workOrderId}`);
          workOrderParts = Array.isArray(partsResponse.data) ? partsResponse.data : [];
          console.log('📦 Partes desde API:', workOrderParts);
        } catch (partsError) {
          console.warn('⚠️ No se pudieron obtener partes del API:', partsError);
          workOrderParts = [];
        }
      }
      
      // 5. Enriquecer partes con invoice links del inventario
      const enrichedParts = workOrderParts.map((part: any) => {
        const inventoryItem = inventory.find(item => item.sku === part.sku);
        return {
          ...part,
          invoiceLink: part.invoiceLink || inventoryItem?.invoiceLink || inventoryItem?.invoice_link,
          invoice_number: part.invoice_number || 'N/A'
        };
      });
        // 6. Procesar mecánicos correctamente
      let mechanicsString = '';
      let totalHrs = 0;
      
      console.log('🔍 Procesando mechanics:', {
        mechanic: finalWorkOrderData.mechanic,
        mechanics: finalWorkOrderData.mechanics,
        totalHrs: finalWorkOrderData.totalHrs
      });
      
      // PRIORIDAD 1: Campo mechanic simple
      if (finalWorkOrderData.mechanic && finalWorkOrderData.mechanic.trim() !== '') {
        mechanicsString = finalWorkOrderData.mechanic;
        totalHrs = Number(finalWorkOrderData.totalHrs) || 0;
        console.log('👷 Usando mechanic simple:', mechanicsString, 'Horas:', totalHrs);
      } 
      // PRIORIDAD 2: Array de mechanics
      else if (finalWorkOrderData.mechanics) {
        try {
          let mechanicsArray = finalWorkOrderData.mechanics;
          
          // Si es string JSON, parsearlo
          if (typeof mechanicsArray === 'string') {
            mechanicsArray = JSON.parse(mechanicsArray);
          }
          
          // Si es array, procesarlo
          if (Array.isArray(mechanicsArray) && mechanicsArray.length > 0) {
            mechanicsString = mechanicsArray.map((m: any) => {
              const hrs = Number(m.hrs) || 0;
              totalHrs += hrs;
              const name = m.name || m.mechanic || 'Unknown';
              return `${name} (${hrs}h)`;
            }).join(', ');
            console.log('👷 Usando mechanics array:', mechanicsString, 'Total hrs:', totalHrs);
          } else {
            console.log('⚠️ Mechanics array vacío o inválido');
          }
        } catch (error) {
          console.warn('⚠️ Error procesando mechanics:', error);
          mechanicsString = String(finalWorkOrderData.mechanics || '');
        }
      }
      
      // Si no hay horas del procesamiento de mechanics, usar totalHrs directo.
      if (totalHrs === 0) {
        totalHrs = Number(finalWorkOrderData.totalHrs) || 0;
        console.log('📊 Usando totalHrs directo:', totalHrs);      }        // 7. Procesar fecha correctamente sin problemas de zona horaria
      const formattedDate = formatDateSafely(finalWorkOrderData.date || '') || 
                           formatDateSafely(finalWorkOrderData.fecha || '') || 
                           new Date().toLocaleDateString('en-US');
      console.log('📅 Fecha procesada:', formattedDate, 'desde:', finalWorkOrderData.date);
      
      // 8. Obtener customer correctamente
      const customer = finalWorkOrderData.billToCo || 
                      finalWorkOrderData.customer || 
                      finalWorkOrderData.bill_to_co || 
                      'N/A';
      console.log('🏢 Customer procesado:', customer);
      
      // 9. Calcular totales correctamente
      const subtotalParts = enrichedParts.reduce((sum: number, part: any) => 
        sum + ((Number(part.qty_used) || 0) * (Number(part.cost) || 0)), 0);
      
      const laborCost = totalHrs * 60; // $60 por hora
      
      const totalCost = Number(finalWorkOrderData.totalLabAndParts) || (laborCost + subtotalParts);
      
      console.log('💰 Cálculos de totales:', {
        totalHrs,
        laborCost,
        subtotalParts,
        totalLabAndParts: finalWorkOrderData.totalLabAndParts,
        finalTotalCost: totalCost
      });        // 10. Preparar datos para el PDF con todos los datos correctos
      const pdfData = {
        id: finalWorkOrderData.id || workOrderId,
        idClassic: finalWorkOrderData.idClassic || finalWorkOrderData.id?.toString() || workOrderId.toString(),
        customer: customer,
        trailer: finalWorkOrderData.trailer || '',
        date: formattedDate,
        mechanics: mechanicsString || '',
        description: finalWorkOrderData.description || '',
        status: finalWorkOrderData.status || 'PROCESSING', // Incluir status actual
        parts: enrichedParts.map((part: any) => {
          const invItem = inventory.find((item: any) => String(item.sku).toLowerCase() === String(part.sku || '').toLowerCase());
          let um = String((invItem?.um ?? invItem?.unit ?? 'EA') as any).toUpperCase();
          if (um === 'GAL') um = 'GALM';
          return {
            sku: part.sku || '',
            description: part.part_name || part.sku || 'N/A',
            um,
            qty: Number(part.qty_used) || 0,
            unitCost: Number(part.cost) || 0,
            total: (Number(part.qty_used) || 0) * (Number(part.cost) || 0),
            invoice: part.invoice_number || 'N/A',
            invoiceLink: part.invoiceLink
    };
  }),
  laborCost: laborCost,
        subtotalParts: subtotalParts,
        totalCost: totalCost,
        extraOptions: finalWorkOrderData.extraOptions || [],
        // NUEVO: Agregar el porcentaje de Welding Supplies EXACTO que el usuario colocó
        // Miscellaneous and Welding Supplies logic removed. Only sum parts and labor for total.
      };
      
      console.log('📄 Datos finales preparados para PDF:', pdfData);
      console.log('🔢 Totales calculados:', {
        totalHrs,
        laborCost,
        subtotalParts,
        totalCost,
        partsCount: enrichedParts.length
      });
      
      // 10. Generar PDF
      const pdf = await generateWorkOrderPDF(pdfData);
        // 11. Abrir PDF en nueva pestaña
      openPDFInNewTab(pdf, `work_order_${pdfData.idClassic}_view.pdf`);
      
      // 12. Abrir enlaces de facturas automáticamente
      openInvoiceLinks(pdfData.parts);
      
      console.log('✅ PDF visualizado y enlaces de facturas abiertos para WO existente');
      
    } catch (error: any) {
      console.error('❌ Error al visualizar PDF:', error);
      console.error('❌ Detalles del error:', error.response?.data);
      alert(`Error al generar PDF: ${error.message}`);
    }
  };
  // Función para eliminar una parte
  const deletePart = (index: number) => {
    if (showEditForm && editWorkOrder) {
      // Eliminar parte del editWorkOrder
      setEditWorkOrder((prev: any) => ({
        ...prev,
        parts: (prev.parts || []).filter((_: any, i: number) => i !== index)
      }));
    } else {
      // Eliminar parte del newWorkOrder
      setNewWorkOrder(prev => ({
        ...prev,
        parts: prev.parts.filter((_, i) => i !== index)
      }));
    }
  };  return (
    <>
      <style>
        {`
          .parts-tooltip {
            position: relative;
            display: inline-block;
          }
          .parts-tooltip-text {
            visibility: hidden;
            width: 220px;
            background-color: #222;
            color: #fff;
            text-align: left;
            border-radius: 6px;
            padding: 8px;
            position: absolute;
            z-index: 1;
            top: 120%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.2s;
            font-size: 13px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          .parts-tooltip:hover .parts-tooltip-text {
            visibility: visible;
            opacity: 1;
          }
          
          .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #1976d2;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .blink-animation {
            animation: blink 2s infinite;
          }
          
          @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
          }
          
          .btn-success:hover {
            background: #1565c0;
          }
          
          .wo-table {
            border-collapse: collapse;
            width: max-content;
            min-width: 100%;
            font-size: 10px;
            text-align: center;
            margin-top: 16px;
            background: white;
          }
          
          .wo-table th, .wo-table td {
            border: 1px solid #d0d7e2;
            padding: 4px 2px;
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
          }
          
          .wo-table th:nth-child(1), .wo-table td:nth-child(1) { width: 45px; } /* ID */
          .wo-table th:nth-child(2), .wo-table td:nth-child(2) { width: 85px; } /* ID CLASSIC */
          .wo-table th:nth-child(3), .wo-table td:nth-child(3) { width: 75px; } /* Bill To Co */
          .wo-table th:nth-child(4), .wo-table td:nth-child(4) { width: 85px; } /* Trailer */
          .wo-table th:nth-child(5), .wo-table td:nth-child(5) { width: 85px; } /* Mechanic */
          .wo-table th:nth-child(6), .wo-table td:nth-child(6) { width: 95px; } /* Date */
          .wo-table th:nth-child(7), .wo-table td:nth-child(7) { width: 220px; white-space: normal; } /* Description */
          .wo-table th:nth-child(8), .wo-table td:nth-child(8) { width: 65px; } /* PRT1 */
          .wo-table th:nth-child(9), .wo-table td:nth-child(9) { width: 45px; } /* Qty1 */
          .wo-table th:nth-child(10), .wo-table td:nth-child(10) { width: 65px; } /* Costo1 */
          .wo-table th:nth-child(11), .wo-table td:nth-child(11) { width: 65px; } /* PRT2 */
          .wo-table th:nth-child(12), .wo-table td:nth-child(12) { width: 45px; } /* Qty2 */
          .wo-table th:nth-child(13), .wo-table td:nth-child(13) { width: 65px; } /* Costo2 */
          .wo-table th:nth-child(14), .wo-table td:nth-child(14) { width: 65px; } /* PRT3 */
          .wo-table th:nth-child(15), .wo-table td:nth-child(15) { width: 45px; } /* Qty3 */
          .wo-table th:nth-child(16), .wo-table td:nth-child(16) { width: 65px; } /* Costo3 */
          .wo-table th:nth-child(17), .wo-table td:nth-child(17) { width: 65px; } /* PRT4 */
          .wo-table th:nth-child(18), .wo-table td:nth-child(18) { width: 45px; } /* Qty4 */
          .wo-table th:nth-child(19), .wo-table td:nth-child(19) { width: 65px; } /* Costo4 */
          .wo-table th:nth-child(20), .wo-table td:nth-child(20) { width: 65px; } /* PRT5 */
          .wo-table th:nth-child(21), .wo-table td:nth-child(21) { width: 45px; } /* Qty5 */
          .wo-table th:nth-child(22), .wo-table td:nth-child(22) { width: 65px; } /* Costo5 */
          .wo-table th:nth-child(23), .wo-table td:nth-child(23) { width: 70px; } /* Total HRS */
          .wo-table th:nth-child(24), .wo-table td:nth-child(24) { width: 85px; } /* Total LAB & PRTS */
          .wo-table th:nth-child(25), .wo-table td:nth-child(25) { width: 85px; } /* Status */
          .wo-table th:nth-child(26), .wo-table td:nth-child(26) { width: 130px; } /* Acciones */
          
          .wo-table th {
            background: #1976d2;
            color: white;
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
          }
          
          .wo-table td {
            font-size: 11px;
          }
          
          .wo-table tr {
            transition: background-color 0.1s;
          }
          
          .wo-table tr:hover {
            background-color: #e3f2fd !important;
          }
          
          .wo-table tr.selected {
            background-color: #bbdefb !important;
          }
          
          .status-processing { 
            background: #fff3e0; 
            color: #e65100; 
            font-weight: 600; 
          }
          .status-approved { 
            background: #e8f5e8; 
            color: #2e7d32; 
            font-weight: 600; 
          }
          .status-finished { 
            background: #e1f5fe; 
            color: #0277bd; 
            font-weight: 600; 
          }
          
          .search-filters {
            background: white;
            padding: 16px;
            margin-bottom: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
          }
          
          .search-filters input, .search-filters select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
          }
          
          .error-border {
            border: 2px solid #d32f2f !important;
            background-color: #ffebee !important;
          }
          
          .error-text {
            color: #d32f2f;
            font-size: 12px;
            font-weight: 600;
            margin-top: 4px;
          }          
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
          }
          
          .reconnect-btn {
            margin-left: 8px;
            padding: 4px 8px;
            border: none;
            border-radius: 12px;
            background: #1976d2;
            color: white;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .reconnect-btn:hover {
            background: #1565c0;
          }
          
          .wo-table {
            border-collapse: collapse;
            width: 100%;
            min-width: 1750px;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(25,118,210,0.07);
            font-size: 11px;
          }

          .wo-table.compact {
            min-width: 1100px;
          }
          
          .wo-table th, .wo-table td {
            border: 1px solid #d0d7e2;
            padding: 2px 4px;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
          }
          
          .wo-table th:nth-child(1), .wo-table td:nth-child(1) { width: 45px; } /* ID */
          .wo-table th:nth-child(2), .wo-table td:nth-child(2) { width: 50px; } /* ID CLASSIC */
          /* EMP WRITTEN HRS (should be 8th or 9th depending on columns) */
          .wo-table th:nth-child(8), .wo-table td:nth-child(8) { width: 45px; } /* EMP WRITTEN HRS */
          .wo-table th:nth-last-child(6), .wo-table td:nth-last-child(6) { width: 45px; } /* Total HRS */
          .wo-table th:nth-child(3), .wo-table td:nth-child(3) { width: 75px; } /* Bill To Co */
          .wo-table th:nth-child(4), .wo-table td:nth-child(4) { width: 85px; } /* Trailer */
          .wo-table th:nth-child(5), .wo-table td:nth-child(5) { width: 85px; } /* Mechanic */
          .wo-table th:nth-child(6), .wo-table td:nth-child(6) { width: 95px; } /* Date */
          .wo-table th:nth-child(7), .wo-table td:nth-child(7) { width: 220px; white-space: normal; } /* Description */
          .wo-table th:nth-child(8), .wo-table td:nth-child(8) { width: 65px; } /* PRT1 */
          .wo-table th:nth-child(9), .wo-table td:nth-child(9) { width: 45px; } /* Qty1 */
          .wo-table th:nth-child(10), .wo-table td:nth-child(10) { width: 65px; } /* Costo1 */
          .wo-table th:nth-child(11), .wo-table td:nth-child(11) { width: 65px; } /* PRT2 */
          .wo-table th:nth-child(12), .wo-table td:nth-child(12) { width: 45px; } /* Qty2 */
          .wo-table th:nth-child(13), .wo-table td:nth-child(13) { width: 65px; } /* Costo2 */
          .wo-table th:nth-child(14), .wo-table td:nth-child(14) { width: 65px; } /* PRT3 */
          .wo-table th:nth-child(15), .wo-table td:nth-child(15) { width: 45px; } /* Qty3 */
          .wo-table th:nth-child(16), .wo-table td:nth-child(16) { width: 65px; } /* Costo3 */
          .wo-table th:nth-child(17), .wo-table td:nth-child(17) { width: 65px; } /* PRT4 */
          .wo-table th:nth-child(18), .wo-table td:nth-child(18) { width: 45px; } /* Qty4 */
          .wo-table th:nth-child(19), .wo-table td:nth-child(19) { width: 65px; } /* Costo4 */
          .wo-table th:nth-child(20), .wo-table td:nth-child(20) { width: 65px; } /* PRT5 */
          .wo-table th:nth-child(21), .wo-table td:nth-child(21) { width: 45px; } /* Qty5 */
          .wo-table th:nth-child(22), .wo-table td:nth-child(22) { width: 65px; } /* Costo5 */
          .wo-table th:nth-child(23), .wo-table td:nth-child(23) { width: 75px; } /* Total HRS */
          .wo-table th:nth-child(24), .wo-table td:nth-child(24) { width: 110px; } /* Total LAB & PRTS */
          .wo-table th:nth-child(25), .wo-table td:nth-child(25) { width: 95px; } /* Status */

          /* Compact table tweaks */
          .wo-table.compact th, .wo-table.compact td { padding: 2px 3px; }
          .wo-table.compact th:nth-child(1), .wo-table.compact td:nth-child(1) { width: 40px; }
          .wo-table.compact th:nth-child(2), .wo-table.compact td:nth-child(2) { width: 48px; }
          .wo-table.compact th:nth-child(3), .wo-table.compact td:nth-child(3) { width: 70px; }
          .wo-table.compact th:nth-child(4), .wo-table.compact td:nth-child(4) { width: 75px; }
          .wo-table.compact th:nth-child(5), .wo-table.compact td:nth-child(5) { width: 75px; }
          .wo-table.compact th:nth-child(6), .wo-table.compact td:nth-child(6) { width: 85px; }
          .wo-table.compact th:nth-child(7), .wo-table.compact td:nth-child(7) { width: 180px; }
          .wo-table.compact th:nth-child(8), .wo-table.compact td:nth-child(8) { width: 55px; }
          .wo-table.compact th:nth-child(9), .wo-table.compact td:nth-child(9) { width: 260px; white-space: normal; }
          .wo-table.compact th:nth-child(10), .wo-table.compact td:nth-child(10) { width: 60px; }
          .wo-table.compact th:nth-child(11), .wo-table.compact td:nth-child(11) { width: 105px; }
          .wo-table.compact th:nth-child(12), .wo-table.compact td:nth-child(12) { width: 85px; }
          
          .wo-table th {
            background: #1976d2;
            color: #fff;
            font-weight: 700;
            font-size: 13px;
            border-bottom: 2px solid #1565c0;
          }
          
          .wo-table tr:last-child td {
            border-bottom: 1px solid #d0d7e2;
          }
          
          /* Colores por estatus */
          .wo-row-approved {
            background: #43a047 !important; /* Verde fuerte */
            color: #fff !important;
          }
          .wo-row-finished {
            background: #ffd600 !important; /* Amarillo fuerte */
            color: #333 !important;
          }
          .wo-row-processing {
            background: #fff !important; /* Blanco */
            color: #1976d2 !important;
          }
          .wo-row-selected {
            outline: 2px solid #1976d2 !important;
            box-shadow: 0 0 0 2px #1976d233;
          }
        `}
      </style>      
      {tooltip.visible && tooltip.info && (
        <div
          style={{
            position: 'fixed',
            top: tooltip.y + 10,
            left: tooltip.x + 10,
            background: '#fff',
            border: '1px solid #1976d2',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(25,118,210,0.15)',
            padding: 16,
            zIndex: 9999,
            minWidth: 240,
            maxWidth: 360
          }}
          onClick={hideTooltip}        >
          <div style={{ fontWeight: 700, color: '#1976d2', marginBottom: 6 }}>Part Info</div>
          {tooltip.info._previewImage && (
            <div style={{ marginBottom: 8, textAlign: 'center' }}>
              <img
                src={tooltip.info._previewImage}
                alt={tooltip.info.part || tooltip.info.sku || 'part image'}
                style={{
                  maxWidth: 180,
                  maxHeight: 140,
                  objectFit: 'contain',
                  border: '1px solid #eee',
                  borderRadius: 6,
                  background: '#fafafa',
                  padding: 4
                }}
                onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <div><b>SKU:</b> {tooltip.info.sku || 'N/A'}</div>
          <div><b>Part Name:</b> {tooltip.info.part || tooltip.info.description || 'N/A'}</div>
          <div><b>On Hand:</b> {tooltip.info.onHand ?? tooltip.info.qty_on_hand ?? 'N/A'}</div>
          <div><b>U/M:</b> {tooltip.info.um || tooltip.info.unit || 'N/A'}</div>
          <div>
            <b>Precio actual:</b>{' '}
            {tooltip.info.precio
              ? Number(tooltip.info.precio).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
              : (tooltip.info.cost ? Number(tooltip.info.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00')}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>(Click para cerrar)</div>
        </div>
      )}
      
      <div
        style={{
          padding: '32px',
          background: 'linear-gradient(90deg, #e3f2fd 0%, #ffffff 100%)',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(25, 118, 210, 0.10)',
          maxWidth: 1800,
          margin: '32px auto'
        }}
      ><div className="wo-header">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
  <div
    style={{
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: '#1976d2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    }}
  >
    <span style={{ color: 'white', fontWeight: 'bold', fontSize: 28, fontFamily: 'Courier New, Courier, monospace', letterSpacing: 2 }}>
      WO
    </span>
  </div>
  <span
    style={{
      fontSize: 32,
      fontWeight: 700,
      color: '#1976d2',
      fontFamily: 'Courier New, Courier, monospace',
      letterSpacing: 2,
      textShadow: '1px 1px 0 #fff',
    }}  >    Work Orders
    {searchIdClassic && (
      <span style={{
        marginLeft: '16px',
        fontSize: '16px',
        fontWeight: '600',
        color: '#ff9800',
        backgroundColor: '#fff3e0',
        padding: '4px 12px',
        borderRadius: '12px',
        border: '1px solid #ff9800'
      }}>
        🔍 Searching: "{searchIdClassic}"
      </span>
    )}
  </span>
  
  {/* Contador de W.O. pequeño debajo del título */}
  <div style={{ 
    marginTop: '8px', 
    fontSize: '14px', 
    color: '#666',
    fontWeight: '500'
  }}>
    📋 Total: {filteredOrders.length} Work Orders
  </div>
  {/* Indicador de estado del servidor */}
  <div style={{ 
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '20px',
    background: serverStatus === 'online' ? '#e8f5e8' : 
                serverStatus === 'waking' ? '#fff3e0' : '#ffebee',
    border: `1px solid ${serverStatus === 'online' ? '#4caf50' : 
                         serverStatus === 'waking' ? '#ff9800' : '#f44336'}`
  }}>
    <div style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: serverStatus === 'online' ? '#4caf50' : 
                  serverStatus === 'waking' ? '#ff9800' : '#f44336',
      marginRight: 8,
      animation: serverStatus === 'waking' ? 'pulse 1.5s infinite' : 'none'
    }} />
    <span style={{
      fontSize: 12,
      fontWeight: 600,
      color: serverStatus === 'online' ? '#2e7d32' : 
             serverStatus === 'waking' ? '#ef6c00' : '#c62828'
    }}>    {serverStatus === 'online' ? 'Online' : 
     serverStatus === 'waking' ? 'Waking up...' : 'Offline'}
    </span>    {serverStatus === 'offline' && (      <button 
        className="reconnect-btn"
        onClick={async () => {
          setRetryCount(0);
          setServerStatus('waking');
          setReconnecting(true);
          
          // Intentar despertar con keep-alive primero
          try {
            await keepAliveService.manualPing();
          } catch (e) {
            console.log('Manual ping failed, proceeding with fetch...');
          }
          
          // Esperar un poco y luego intentar fetch
          setTimeout(() => {
            fetchWorkOrders();
            setReconnecting(false);
          }, 3000);
        }}
        disabled={reconnecting}
      >
        {reconnecting ? 'Reconnecting...' : 'Reconnect'}
      </button>
    )}
    {fetchingData && (
      <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
        Loading...
      </span>
    )}
  </div>
</div>
        </div>
        {/* FILTROS DERECHA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 16, marginTop: -16 }}>
          <label className="wo-filter-label" style={{ marginBottom: 6 }}>
            Filter by week:&nbsp;
            <input
              type="week"
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              className="wo-filter-input"
            />
          </label>
          <label className="wo-filter-label" style={{ marginBottom: 6 }}>
            Filter by day:&nbsp;
            <input
              type="date"
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              className="wo-filter-input"
            />
          </label>
          <label className="wo-filter-label">
            Filter by status:&nbsp;
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="wo-filter-input"
              style={{ minWidth: 160 }}
            >
              <option value="">All</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="FINISHED">FINISHED</option>
              <option value="MISSING_PARTS">MISSING PARTS</option>
            </select>
          </label>

          {/* Filtro local por ID Classic (sin consulta al servidor) */}
          <label className="wo-filter-label">
            <span style={{ fontWeight: 'bold', color: '#1976d2' }}>🔍 Search ID Classic:</span>&nbsp;
            <input
              type="text"
              value={searchIdClassic}
              onChange={e => setSearchIdClassic(e.target.value)}
              className="wo-filter-input"
              style={{ 
                border: searchIdClassic ? '2px solid #1976d2' : '1px solid #ddd'
              }}
              placeholder="W.O. 19417"
            />
            {searchIdClassic && (
              <button
                onClick={() => setSearchIdClassic('')}
                style={{ 
                  marginLeft: '5px', 
                  padding: '2px 6px', 
                  fontSize: '12px', 
                  backgroundColor: '#f44336', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
                title="Clear search and show all work orders"
              >
                ✕
              </button>
            )}
          </label>
        </div>
        
        {/* Indicador de Estado del Servidor */}
        <div style={{ 
          margin: '12px 0', 
          padding: '12px 16px', 
          backgroundColor: serverStatus === 'online' ? '#e8f5e8' : 
                           serverStatus === 'waking' ? '#fff3cd' : '#f8d7da',
          borderRadius: '8px',
          border: `1px solid ${serverStatus === 'online' ? '#28a745' : 
                                serverStatus === 'waking' ? '#ffc107' : '#dc3545'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: '600',
              color: serverStatus === 'online' ? '#155724' : 
                     serverStatus === 'waking' ? '#856404' : '#721c24'
            }}>
              {serverStatus === 'online' && '🟢 Server Online'}
              {serverStatus === 'waking' && '🟡 Server Waking Up...'}
              {serverStatus === 'offline' && '🔴 Server Offline'}
            </span>
            {fetchingData && (
              <span style={{ fontSize: '12px', color: '#6c757d' }}>
                🔄 Loading data...
              </span>
            )}
          </div>
          
          {/* Botón para despertar servidor manualmente */}
          {(serverStatus === 'offline' || serverStatus === 'waking') && (
            <button
              onClick={async () => {
                console.log('🚀 Intentando despertar servidor manualmente...');
                setServerStatus('waking');
                setRetryCount(0); // Reset counter
                try {
                  const success = await keepAliveService.manualPing();
                  if (success) {
                    console.log('✅ Servidor despertado, recargando datos...');
                    await fetchWorkOrders();
                  } else {
                    console.log('⚠️ No se pudo despertar el servidor, reintentando...');
                    setTimeout(() => fetchWorkOrders(), 5000);
                  }
                } catch (error) {
                  console.error('❌ Error despertando servidor:', error);
                  setTimeout(() => fetchWorkOrders(), 10000);
                }
              }}
              disabled={fetchingData}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: fetchingData ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {fetchingData ? '🔄 Trying...' : '🚀 Wake Server'}
            </button>
          )}
        </div>
        
        {/* Controles de Paginación */}
        {!searchIdClassic && totalPages > 1 && (
          <div style={{ 
            margin: '16px 0', 
            padding: '12px 16px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#495057' }}>
                📄 Página {currentPageData} de {totalPages}
              </span>
              <span style={{ fontSize: '12px', color: '#6c757d' }}>
                Total: {totalRecords.toLocaleString()} W.O. | Mostrando 1000 por página
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Botón Primera Página */}
              <button
                onClick={() => {
                  setCurrentPageData(1);
                  fetchWorkOrders(false, 1);
                }}
                disabled={!hasPreviousPage || fetchingData}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: hasPreviousPage && !fetchingData ? '#1976d2' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: hasPreviousPage && !fetchingData ? 'pointer' : 'not-allowed'
                }}
              >
                « Primera
              </button>
              
              {/* Botón Anterior */}
              <button
                onClick={() => {
                  const prevPage = currentPageData - 1;
                  setCurrentPageData(prevPage);
                  fetchWorkOrders(false, prevPage);
                }}
                disabled={!hasPreviousPage || fetchingData}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: hasPreviousPage && !fetchingData ? '#1976d2' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: hasPreviousPage && !fetchingData ? 'pointer' : 'not-allowed'
                }}
              >
                ← Anterior
              </button>
              
              {/* Selector de página rápido */}
              <select
                value={currentPageData}
                onChange={(e) => {
                  const targetPage = parseInt(e.target.value);
                  setCurrentPageData(targetPage);
                  fetchWorkOrders(false, targetPage);
                }}
                disabled={fetchingData}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white'
                }}
              >
                {Array.from({ length: Math.min(totalPages, 20) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Página {i + 1}
                  </option>
                ))}
                {totalPages > 20 && currentPageData > 20 && (
                  <option value={currentPageData}>
                    Página {currentPageData}
                  </option>
                )}
              </select>
              
              {/* Botón Siguiente */}
              <button
                onClick={() => {
                  const nextPage = currentPageData + 1;
                  setCurrentPageData(nextPage);
                  fetchWorkOrders(false, nextPage);
                }}
                disabled={!hasNextPage || fetchingData}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: hasNextPage && !fetchingData ? '#1976d2' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: hasNextPage && !fetchingData ? 'pointer' : 'not-allowed'
                }}
              >
                Siguiente →
              </button>
              
              {/* Botón Última Página */}
              <button
                onClick={() => {
                  setCurrentPageData(totalPages);
                  fetchWorkOrders(false, totalPages);
                }}
                disabled={!hasNextPage || fetchingData}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: hasNextPage && !fetchingData ? '#1976d2' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: hasNextPage && !fetchingData ? 'pointer' : 'not-allowed'
                }}
              >
                Última »
              </button>
            </div>
          </div>
        )}{/* --- BOTONES ARRIBA --- */}
        <div style={{ margin: '24px 0 16px 0' }}>
          <button
            className="wo-btn"
            style={primaryBtn}            onClick={() => {
              // RESETEAR COMPLETAMENTE EL FORMULARIO ANTES DE ABRIR
              console.log('🔄 Abriendo formulario de nueva Work Order - Limpiando formulario completamente');
              resetNewWorkOrder(); 
              setExtraOptions([]);
              setPendingPartsQty({});
              // También resetear cualquier selección de partes pendientes
              setSelectedPendingParts([]);
              // Limpiar el error del ID Classic
              setIdClassicError('');
              
              // Pequeño delay para asegurar que el reset se complete antes de mostrar el formulario
              setTimeout(() => {
                setShowForm(true);
              }, 10);
            }}>
            New Work Order
          </button>
          {/* Botón Edit */}
          <button
            className="wo-btn"
            style={secondaryBtn}
            onClick={handleEdit}
            disabled={selectedRow === null}
          >
            Edit
          </button>
          {/* Botón Delete */}
          <button
            className="wo-btn"
            style={dangerBtn}
            onClick={() => selectedRow !== null && handleDelete(selectedRow)}
            disabled={selectedRow === null}
          >
            Delete
          </button>
          <button
            className="wo-btn"
            style={secondaryBtn}
            onClick={() => setShowHourmeter(true)}
          >
            Hourmeter
          </button>          <button
            className="wo-btn"
            style={secondaryBtn}
            disabled={selectedRow === null}
            onClick={() => {
              if (selectedRow !== null) {
                // Debug: Mostrar datos de la Work Order seleccionada
                const selectedWorkOrder = workOrders.find(wo => wo.id === selectedRow);
                console.log('🔍 Work Order seleccionada para PDF:', selectedWorkOrder);
                console.log('📊 Campos disponibles:', selectedWorkOrder ? Object.keys(selectedWorkOrder) : 'No encontrada');
                
                if (selectedWorkOrder) {
                  console.log('📋 Detalles de la WO:', {
                    id: selectedWorkOrder.id,
                    idClassic: selectedWorkOrder.idClassic,
                    billToCo: selectedWorkOrder.billToCo,
                    customer: selectedWorkOrder.customer,
                    trailer: selectedWorkOrder.trailer,
                    date: selectedWorkOrder.date,
                    mechanic: selectedWorkOrder.mechanic,
                    mechanics: selectedWorkOrder.mechanics,
                    totalHrs: selectedWorkOrder.totalHrs,
                    totalLabAndParts: selectedWorkOrder.totalLabAndParts,
                    parts: selectedWorkOrder.parts,
                    partsLength: selectedWorkOrder.parts ? selectedWorkOrder.parts.length : 0
                  });
                }
                
                handleViewPDF(selectedRow);
              }
            }}
          >
            View PDF
          </button>
        </div>

        {/* --- FORMULARIO NUEVA ORDEN --- */}
        {showForm && (          <div style={modalStyle} onClick={() => {
            // RESETEAR TODO CUANDO SE CIERRA EL MODAL
            resetNewWorkOrder();
            setExtraOptions([]);
            setPendingPartsQty({});
            setSelectedPendingParts([]);
            setIdClassicError('');
            setShowForm(false);
          }}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <WorkOrderForm
                workOrder={newWorkOrder}
                onChange={handleWorkOrderChange}
                onPartChange={handlePartChange}
                onSubmit={(data) => handleAddWorkOrder(data || newWorkOrder)}
                onCancel={() => {
                  resetNewWorkOrder();
                  setExtraOptions([]);
                  setPendingPartsQty({});
                  setSelectedPendingParts([]);
                  setIdClassicError('');
                  setShowForm(false);
                }}
                title="New Work Order"
                billToCoOptions={billToCoOptions}
                getTrailerOptions={billToCo => getTrailerOptionsWithPendingIndicator(billToCo, trailersWithPendingParts)}
                inventory={inventory}
                trailersWithPendingParts={trailersWithPendingParts}
                pendingParts={pendingParts}
                pendingPartsQty={pendingPartsQty}
                setPendingPartsQty={setPendingPartsQty}
                onAddPendingPart={(part, qty) => addPendingPart(part, qty || part.qty || 1)}
                onAddEmptyPart={addEmptyPart}
                onDeletePart={deletePart}
                loading={loading}
                setLoading={setLoading}
                idClassicError={idClassicError}
              />
            </div>
          </div>
        )}
        {/* --- FORMULARIO MODIFICAR ORDEN --- */}
        {showEditForm && (
          <div style={modalStyle} onClick={() => { setShowEditForm(false); setIdClassicError(''); }}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <div style={{
                marginBottom: 24,
                border: '1px solid orange',
                background: '#fffbe6',
                borderRadius: 8,
                padding: 24,
                maxWidth: 700,
                boxShadow: '0 2px 8px rgba(255,152,0,0.10)'
              }}>
                <h2 style={{ color: '#ff9800', marginBottom: 12 }}>Edit Work Order</h2>
                {!editWorkOrder ? (
                  <>
                    <label style={{ fontWeight: 600 }}>
                      ID:
                      <input
                        type="number"
                        placeholder="ID to edit"
                        value={editId}
                        onChange={e => setEditId(e.target.value)}
                        style={{ width: 100, marginLeft: 8, marginRight: 8, borderRadius: 4, border: '1px solid #ff9800', padding: 4 }}
                      />
                    </label>
                    <label style={{ fontWeight: 600, marginLeft: 16 }}>
                      Password:
                      <input
                        type="password"
                        placeholder="Password"
                        value={editPassword}
                        onChange={e => setEditPassword(e.target.value)}
                        style={{ width: 100, marginLeft: 8, marginRight: 8, borderRadius: 4, border: '1px solid #ff9800', padding: 4 }}
                      />
                    </label>
                    <button
                      className="wo-btn secondary"
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        if (editPassword !== '6214') {
                          setEditError('Incorrect password');
                          return;
                        }
                        const found = workOrders.find(wo => wo.id === Number(editId));
                        if (found) {
                          setEditWorkOrder({
                            ...found,
                            date: found.date ? found.date.slice(0, 10) : '',
                            parts: Array.isArray(found.parts) ? found.parts : []
                          });
                          setEditError('');
                        } else {
                          setEditError('No order found with that ID.');
                        }
                      }}
                    >
                      Load
                    </button>
                    <button
                      className="wo-btn secondary"
                      style={{ marginLeft: 8 }}
                      onClick={() => { setShowEditForm(false); setEditId(''); setEditWorkOrder(null); setEditError(''); setEditPassword(''); setIdClassicError(''); }}
                    >
                      Cancel
                    </button>
                    {editError && <div style={{ color: 'red', marginTop: 8 }}>{editError}</div>}
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#1976d2' }}>
                      Order ID: {editWorkOrder.id}
                    </div>
                    {showEditForm && (!editWorkOrder || !Array.isArray(editWorkOrder.parts)) && (
  <div style={{ color: 'red', padding: 32 }}>No data to edit.</div>
)}
                    <WorkOrderForm
                      workOrder={editWorkOrder}
                      onChange={handleWorkOrderChange}
                      onPartChange={handlePartChange}
                      onSubmit={handleEditWorkOrderSubmit}
                      onCancel={() => { setShowEditForm(false); setEditWorkOrder(null); setEditId(''); setEditError(''); setIdClassicError(''); }}
                      title="Edit Work Order"
                      billToCoOptions={billToCoOptions}
                      getTrailerOptions={billToCo => getTrailerOptionsWithPendingIndicator(billToCo, trailersWithPendingParts)}
                      inventory={inventory}
                      onAddEmptyPart={addEmptyPart}
                      onAddPendingPart={addPendingPart}
                      onDeletePart={deletePart}
                      trailersWithPendingParts={trailersWithPendingParts}
                      pendingParts={pendingParts}
                      pendingPartsQty={pendingPartsQty}
                      setPendingPartsQty={setPendingPartsQty}
                      loading={loading}
                      setLoading={setLoading}
                      idClassicError={idClassicError}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}        {/* --- TABLA ABAJO --- */}
          {/* Información de resultados */}
        {searchIdClassic && (
          <div style={{ 
            marginBottom: '16px', 
            padding: '8px 12px', 
            backgroundColor: '#e3f2fd',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            <span style={{ color: '#1976d2' }}>
              🔍 Search Results: {filteredOrders.length} work order{filteredOrders.length !== 1 ? 's' : ''} found
              {filteredOrders.length === 0 && (
                <span style={{ color: '#f44336', marginLeft: '8px' }}>
                  - No matches for "{searchIdClassic}"
                </span>
              )}
            </span>
          </div>
        )}
        
  {/* Compact/full columns toggle */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0', gap: 16 }}>
    {/* Left: Zoom slider */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>Zoom</span>
      <input
        type="range"
        min={50}
        max={150}
        step={5}
        value={Math.round(zoomScale * 100)}
        onChange={(e) => setZoomScale(Math.min(150, Math.max(50, Number(e.target.value))) / 100)}
        disabled={fitToWidth}
        style={{ width: 160 }}
        aria-label="Zoom Work Orders table"
      />
      <span style={{ fontSize: 12, width: 44, textAlign: 'right', color: fitToWidth ? '#888' : '#111' }}>
        {Math.round(zoomScale * 100)}%
      </span>
      <button
        onClick={() => setZoomScale(1)}
        disabled={fitToWidth || Math.abs(zoomScale - 1) < 0.001}
        style={{
          fontSize: 12,
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px solid #1976d2',
          background: '#fff',
          color: '#1976d2',
          cursor: fitToWidth || Math.abs(zoomScale - 1) < 0.001 ? 'not-allowed' : 'pointer'
        }}
      >Reset</button>
    </div>
    {/* Right: toggles */}
    <label style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="checkbox"
        checked={compactColumns}
        onChange={(e) => setCompactColumns(e.target.checked)}
      />
      Compact columns
    </label>
    <label style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="checkbox"
        checked={fitToWidth}
        onChange={(e) => setFitToWidth(e.target.checked)}
      />
      Fit to width
    </label>
  </div>

  <div ref={containerRef} style={{ overflowX: fitToWidth ? 'hidden' : 'auto', maxWidth: '100vw' }}>
          {compactColumns ? (
            <table ref={tableRef} className="wo-table compact" style={effectiveScale !== 1 ? { transform: `scale(${effectiveScale})`, transformOrigin: 'left top', width: `${100 / effectiveScale}%` } : undefined}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ID CLASSIC</th>
                  <th>Bill To Co</th>
                  <th>Trailer</th>
                  <th>Mechanic</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th style={{ minWidth: 60, maxWidth: 80, fontSize: 13 }}>EMP WRITTEN HRS</th>
                  <th>Parts</th>
                  <th>Total HRS</th>
                  <th>Total LAB & PRTS</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
              {filteredOrders
                .filter(order => {
                  if (!searchIdClassic) return true;
                  return (
                    (order.idClassic && order.idClassic.toString().toLowerCase().includes(searchIdClassic.toLowerCase()))
                  );
                })
                .slice()
                .sort((a, b) => {
                  const getTime = (d: string) => {
                    if (!d) return 0;
                    const parsed = dayjs(d, ["MM/DD/YYYY", "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", "YYYY/MM/DD"], true);
                    return parsed.isValid() ? parsed.valueOf() : 0;
                  };
                  return getTime(b.date) - getTime(a.date);
                })
                .map(order => {
                  const hasMoreParts = order.parts && order.parts.length > 5;
                  const dateStr = (order.date || '').slice(0, 10);
                  const [yyyy, mm, dd] = dateStr.split('-');
                  const displayDate = mm && dd && yyyy ? `${mm}/${dd}/${yyyy}` : '';
                  const partsSummary = Array.isArray(order.parts)
                    ? order.parts.slice(0, 5).map((p: any) => {
                        if (!p || !p.sku) return '';
                        const qtyNum = Number(p.qty || p.qty_used || 0);
                        const unitCostNum = Number(String(p.cost ?? '').replace(/[^0-9.]/g, '')) || 0;
                        const totalCost = qtyNum * unitCostNum;
                        const qty = qtyNum ? ` x${qtyNum}` : '';
                        const cost = totalCost
                          ? ` ${totalCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
                          : ' $0.00';
                        return `${p.sku}${qty}${cost}`;
                      }).filter(Boolean).join(' | ')
                    : '';
                  return (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.idClassic || ''}</td>
                      <td>{order.billToCo}</td>
                      <td>{order.trailer}</td>
                      <td>
                        {Array.isArray(order.mechanics) && order.mechanics.length > 0
                          ? order.mechanics.map((m: any) => m.name).join(', ')
                          : order.mechanic}
                      </td>
                      <td>{displayDate}</td>
                      <td style={{ minWidth: 200, maxWidth: 300, whiteSpace: 'pre-line' }}>{order.description}</td>
                      <td style={{ minWidth: 100, maxWidth: 160, fontSize: 13 }}>
                        {(() => {
                          const urls = extractUrls(order.employeeWrittenHours);
                          if (urls.length === 0) return <span style={{ color: '#888', fontSize: 12 }}>-</span>;
                          if (urls.length === 1) {
                            return (
                              <a href={urls[0]} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>
                                LINK
                              </a>
                            );
                          }
                          return (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              {urls.map((u, idx) => (
                                <a key={idx} href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>
                                  {`LINK ${idx + 1}`}
                                </a>
                              ))}
                              <button
                                type="button"
                                onClick={() => openAllLinks(urls)}
                                title="Open all links"
                                style={{ border: '1px solid #1976d2', color: '#1976d2', background: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11, cursor: 'pointer' }}
                              >
                                All
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ minWidth: 240, textAlign: 'left' }}>{partsSummary}</td>
                      <td>
                        <div style={{ lineHeight: 1.15 }}>
                          <div style={{ fontWeight: 700 }}>{order.totalHrs}</div>
                          {(() => {
                            const hrsNum = Number(order.totalHrs);
                            if (!isNaN(hrsNum) && hrsNum > 0) {
                              const laborVal = hrsNum * 60; // $60 por hora
                              return (
                                <div style={{ fontSize: 10, color: '#1976d2', fontWeight: 600 }}>
                                  {laborVal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                </div>
                              );
                            }
                            return <div style={{ fontSize: 10, color: '#888' }}>$0.00</div>;
                          })()}
                        </div>
                      </td>
                      <td>
                        {order.totalLabAndParts !== undefined && order.totalLabAndParts !== null && order.totalLabAndParts !== ''
                          ? Number(order.totalLabAndParts).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                          : '$0.00'}
                      </td>
                      <td>{order.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table ref={tableRef} className="wo-table" style={effectiveScale !== 1 ? { transform: `scale(${effectiveScale})`, transformOrigin: 'left top', width: `${100 / effectiveScale}%` } : undefined}>
            <thead>
              <tr>

                <th>ID</th>
                <th>ID CLASSIC</th>
                <th>Bill To Co</th>
                <th>Trailer</th>
                <th>Mechanic</th>
                <th>Date</th>
                <th>Description</th>
                <th style={{ minWidth: 60, maxWidth: 80, fontSize: 13 }}>EMP WRITTEN HRS</th>
                {[1,2,3,4,5].map(i => (
                  <React.Fragment key={i}>
                    <th>{`PRT${i}`}</th>
                    <th>{`Qty${i}`}</th>
                    <th>{`Costo${i}`}</th>
                  </React.Fragment>
                ))}
                <th>Total HRS</th>
                <th>Total LAB & PRTS</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>  {filteredOrders
              .filter(order => {
                if (!searchIdClassic) return true;
                return (
                  (order.idClassic && order.idClassic.toString().toLowerCase().includes(searchIdClassic.toLowerCase()))
                );
              })
              .slice() // copy array to avoid mutating original
              .sort((a, b) => {
                // Use dayjs for robust date parsing (handles both MM/DD/YYYY and YYYY-MM-DD)
                // Fallback: invalid/missing dates are treated as oldest
                const getTime = (d: string) => {
                  if (!d) return 0;
                  const parsed = dayjs(d, ["MM/DD/YYYY", "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", "YYYY/MM/DD"], true);
                  return parsed.isValid() ? parsed.valueOf() : 0;
                };
                return getTime(b.date) - getTime(a.date); // Descending: most recent first
              })
              .map((order, index) => {
    let rowClass = '';
    if (order.status === 'APPROVED') rowClass = 'wo-row-approved';
    else if (order.status === 'FINISHED') rowClass = 'wo-row-finished';
    else if (order.status === 'PROCESSING') rowClass = 'wo-row-processing';

    const hasMoreParts = order.parts && order.parts.length > 5;

    const dateStr = (order.date || '').slice(0, 10); // '2025-05-29'
const [yyyy, mm, dd] = dateStr.split('-');
const displayDate = mm && dd && yyyy ? `${mm}/${dd}/${yyyy}` : '';

    // Nuevo: usar status MISSING_PARTS para marcar y guardar en BD
    const isMissingParts = order.status === 'MISSING_PARTS';
    const handleMissingPartsClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const newStatus = isMissingParts ? 'PROCESSING' : 'MISSING_PARTS';
        await axios.put(`${API_URL}/workOrders/${order.id}`, { ...order, status: newStatus });
        order.status = newStatus;
        setSelectedRow(order.id);
        setContextMenu({ ...contextMenu, order: { ...order } });
      } catch (err) {
        alert('Error actualizando status de Missing Parts');
      }
    };
    return (
      <React.Fragment key={order.id}>
        <tr
          className={rowClass + (selectedRow === order.id ? ' wo-row-selected' : '')}
          style={{
            fontWeight: 600,
            cursor: 'pointer',
            background: isMissingParts ? '#ff9800' : undefined
          }}
          onClick={() => setSelectedRow(order.id)}
          onContextMenu={e => {
            e.preventDefault();
            setSelectedRow(order.id);
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, order });
          }}
        >
          <td>
            {hasMoreParts && (
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1976d2',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginRight: 4
                }}
                title={expandedRow === order.id ? 'Ocultar partes' : 'Ver todas las partes'}
                onClick={e => {
                  e.stopPropagation();
                  setExpandedRow(expandedRow === order.id ? null : order.id);
                }}
              >
                {expandedRow === order.id ? '▼' : '▶'}
              </button>
            )}
            {order.id}
          </td>
          <td>{order.idClassic || ''}</td>
          <td>{order.billToCo}</td>
          <td>{order.trailer}</td>
          <td>
            {Array.isArray(order.mechanics) && order.mechanics.length > 0
              ? order.mechanics.map((m: any) => m.name).join(', ')
              : order.mechanic}
          </td>
          <td>
            {displayDate}
          </td>
          <td style={{ minWidth: 200, maxWidth: 300, whiteSpace: 'pre-line' }}>{order.description}</td>
          <td style={{ minWidth: 60, maxWidth: 80, wordBreak: 'break-all', fontSize: 13 }}>
            {(() => {
              const urls = extractUrls(order.employeeWrittenHours);
              if (urls.length === 0) return <span style={{ color: '#888', fontSize: 12 }}>-</span>;
              if (urls.length === 1) {
                return (
                  <a href={urls[0]} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: 13 }}>
                    LINK
                  </a>
                );
              }
              return (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {urls.map((u, idx) => (
                    <a key={idx} href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: 13 }}>
                      {`LINK ${idx + 1}`}
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={() => openAllLinks(urls)}
                    title="Open all links"
                    style={{ border: '1px solid #1976d2', color: '#1976d2', background: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11, cursor: 'pointer' }}
                  >
                    All
                  </button>
                </div>
              );
            })()}
          </td>
          {[0,1,2,3,4].map(i => (
            <React.Fragment key={i}>
              <td
                style={{ cursor: order.parts && order.parts[i] && order.parts[i].sku ? 'pointer' : 'default', color: '#1976d2', position: 'relative' }}
                onMouseEnter={order.parts && order.parts[i] && order.parts[i].sku
                  ? (e) => handlePartHover(e, order.parts[i].sku)
                  : undefined
                }
                onMouseLeave={hideTooltip}
              >
                {order.parts && order.parts[i] && order.parts[i].sku ? order.parts[i].sku : ''}
              </td>
              <td>{order.parts && order.parts[i] && order.parts[i].sku ? order.parts[i].qty : ''}</td>
              <td>
                {order.parts && order.parts[i] && order.parts[i].sku
                  ? (() => {
                      const part = order.parts[i];
                      const qtyNum = Number(part.qty || part.qty_used || 0);
                      const unitCostNum = Number(String(part.cost ?? '').replace(/[^0-9.]/g, '')) || 0;
                      const total = qtyNum * unitCostNum;
                      return total
                        ? total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                        : '$0.00';
                    })()
                  : ''}
              </td>
            </React.Fragment>
          ))}
          <td>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontWeight: 700 }}>{order.totalHrs}</div>
              {(() => {
                const hrsNum = Number(order.totalHrs);
                if (!isNaN(hrsNum) && hrsNum > 0) {
                  const laborVal = hrsNum * 60; // $60 por hora
                  return (
                    <div style={{ fontSize: 10, color: '#1976d2', fontWeight: 600 }}>
                      {laborVal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </div>
                  );
                }
                return <div style={{ fontSize: 10, color: '#888' }}>$0.00</div>;
              })()}
            </div>
          </td>
          <td>
            {order.totalLabAndParts !== undefined && order.totalLabAndParts !== null && order.totalLabAndParts !== ''
              ? Number(order.totalLabAndParts).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
              : '$0.00'}
          </td>
          <td>{order.status}</td>
        </tr>
        {expandedRow === order.id && hasMoreParts && (
          <tr>
            <td colSpan={16} style={{ background: '#e3f2fd', padding: 12 }}>
              <strong>Partes adicionales:</strong>
              <table style={{ width: '100%', marginTop: 8, background: '#fff' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>SKU</th>
                    <th>Cantidad</th>
                    <th>Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {order.parts.slice(5).map((p: any, idx: number) => {
                    const qtyNum = Number(p.qty || p.qty_used || 0);
                    const unitCostNum = Number(String(p.cost ?? '').replace(/[^0-9.]/g, '')) || 0;
                    const total = qtyNum * unitCostNum;
                    return (
                      <tr key={idx}>
                        <td>{idx + 6}</td>
                        <td>{p.sku}</td>
                        <td>{qtyNum}</td>
                        <td>{total ? total.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  })}
</tbody>
            </table>
          )}
        </div>       
      </div>
      {/* Context Menu for Editar/Eliminar */}
      {contextMenu.visible && contextMenu.order && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '2px solid #1976d2',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(25,118,210,0.18)',
            zIndex: 9999,
            minWidth: 180,
            padding: '0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            overflow: 'hidden'
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            style={{ background: '#1976d2', color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', border: 'none', borderBottom: '2px solid #eee', width: '100%', cursor: 'pointer' }}
            onClick={async () => {
              // Forzar SIEMPRE el prompt de password ANTES de editar
              const pwd = window.prompt('Ingrese la contraseña para editar:');
              if (pwd === '6214') {
                // Buscar la W.O. más reciente del backend (por si hay cambios)
                try {
                  const res = await fetch(`${API_URL}/workOrders/${contextMenu.order.id}`);
                  if (res.ok) {
                    const data = await res.json();
                    setEditWorkOrder({ ...data, date: data.date ? data.date.slice(0, 10) : '', parts: Array.isArray(data.parts) ? data.parts : [] });
                  } else {
                    setEditWorkOrder({ ...contextMenu.order, date: contextMenu.order.date ? contextMenu.order.date.slice(0, 10) : '', parts: Array.isArray(contextMenu.order.parts) ? contextMenu.order.parts : [] });
                  }
                } catch {
                  setEditWorkOrder({ ...contextMenu.order, date: contextMenu.order.date ? contextMenu.order.date.slice(0, 10) : '', parts: Array.isArray(contextMenu.order.parts) ? contextMenu.order.parts : [] });
                }
                setShowEditForm(true);
                setEditId(contextMenu.order.id);
                setContextMenu({ ...contextMenu, visible: false });
              } else if (pwd !== null) {
                alert('Contraseña incorrecta');
              }
            }}
          >Editar</button>
          <button
            style={{ background: '#d32f2f', color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', border: 'none', borderBottom: '2px solid #eee', width: '100%', cursor: 'pointer' }}
            onClick={() => {
              handleDelete(contextMenu.order.id);
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >Eliminar</button>
          <button
            style={{ background: '#fff', color: '#1976d2', fontWeight: 700, fontSize: 16, padding: '16px 0', border: 'none', borderBottom: '2px solid #eee', width: '100%', cursor: 'pointer' }}
            onClick={() => {
              setContextMenu({ ...contextMenu, visible: false });
              handleViewPDF(contextMenu.order.id);
            }}
          >Ver PDF</button>
          <button
            style={{ background: '#ff9800', color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', border: 'none', width: '100%', cursor: 'pointer' }}
            onClick={async () => {
              setContextMenu({ ...contextMenu, visible: false });
              const pwd = window.prompt('Enter password to approve:');
              if (pwd === 'Soledad14') {
                // Cambiar status a APPROVED
                try {
                  await axios.put(`${API_URL}/work-orders/${contextMenu.order.id}`, {
                    ...contextMenu.order,
                    status: 'APPROVED',
                    usuario: localStorage.getItem('username') || ''
                  });
                  // Opcional: recargar órdenes
                  if (typeof fetchWorkOrders === 'function') fetchWorkOrders();
                  alert('Work Order approved!');
                } catch (err) {
                  alert('Error approving Work Order');
                }
              } else if (pwd !== null) {
                alert('Incorrect password');
              }
            }}
          >TO APPROVE</button>
        </div>
      )}
      {/* Hide context menu on click elsewhere */}
      {contextMenu.visible && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setContextMenu({ ...contextMenu, visible: false })}
        />
      )}
  {/* Removed duplicate tooltip rendering block (cleanup) */}
      <HourmeterModal
  show={showHourmeter}
  onClose={() => setShowHourmeter(false)}
  workOrders={workOrders}
mechanics={Array.from(new Set(workOrders.map(o => o.mechanic).filter(Boolean)))}  selectedWeek={selectedWeek}
/>
      {loading && (
  <div style={{
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(255,255,255,0.7)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    <div className="loader" />
    <div style={{ color: '#1976d2', fontWeight: 700, fontSize: 20, marginLeft: 16 }}>
      Procesando, por favor espera...
    </div>
  </div>
)}
    </>
  );
};

export default WorkOrdersTable;