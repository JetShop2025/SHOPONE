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
dayjs.extend(isBetween);
dayjs.extend(weekOfYear);

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

// TypeScript interfaces for API responsesS
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

const isMissingPartsStatus = (status: unknown): boolean => {
  const normalized = String(status || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return normalized === 'MISSING_PARTS';
};

const normalizeOrderDate = (value: any): string => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [mm, dd, yyyy] = raw.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
};

const getOrderStartDate = (order: any): string => {
  return normalizeOrderDate(order?.startDate) || normalizeOrderDate(order?.date);
};

const getOrderEndDate = (order: any): string => {
  return normalizeOrderDate(order?.endDate);
};

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
      // Asegurar que fechas, description, status, totalLabAndParts no sean nulos
      const normalizedStartDate = normalizeOrderDate(safeData.startDate) || normalizeOrderDate(safeData.date);
      const normalizedEndDate = normalizeOrderDate(safeData.endDate);
      safeData.startDate = normalizedStartDate || '';
      safeData.date = normalizedStartDate || '';
      safeData.endDate = normalizedEndDate || '';
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
      // NOTE: Deducción CENTRALIZADA en backend ahora (no en frontend)
      // Backend maneja FIFO y Destinadas automáticamente
      
      // Update the work order
      // 1. Fecha: enviar SIEMPRE en formato YYYY-MM-DD
      let dateToSend = normalizeOrderDate(data.startDate) || normalizeOrderDate(data.date);
      if (dateToSend && dateToSend.length >= 10) {
        if (dateToSend.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [month, day, year] = dateToSend.split('/');
          dateToSend = `${year}-${month}-${day}`;
        } else if (dateToSend.match(/^\d{4}-\d{2}-\d{2}/)) {
          dateToSend = dateToSend.slice(0, 10);
        }
      }
      const endDateToSend = normalizeOrderDate(data.endDate);
      // 2. Total: enviar SIEMPRE como número (sin $)
      let totalToSend = data.totalLabAndParts;
      if (typeof totalToSend === 'string') {
        totalToSend = Number(String(totalToSend).replace(/[^0-9.]/g, ''));
      }
      if (!totalToSend || isNaN(totalToSend)) {
        totalToSend = 0;
      }
      // 3. Miscellaneous y Welding: asegurar valores por defecto
      let miscToSend = data.miscellaneous;
      if (miscToSend === undefined || miscToSend === null || miscToSend === '' || isNaN(Number(miscToSend))) {
        miscToSend = '0';
      }
      let weldToSend = data.weldPercent;
      if (weldToSend === undefined || weldToSend === null || weldToSend === '' || isNaN(Number(weldToSend))) {
        weldToSend = '0';
      }
      // 4. Guardar el valor EXACTO que el usuario editó/calculó, sin recalcular ni modificar
      const dataToSend = { 
        ...safeData, 
        date: dateToSend, 
        startDate: dateToSend,
        endDate: endDateToSend || '',
        totalLabAndParts: totalToSend,
        miscellaneous: miscToSend,
        weldPercent: weldToSend
      };
      
      // CRITICAL: Remove pdf_file to avoid sending 3.4MB in PUT request
      delete (dataToSend as any).pdf_file;
      
      // OPTIMIZATION: Run critical updates in parallel and defer PDF generation
      await axios.put(`${API_URL}/work-orders/${editWorkOrder.id}`, dataToSend);
      
      // Mark pending parts as used in parallel
      const partesConPendingId = currentParts.filter((p: any) => p._pendingPartId);
      if (partesConPendingId.length > 0) {
        await Promise.all(
          partesConPendingId.map((part: any) =>
            axios.put(`${API_URL}/receive/${part._pendingPartId}/mark-used`, {
              usuario: localStorage.getItem('username') || ''
            }).catch(error => console.warn('Error marking part as used:', error))
          )
        );
      }
      
      // Update state immediately (fast)
      setWorkOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === editWorkOrder.id
            ? { ...order, ...editWorkOrder, ...data,
                totalLabAndParts: !isNaN(Number(dataToSend.totalLabAndParts)) ? Number(dataToSend.totalLabAndParts) : 0,
                date: dataToSend.date || editWorkOrder.date || '',
                startDate: dataToSend.startDate || editWorkOrder.startDate || editWorkOrder.date || '',
                endDate: dataToSend.endDate || editWorkOrder.endDate || ''
              }
            : order
        )
      );
      
      // Close form immediately - don't wait for PDF or refresh
      setShowEditForm(false);
      setEditWorkOrder(null);
      setEditId('');
      setEditError('');
      
      // Show success alert
      let totalValue = dataToSend.totalLabAndParts;
      if (!totalValue || isNaN(Number(String(totalValue).replace(/[^0-9.]/g, '')))) {
        totalValue = '$0.00';
      }
      alert(`Work Order updated successfully!`);
      
      // DEFERRED OPERATIONS (non-blocking, run in background)
      // Refresh data asynchronously without blocking the UI
      Promise.all([
        fetchWorkOrders().catch(e => console.warn('Error fetching orders:', e)),
        fetchTrailersWithPendingParts().catch(e => console.warn('Error fetching pending parts:', e)),
        axios.get(`${API_URL}/inventory`)
          .then(invRes => {
            const updatedInventory = Array.isArray(invRes.data) ? invRes.data : [];
            setInventory(updatedInventory);
            console.log('✅ Inventario refrescado después de editar W.O');
          })
          .catch(invError => console.warn('⚠️ No se pudo refrescar inventario:', invError))
      ]).catch(e => console.warn('Error in deferred operations:', e));
      
      // DEFERRED: Generate PDF in background (don't wait for it)
      (async () => {
        try {
          const workOrderRes = await axios.get(`${API_URL}/work-orders/${editWorkOrder.id}`);
          const workOrderData = workOrderRes.data as any;
          const partsRes = await axios.get(`${API_URL}/work-order-parts/${editWorkOrder.id}`);
          const partsWithInvoices = (partsRes.data as any[]).map((part: any) => {
            // Si la parte ya tiene invoiceLink (de work_order_parts), usarlo
            if (part.invoiceLink) return { ...part, part: part.part || part.part_name || part.description || '' };
            
            // Si no, buscar en el inventario
            const inventoryItem = inventory.find((item: any) => item.sku === part.sku);
            return {
              ...part,
              part: part.part || part.part_name || part.description || '',
              invoiceLink: inventoryItem?.invoiceLink || inventoryItem?.invoice_link || null
            };
          });
          
          const pdfData = {
            id: workOrderData.id,
            idClassic: workOrderData.idClassic || workOrderData.id.toString(),
            customer: workOrderData.billToCo || workOrderData.customer || '',
            trailer: workOrderData.trailer || '',
            date: workOrderData.startDate || workOrderData.date || workOrderData.fecha || '',
            mechanics: Array.isArray(workOrderData.mechanics)
              ? workOrderData.mechanics.map((m: any) => `${m.name} (${m.hrs}h)`).join(', ')
              : workOrderData.mechanics || workOrderData.mechanic || '',
            description: workOrderData.description || '',
            status: workOrderData.status || editWorkOrder.status || 'PROCESSING',
            parts: partsWithInvoices.map((part: any) => ({
              sku: part.sku,
              description: part.part || part.part_name || part.sku,
              um: 'EA',
              qty: part.qty_used,
              unitCost: part.cost || 0,
              total: (part.qty_used && part.cost && !isNaN(Number(part.qty_used)) && !isNaN(Number(part.cost)))
                ? Number(part.qty_used) * Number(part.cost)
                : 0,
              invoiceLink: part.invoiceLink || null
            })),
            totalHrs: Number(workOrderData.totalHrs) || 0,
            laborRate: 60,
            laborCost: Number(workOrderData.laborCost) || 0,
            subtotalParts: Number(workOrderData.subtotalParts) || 0,
            totalLabAndParts: !isNaN(Number(dataToSend.totalLabAndParts)) ? Number(dataToSend.totalLabAndParts) : 0,
            totalCost: !isNaN(Number(dataToSend.totalLabAndParts)) ? Number(dataToSend.totalLabAndParts) : 0,
            extraOptions: editWorkOrder.extraOptions || extraOptions || [],
            miscellaneousPercent: (typeof workOrderData.miscellaneous !== 'undefined' && workOrderData.miscellaneous !== null && workOrderData.miscellaneous !== '')
              ? Number(workOrderData.miscellaneous)
              : (typeof dataToSend.miscellaneous !== 'undefined' && dataToSend.miscellaneous !== null && dataToSend.miscellaneous !== '')
                ? Number(dataToSend.miscellaneous)
                : 0,
            weldPercent: (typeof workOrderData.weldPercent !== 'undefined' && workOrderData.weldPercent !== null && workOrderData.weldPercent !== '')
              ? Number(workOrderData.weldPercent)
              : (typeof dataToSend.weldPercent !== 'undefined' && dataToSend.weldPercent !== null && dataToSend.weldPercent !== '')
                ? Number(dataToSend.weldPercent)
                : 0
          };
          
          const pdf = await generateWorkOrderPDF(pdfData);
          await savePDFToDatabase(editWorkOrder.id, pdf.output('blob')).catch(e => console.warn('Error saving PDF:', e));
          console.log('✅ PDF generado y guardado en background');
        } catch (pdfError) {
          console.warn('⚠️ Error generando PDF en background:', pdfError);
        }
      })();
      
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      alert(`Error updating Work Order: ${err.message}`);
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
  const maxRetries = 3;
  const [idClassicError, setIdClassicError] = useState('');  // Nueva funcionalidad: búsqueda inteligente por ID Classic
  const [searchIdClassic, setSearchIdClassic] = useState('');
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
  const [draggingOrderId, setDraggingOrderId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<'PROCESSING' | 'APPROVED' | 'MISSING_PARTS' | null>(null);
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
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
      const targetPage = pageToLoad || currentPageData;      // Si hay búsqueda específica por ID Classic, usar búsqueda directa (OPTIMIZADA)
      if (searchIdClassic.trim()) {
        // Only log if debugging
        const res = await axios.get(`${API_URL}/work-orders`, {
          params: { searchIdClassic: searchIdClassic.trim() },
          timeout: 30000 // AUMENTADO timeout para servidor gratuito
        });
        
        const searchResults = Array.isArray(res.data) ? res.data : [];
        setWorkOrders(searchResults);
        // Para búsquedas, no mostrar paginación
        setTotalPages(1);
        setTotalRecords(searchResults.length);
        setHasNextPage(false);
        setHasPreviousPage(false);
        setServerStatus('online');
        setRetryCount(0);
        return;
      }      // Carga paginada normal (OPTIMIZADA para plan gratuito - 100 registros)
      // Only log if debugging
      const res = await axios.get<WorkOrdersApiResponse | any[]>(`${API_URL}/work-orders`, {
        params: {
          page: targetPage,
          pageSize: pageSize,
          includeArchived: false // Por defecto no incluir archivadas para mejor rendimiento
        },
        timeout: 30000 // AUMENTADO timeout para servidor gratuito
      });
      
      // Manejar respuesta paginada
      if (res.data && typeof res.data === 'object' && 'pagination' in res.data) {
        const paginatedResponse = res.data as PaginatedWorkOrdersResponse;
        const { data, pagination } = paginatedResponse;
        // Only log if debugging
        
        setWorkOrders(data || []);
        setCurrentPageData(pagination.currentPage);
        setTotalPages(pagination.totalPages);
        setTotalRecords(pagination.totalRecords);
        setHasNextPage(pagination.hasNextPage);
        setHasPreviousPage(pagination.hasPreviousPage);
      } else {
        // Fallback si la respuesta no tiene paginación (modo tradicional)
        const fetchedOrders = Array.isArray(res.data) ? res.data : [];
        setWorkOrders(fetchedOrders);
        setTotalPages(1);
        setTotalRecords(fetchedOrders.length);
        setHasNextPage(false);
        setHasPreviousPage(false);
        // Only log if debugging
      }
      
      setServerStatus('online');
      setRetryCount(0);
      // Only log if debugging
    } catch (err: any) {
      console.error('Error cargando órdenes:', err);
        // Si es un error 502/503 (servidor dormido) y no hemos excedido reintentos
      if ((err?.response?.status === 502 || err?.response?.status === 503 || err.code === 'ECONNABORTED') && retryCount < maxRetries) {
        if (!isRetry) {
          setServerStatus('waking');
          // Only log if debugging
          try {
            const pingSuccess = await keepAliveService.manualPing();
          } catch (keepAliveError) {}
            setRetryCount(prev => prev + 1);
          const retryDelay = Math.min(30000 * Math.pow(2, retryCount), 120000);
          setTimeout(() => {
            fetchWorkOrders(true, pageToLoad || currentPageData);
          }, retryDelay);
        }
      } else {
        setServerStatus('offline');
        if (retryCount >= maxRetries) {
          // Only log if debugging
        }
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
  
  // Función de búsqueda inteligente por ID Classic
  const searchWorkOrderByIdClassic = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      // Si está vacío, recargar todas las órdenes
      fetchWorkOrders();
      setIsSearching(false);
      return;
    }
    
    try {
      setIsSearching(true);
      // Only log if debugging
      
      const res = await axios.get(`${API_URL}/work-orders`, {
        params: { searchIdClassic: searchTerm.trim() },
        timeout: 15000
      });
      
      const searchResults = Array.isArray(res.data) ? res.data : [];
      setWorkOrders(searchResults);
      // Only log if debugging
      
      if (searchResults.length === 0) {
        // Only log if debugging
      }
      
    } catch (error) {
      console.error('❌ Error en búsqueda:', error);
      // En caso de error, volver a cargar todas las órdenes
      fetchWorkOrders();
    } finally {
      setIsSearching(false);
    }
  }, [fetchWorkOrders]);
  
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
    const orderStartDate = getOrderStartDate(order);
    if (!orderStartDate) return false;

    // Excluir W.O. con status FINISHED (van al apartado FINAL WORK ORDERS)
    if (order.status === 'FINISHED') return false;

    // Filter by ID Classic (search) only
    const matchesSearch = !searchIdClassic || 
      (order.idClassic && String(order.idClassic).toLowerCase().includes(searchIdClassic.toLowerCase())) ||
      (String(order.id).toLowerCase().includes(searchIdClassic.toLowerCase()));

    return matchesSearch;
  });

  const getStatusForBoard = (status: unknown): 'PROCESSING' | 'APPROVED' | 'MISSING_PARTS' => {
    if (isMissingPartsStatus(status)) return 'MISSING_PARTS';
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'APPROVED') return 'APPROVED';
    return 'PROCESSING';
  };

  const formatStatusLabel = (status: unknown) => {
    if (isMissingPartsStatus(status)) return 'MISSING PARTS';
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'APPROVED') return 'APPROVED';
    return 'PROCESSING';
  };

  const sortedBoardOrders = filteredOrders
    .slice()
    .sort((a, b) => {
      const getTime = (value: string) => {
        if (!value) return 0;
        const parsed = dayjs(value, ["MM/DD/YYYY", "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", "YYYY/MM/DD"], true);
        return parsed.isValid() ? parsed.valueOf() : 0;
      };
      return getTime(getOrderStartDate(b)) - getTime(getOrderStartDate(a));
    });

  const boardColumns = [
    { key: 'PROCESSING' as const, title: 'PROCESSING', color: '#1976d2' },
    { key: 'APPROVED' as const, title: 'APPROVED', color: '#43a047' },
    { key: 'MISSING_PARTS' as const, title: 'MISSING PARTS', color: '#f44336' }
  ];

  const updateWorkOrderStatus = async (order: any, targetStatus: 'PROCESSING' | 'APPROVED' | 'MISSING_PARTS') => {
    const currentStatus = getStatusForBoard(order?.status);
    if (currentStatus === targetStatus) return;

    // 🚀 OPTIMISTIC UPDATE: Actualizar estado localmente INMEDIATAMENTE (sin esperar API)
    setWorkOrders(prev =>
      prev.map(item =>
        item.id === order.id ? { ...item, status: targetStatus } : item
      )
    );

    setDetailOrder((prev: any) =>
      prev && prev.id === order.id ? { ...prev, status: targetStatus } : prev
    );

    setContextMenu(prev =>
      prev.order && prev.order.id === order.id
        ? { ...prev, order: { ...prev.order, status: targetStatus } }
        : prev
    );

    // 📡 DEFERRED: Hacer el PUT en background sin bloquear la UI
    (async () => {
      try {
        await axios.put(`${API_URL}/work-orders/${order.id}`, {
          ...order,
          status: targetStatus,
          usuario: localStorage.getItem('username') || ''
        });
        console.log(`✅ Status actualizado a ${targetStatus} (sincronizado con backend)`);
      } catch (error) {
        // Si falla, revertir al estado anterior
        console.error('❌ Error actualizando status:', error);
        setWorkOrders(prev =>
          prev.map(item =>
            item.id === order.id ? { ...item, status: currentStatus } : item
          )
        );
        setDetailOrder((prev: any) =>
          prev && prev.id === order.id ? { ...prev, status: currentStatus } : prev
        );
        alert('⚠️ Error actualizando Work Order. Se revirtió al estado anterior.');
      }
    })();
  };

  const handleCardDragStart = (orderId: number) => (event: React.DragEvent<HTMLDivElement>) => {
    setDraggingOrderId(orderId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(orderId));
  };

  const handleCardDragEnd = () => {
    setDraggingOrderId(null);
    setDragOverStatus(null);
  };

  const handleColumnDragOver = (status: 'PROCESSING' | 'APPROVED' | 'MISSING_PARTS') => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleColumnDrop = (status: 'PROCESSING' | 'APPROVED' | 'MISSING_PARTS') => async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const draggedIdRaw = event.dataTransfer.getData('text/plain');
    const draggedId = Number(draggedIdRaw || draggingOrderId);
    setDragOverStatus(null);

    if (!draggedId || Number.isNaN(draggedId)) {
      setDraggingOrderId(null);
      return;
    }

    const draggedOrder = workOrders.find(order => Number(order.id) === draggedId);
    if (!draggedOrder) {
      setDraggingOrderId(null);
      return;
    }

    // Request password before changing status
    const pwd = window.prompt('Enter password to change Work Order status:');
    if (pwd !== '6214') {
      if (pwd !== null) {
        alert('Incorrect password. Status change cancelled.');
      }
      setDraggingOrderId(null);
      return;
    }

    try {
      await updateWorkOrderStatus(draggedOrder, status);
    } catch (error) {
      alert('Error updating Work Order status');
    }

    setDraggingOrderId(null);
  };

  // Cambios generales
  const handleWorkOrderChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any
  ) => {
    // Si es un evento (input, select, textarea)
    if (e && e.target) {
      const { name, value, type } = e.target;
      // Manejo especial para campos de fecha
      if (type === 'date' && showForm) {
        if (name === 'startDate' || name === 'date') {
          setNewWorkOrder(prev => ({ ...prev, startDate: value, date: value }));
          return;
        }
        if (name === 'endDate') {
          setNewWorkOrder(prev => ({ ...prev, endDate: value }));
          return;
        }
      }
      if (type === 'date' && showEditForm && editWorkOrder) {
        if (name === 'startDate' || name === 'date') {
          setEditWorkOrder((prev: any) => ({ ...prev, startDate: value, date: value }));
          return;
        }
        if (name === 'endDate') {
          setEditWorkOrder((prev: any) => ({ ...prev, endDate: value }));
          return;
        }
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
          const duplicateStartDate = getOrderStartDate(duplicateWO);
          const msg = `Ya existe una Work Order para la traila "${trailerToCheck}" en estado PROCESSING o APPROVED (ID: ${duplicateWO.id}, Fecha: ${duplicateStartDate ? duplicateStartDate.slice(0,10) : ''}).\n¿Desea continuar y crear la orden de todos modos?`;
          const proceed = window.confirm(msg);
          if (!proceed) {
            setLoading(false);
            return;
          }
        }
      }

      // 1. Prepara partes para guardar en la orden
      // NOTE: Deducción CENTRALIZADA en backend ahora (no en frontend)
      let fifoResult: any = null;
      const partesParaGuardar = datosOrden.parts
        .filter((p: any) => p.sku && String(p.sku).trim() !== '') // Solo partes con SKU
        .map((p: any) => ({
          sku: p.sku,
          part: p.part,
          qty: Number(p.qty),
          cost: Number(String(p.cost).replace(/[^0-9.]/g, ''))
        }));

      const startDateToSend = normalizeOrderDate(datosOrden.startDate) || normalizeOrderDate(datosOrden.date);
      const endDateToSend = normalizeOrderDate(datosOrden.endDate);

      // LIMPIA EL TOTAL ANTES DE ENVIAR
      const totalLabAndPartsLimpio = Number(String(datosOrden.totalLabAndParts).replace(/[^0-9.]/g, ''));
      const res = await axios.post(`${API_URL}/work-orders`, {
        ...datosOrden,
        date: startDateToSend,
        startDate: startDateToSend,
        endDate: endDateToSend || '',
        totalLabAndParts: totalLabAndPartsLimpio, // <-- ENVÍA EL TOTAL LIMPIO
        parts: partesParaGuardar,
        extraOptions,
        usuario: localStorage.getItem('username') || ''
      });
      const data = res.data as { id: number, pdfUrl?: string };
      const newWorkOrderId = data.id;
      
      // 🚀 OPTIMIZACIÓN: Paralelizar operaciones críticas
      const partesConPendingId = datosOrden.parts.filter((p: any) => p._pendingPartId);
      
      // REGISTRA PARTES USADAS EN work_order_parts - PARALELO
      const workOrderPartsPromises = partesParaGuardar.map((part: any) => {
        let fifoInfoForPart = null;
        if (fifoResult && fifoResult.details) {
          fifoInfoForPart = fifoResult.details.find((f: any) => f.sku === part.sku);
        }
        
        return axios.post(`${API_URL}/work-order-parts`, {
          work_order_id: newWorkOrderId,
          sku: part.sku,
          part_name: part.part || inventory.find(i => i.sku === part.sku)?.part || '',
          qty_used: part.qty,
          cost: Number(String(part.cost).replace(/[^0-9.]/g, '')),
          fifo_info: fifoInfoForPart,
          usuario: localStorage.getItem('username') || ''
        }).catch(error => {
          console.error(`❌ Error guardando parte ${part.sku}:`, error);
          return null;
        });
      });
      
      // MARCAR PARTES PENDIENTES COMO USED - PARALELO
      const markUsedPromises = partesConPendingId.map((part: any) =>
        axios.put(`${API_URL}/receive/${part._pendingPartId}/mark-used`, {
          usuario: localStorage.getItem('username') || ''
        }).catch(error => {
          console.error(`❌ Error marcando parte pendiente ${part._pendingPartId}:`, error);
          return null;
        })
      );
      
      // Ejecutar TODAS las operaciones críticas en PARALELO
      await Promise.all([...workOrderPartsPromises, ...markUsedPromises]);
      
      // ✅ CERRAR FORMULARIO INMEDIATAMENTE (operaciones críticas completadas)
      setShowForm(false);
      resetNewWorkOrder();
      setExtraOptions([]);
      setPendingPartsQty({});
      setSelectedPendingParts([]);
      setIdClassicError('');
      setLoading(false);
      
      // Muestra mensaje de éxito INMEDIATAMENTE
      alert(`¡Orden de trabajo #${newWorkOrderId} creada exitosamente!`);
      
      // 🎯 OPTIMISTIC UPDATE: Agregar nueva WO al estado local SIN esperar fetch
      const newWO = {
        id: newWorkOrderId,
        ...datosOrden,
        date: startDateToSend,
        startDate: startDateToSend,
        endDate: endDateToSend || '',
        totalLabAndParts: totalLabAndPartsLimpio,
        parts: partesParaGuardar
      };
      setWorkOrders(prev => [newWO, ...prev]);
      
      // 🔄 OPERACIONES EN BACKGROUND (no bloquean UI)
      (async () => {
        // 🚀 LAZY LOADING DE PDFs: No generar PDF automáticamente
        // El PDF se generará SOLO cuando el usuario haga clic en "Ver PDF"
        // Esto reduce significativamente el tiempo de creación de W.O.
        console.log('✅ W.O. creada - PDF se generará bajo demanda (lazy loading)');
        
        // RECARGAS EN BACKGROUND (paralelas)
        await Promise.all([
          fetchWorkOrders().catch(e => console.warn('⚠️ Error recargando work orders:', e)),
          axios.get(`${API_URL}/inventory`)
            .then(invRes => {
              const updatedInventory = Array.isArray(invRes.data) ? invRes.data : [];
              setInventory(updatedInventory);
              console.log('✅ Inventario refrescado en background');
            })
            .catch(e => console.warn('⚠️ Error refrescando inventario:', e)),
          fetchTrailersWithPendingParts().catch(e => console.warn('⚠️ Error actualizando campanitas:', e))
        ]);
        
        console.log('✅ Todas las operaciones en background completadas');
      })();
      
    } catch (err: any) {
      console.error('Error al guardar la orden:', err);
      alert(`Error al guardar la orden: ${err.response?.data?.error || err.message || 'Error desconocido'}`);
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
      console.log(`🔍 Obteniendo partes pendientes para trailer: ${trailer}`);
      const res = await axios.get(`${API_URL}/receive/pending/${encodeURIComponent(trailer)}`);
      console.log(`✅ Partes pendientes obtenidas para ${trailer}:`, res.data);
      setPendingParts(res.data as any[]);
    } catch (error) {
      console.error(`❌ Error obteniendo partes pendientes para ${trailer}:`, error);
      setPendingParts([]);    }
  };

  const partesSeleccionadas = pendingParts.filter((p: any) => selectedPendingParts.includes(p.id));

  // NOTA: useEffect problemático removido - causaba que se borraran las partes agregadas manualmente
  // El sistema ahora usa botones "Add Part" individuales en lugar de selección múltiple

  useEffect(() => {
    // ✅ NO MODIFICAR NADA AL ABRIR EL EDITOR
    // Preservar TODOS los valores originales tal como se guardaron
    // Solo este useEffect sirve para detectar cambios, pero NO modifica valores
    
    // El formulario debe mostrar exactamente los valores que están en la base de datos
    // sin ningún tipo de recálculo automático
  }, [editWorkOrder?.mechanics, showEditForm]);

  const parseExtraOptions = (extraOptionsValue: any): string[] => {
    if (Array.isArray(extraOptionsValue)) return extraOptionsValue;
    if (typeof extraOptionsValue === 'string') {
      try {
        const parsed = JSON.parse(extraOptionsValue);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  };

  const normalizeWorkOrderForEdit = (workOrder: any) => {
    const normalizedExtraOptions = parseExtraOptions(workOrder?.extraOptions);

    let normalizedMisc = workOrder?.miscellaneous;
    let normalizedWeld = workOrder?.weldPercent;

    if (normalizedMisc === undefined || normalizedMisc === null || normalizedMisc === '') {
      if (normalizedExtraOptions.includes('15shop')) {
        normalizedMisc = '15';
      } else if (normalizedExtraOptions.includes('5')) {
        normalizedMisc = '5';
      }
    }

    if (normalizedWeld === undefined || normalizedWeld === null || normalizedWeld === '') {
      if (normalizedExtraOptions.includes('15weld')) {
        normalizedWeld = '15';
      }
    }

    const normalizedStartDate = getOrderStartDate(workOrder);
    const normalizedEndDate = getOrderEndDate(workOrder);

    return {
      ...workOrder,
      date: normalizedStartDate,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      parts: Array.isArray(workOrder?.parts) ? workOrder.parts : [],
      mechanics: Array.isArray(workOrder?.mechanics) ? workOrder.mechanics : [],
      extraOptions: normalizedExtraOptions,
      miscellaneous: (normalizedMisc !== undefined && normalizedMisc !== null) ? String(normalizedMisc) : '',
      weldPercent: (normalizedWeld !== undefined && normalizedWeld !== null) ? String(normalizedWeld) : ''
    };
  };

  const handleEdit = () => {
    if (selectedRow === null) return;
    const pwd = window.prompt('Enter password to edit:');
    if (pwd === '6214') {
      const found = workOrders.find(wo => wo.id === selectedRow);
      if (found) {
        const normalizedOrder = normalizeWorkOrderForEdit(found);
        setEditWorkOrder(normalizedOrder);
        setExtraOptions(normalizedOrder.extraOptions || []);
        
        // 🔥 IMPORTANTE: Cargar partes pendientes automáticamente si ya hay un trailer seleccionado.
        if (found.trailer) {
          console.log(`🔄 Cargando partes pendientes para trailer preseleccionado: ${found.trailer}`);
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
      // Verificar si la W.O. tiene partes ya deducidas del inventario
      try {
        const partsRes = await axios.get(`${API_URL}/work-order-parts/${id}`);
        const parts = Array.isArray(partsRes.data) ? partsRes.data : [];
        
        if (parts.length > 0) {
          const partsList = parts.map((p: any) => `- ${p.sku}: ${p.part_name || p.sku} (Qty: ${p.qty_used})`).slice(0, 5).join('\n');
          const morePartsMsg = parts.length > 5 ? `\n... y ${parts.length - 5} más` : '';
          const partsWarning = `⚠️ ADVERTENCIA: Esta Work Order tiene ${parts.length} parte(s) registrada(s) que ya fueron deducidas del inventario:\n\n${partsList}${morePartsMsg}\n\n⚠️ Al eliminar esta W.O., las partes NO se reintegrarán automáticamente al inventario.\n\n¿Está seguro que desea continuar con la eliminación?`;
          
          if (!window.confirm(partsWarning)) {
            return;
          }
        }
        
        // Confirmación final
        if (window.confirm('Are you sure you want to delete this order?')) {
          // @ts-ignore
          await axios.delete(`${API_URL}/work-orders/${id}`, {
            headers: { 'Content-Type': 'application/json' },
            data: { usuario: localStorage.getItem('username') || '' }
          } as any);
          setWorkOrders(workOrders.filter((order: any) => order.id !== id));
          setSelectedRow(null);
          alert('Order deleted successfully');
        }
      } catch (error) {
        console.error('Error checking parts:', error);
        // Si falla la verificación, preguntar si desea continuar de todos modos
        if (window.confirm('Could not verify parts. Are you sure you want to delete this order?')) {
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
      'Start Date': getOrderStartDate(order),
      'End Date': getOrderEndDate(order),
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
  
  // Función para exportar múltiples PDFs finalizados en un solo ZIP
  const exportFinishedPDFsToZip = async () => {
    try {
      setLoading(true);
      
      // Filtrar solo W.O. FINALIZADAS
      const finishedOrders = workOrders.filter(order => order.status === 'FINISHED');
      
      if (finishedOrders.length === 0) {
        alert('No hay Work Orders finalizadas para exportar');
        setLoading(false);
        return;
      }
      
      if (!window.confirm(`Se exportarán ${finishedOrders.length} Work Orders finalizadas en un archivo ZIP. ¿Continuar?`)) {
        setLoading(false);
        return;
      }
      
      // Crear ZIP manualmente usando base64
      const zip: any = { files: [] };
      let successCount = 0;
      let errorCount = 0;
      
      alert(`Generando ${finishedOrders.length} PDFs... Por favor espere.`);
      
      // Procesar cada W.O. finalizada
      for (const order of finishedOrders) {
        try {
          // Obtener datos completos de la orden
          const workOrderRes = await axios.get(`${API_URL}/work-orders/${order.id}`, { timeout: 10000 });
          const workOrderData = workOrderRes.data as any;
          
          const partsRes = await axios.get(`${API_URL}/work-order-parts/${order.id}`, { timeout: 10000 });
          const partsWithInvoices = Array.isArray(partsRes.data) ? partsRes.data.map((part: any) => {
            // Si la parte ya tiene invoiceLink (de work_order_parts), usarlo
            if (part.invoiceLink) return { ...part, part: part.part || part.part_name || part.description || '' };
            
            // Si no, buscar en el inventario
            const inventoryItem = inventory.find((item: any) => item.sku === part.sku);
            return {
              ...part,
              part: part.part || part.part_name || part.description || '',
              invoiceLink: inventoryItem?.invoiceLink || inventoryItem?.invoice_link || null
            };
          }) : [];
          
          const enrichedParts = partsWithInvoices;

          const pdfData = {
            id: workOrderData.id || order.id,
            idClassic: workOrderData.idClassic || order.idClassic || workOrderData.id?.toString() || order.id.toString(),
            customer: workOrderData.billToCo || workOrderData.customer || '',
            trailer: workOrderData.trailer || '',
            date: formatDateSafely(workOrderData.startDate || workOrderData.date || workOrderData.fecha || ''),
            mechanics: Array.isArray(workOrderData.mechanics) ? 
              workOrderData.mechanics.map((m: any) => `${m.name} (${m.hrs}h)`).join(', ') :
              workOrderData.mechanics || workOrderData.mechanic || '',
            description: workOrderData.description || '',
            status: workOrderData.status || order.status || 'FINISHED',
            parts: enrichedParts.map((part: any) => ({
              sku: part.sku || '',
              description: part.part || part.part_name || part.sku || 'N/A',
              um: 'EA',
              qty: Number(part.qty_used) || 0,
              unitCost: Number(part.cost) || 0,
              total: (Number(part.qty_used) || 0) * (Number(part.cost) || 0),
              invoiceLink: part.invoiceLink || null
            })),
            totalHrs: Number(workOrderData.totalHrs) || 0,
            laborRate: 60,
            laborCost: Number(workOrderData.totalHrs || 0) * 60 || 0,
            subtotalParts: enrichedParts.reduce((sum: number, part: any) => 
              sum + ((Number(part.qty_used) || 0) * (Number(part.cost) || 0)), 0),
            totalCost: Number(workOrderData.totalLabAndParts) || 0,
            extraOptions: order.extraOptions || [],
            miscellaneousPercent: Number(workOrderData.miscellaneous) || 0,
            weldPercent: Number(workOrderData.weldPercent) || 0
          };
          
          const pdf = await generateWorkOrderPDF(pdfData);
          const pdfBlob = pdf.output('blob');
          
          // Guardar en el "ZIP" (array de archivos)
          const filename = `WO_${pdfData.idClassic || order.id}_${order.trailer || 'NoTrailer'}.pdf`;
          zip.files.push({ name: filename, blob: pdfBlob });
          successCount++;
          
          console.log(`✅ PDF generado: ${filename}`);
        } catch (error) {
          console.error(`❌ Error generando PDF para W.O. ${order.id}:`, error);
          errorCount++;
        }
      }
      
      // Crear ZIP simplificado (descargar archivos individuales si no hay JSZip)
      if (zip.files.length > 0) {
        // Como no tenemos JSZip instalado, vamos a descargar los PDFs uno por uno
        alert(`${successCount} PDFs generados exitosamente. Se descargarán individualmente.\n${errorCount > 0 ? `(${errorCount} errores)` : ''}`);
        
        for (const file of zip.files) {
          saveAs(file.blob, file.name);
          // Pequeño delay entre descargas para evitar problemas de navegador
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        alert('✅ Exportación completada');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error exportando PDFs:', error);
      alert('Error al exportar PDFs finalizados');
      setLoading(false);
    }
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
    
    // Determinar el costo usando EXACTAMENTE la misma lógica que WorkOrderForm
    let cost = 0;
    if (inventoryPart) {
      console.log('🔍 Campos de precio disponibles:', {
        precio: inventoryPart.precio,
        cost: inventoryPart.cost,
        price: inventoryPart.price,
        allKeys: Object.keys(inventoryPart)
      });
      
      // PRIORIDAD AL CAMPO 'precio' de la tabla inventory (igual que en WorkOrderForm)
      if (inventoryPart.precio !== undefined && inventoryPart.precio !== null && inventoryPart.precio !== '') {
        cost = parseFloat(String(inventoryPart.precio)) || 0;
        console.log('💰 Usando campo "precio":', inventoryPart.precio, '→', cost);
      } else if (inventoryPart.cost !== undefined && inventoryPart.cost !== null && inventoryPart.cost !== '') {
        cost = parseFloat(String(inventoryPart.cost)) || 0;
        console.log('💰 Usando campo "cost":', inventoryPart.cost, '→', cost);
      } else if (inventoryPart.price !== undefined && inventoryPart.price !== null && inventoryPart.price !== '') {
        cost = parseFloat(String(inventoryPart.price)) || 0;
        console.log('💰 Usando campo "price":', inventoryPart.price, '→', cost);
      } else if (inventoryPart.unitCost !== undefined && inventoryPart.unitCost !== null && inventoryPart.unitCost !== '') {
        cost = parseFloat(String(inventoryPart.unitCost)) || 0;
        console.log('💰 Usando campo "unitCost":', inventoryPart.unitCost, '→', cost);
      } else if (inventoryPart.unit_cost !== undefined && inventoryPart.unit_cost !== null && inventoryPart.unit_cost !== '') {
        cost = parseFloat(String(inventoryPart.unit_cost)) || 0;
        console.log('💰 Usando campo "unit_cost":', inventoryPart.unit_cost, '→', cost);
      } else {
        console.log('❌ No se encontró ningún campo de precio válido');
      }
    } else {
      // Si no se encuentra en inventario, usar el costo de la parte pendiente
      if (pendingPart.costTax) {
        cost = parseFloat(String(pendingPart.costTax)) || 0;
        console.log('💰 Usando costTax de parte pendiente:', pendingPart.costTax, '→', cost);
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
      // Actualizar la cantidad de partes pendientes localmente
    setPendingParts(prevPending => prevPending.filter(pp => pp.id !== pendingPart.id));
    
    console.log(`🎉 Parte ${pendingPart.sku} agregada exitosamente a la WO con costo $${cost.toFixed(2)}`);
  };
  // handlePartClick function removed - was unused

  // Función para ocultar el tooltip
  const hideTooltip = () => setTooltip({ visible: false, x: 0, y: 0, info: null });

  const handlePartHover = (e: React.MouseEvent, partFromOrder: any) => {
    const sku = partFromOrder.sku;
    const partInfo = inventory.find(i => i.sku === sku);
    if (partInfo) {
      // Use custom part name and cost from the work order if available
      const customPartName = partFromOrder.part || '';
      const customCost = partFromOrder.cost || 0;
      
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        info: {
          part: customPartName || partInfo.part || partInfo.description || partInfo.name || 'N/A',
          precio: customCost || partInfo.precio || partInfo.cost || partInfo.price || 0,
          onHand: partInfo.onHand || partInfo.quantity || partInfo.qty || 0,
          um: partInfo.um || partInfo.unit || 'UN'
        }
      });    }
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
          part: part.part || part.description || '', // Guardar el campo personalizado
          part_name: part.part || part.description || '',
          qty_used: Number(part.qty) || 0,
          cost: Number(String(part.cost).replace(/[^0-9.]/g, '')) || 0
        }));
      } else {
        // Si no hay partes en tabla, obtener del API
        try {
          const partsResponse = await axios.get(`${API_URL}/work-order-parts/${workOrderId}`);
          workOrderParts = Array.isArray(partsResponse.data) ? partsResponse.data.map((part: any) => ({
            ...part,
            part: part.part || part.part_name || part.description || ''  // Asegurar que tenga el campo 'part'
          })) : [];
          console.log('📦 Partes desde API:', workOrderParts);
        } catch (partsError) {
          console.warn('⚠️ No se pudieron obtener partes del API:', partsError);
          workOrderParts = [];
        }
      }
      
      // 5. Enriquecer partes con invoice links del inventario/work_order_parts
      const enrichedParts = workOrderParts.map((part: any) => {
        // Si la parte ya tiene invoiceLink (de work_order_parts), usarlo
        if (part.invoiceLink) return part;
        
        // Si no, buscar en el inventario
        const inventoryItem = inventory.find((item: any) => item.sku === part.sku);
        return {
          ...part,
          invoiceLink: inventoryItem?.invoiceLink || inventoryItem?.invoice_link || null
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
      const formattedDate = formatDateSafely(finalWorkOrderData.startDate || finalWorkOrderData.date || '') || 
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
      
      const rawStoredTotal = finalWorkOrderData.totalLabAndParts;
      const parsedStoredTotal = Number(rawStoredTotal);
      const hasStoredTotal =
        rawStoredTotal !== undefined &&
        rawStoredTotal !== null &&
        String(rawStoredTotal).trim() !== '' &&
        !Number.isNaN(parsedStoredTotal);
      const totalCost = hasStoredTotal ? parsedStoredTotal : (laborCost + subtotalParts);
      
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
        parts: enrichedParts.map((part: any) => ({
          sku: part.sku || '',
          description: part.part || part.part_name || part.sku || 'N/A',
          um: 'EA',
          qty: Number(part.qty_used) || 0,
          unitCost: Number(part.cost) || 0,
          total: (Number(part.qty_used) || 0) * (Number(part.cost) || 0),
          invoiceLink: part.invoiceLink || null
        })),        totalHrs: totalHrs,
        laborRate: 60,
        laborCost: laborCost,
        subtotalParts: subtotalParts,
        totalCost: totalCost,
        extraOptions: finalWorkOrderData.extraOptions || [],
        miscellaneousPercent: (typeof finalWorkOrderData.miscellaneous !== 'undefined' && finalWorkOrderData.miscellaneous !== null && finalWorkOrderData.miscellaneous !== '')
          ? Number(finalWorkOrderData.miscellaneous)
          : 0,
        weldPercent: (typeof finalWorkOrderData.weldPercent !== 'undefined' && finalWorkOrderData.weldPercent !== null && finalWorkOrderData.weldPercent !== '')
          ? Number(finalWorkOrderData.weldPercent)
          : 0
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
      
      // 12. Abrir enlaces de facturas automáticamente (de partes destinadas)
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
            width: 100%;
            font-size: 12px;
            text-align: center;
            margin-top: 16px;
            background: white;
          }
          
          .wo-table th, .wo-table td {
            border: 1px solid #d0d7e2;
            padding: 6px 4px;
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
          
          /* MISSING PARTS no debe tener hover ni transitions que bloqueen la animación */
          .wo-table tr.missing-parts-row {
            transition: none !important;
          }
          
          .wo-table tr.missing-parts-row:hover {
            background-color: transparent !important;
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
          
          /* Animación de parpadeo para MISSING PARTS - MÁS VISIBLE */
          @keyframes missingPartsBlink {
            0% { 
              background-color: #f44336 !important; 
              color: #ffffff !important; 
            }
            50% { 
              background-color: #ffffff !important; 
              color: #f44336 !important; 
            }
            100% { 
              background-color: #f44336 !important; 
              color: #ffffff !important; 
            }
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
          
          .wo-table th, .wo-table td {
            border: 1px solid #d0d7e2;
            padding: 2px 4px;
            font-size: 11px;
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
          .wo-table th:nth-child(23), .wo-table td:nth-child(23) { width: 75px; } /* Total HRS */
          .wo-table th:nth-child(24), .wo-table td:nth-child(24) { width: 110px; } /* Total LAB & PRTS */
          .wo-table th:nth-child(25), .wo-table td:nth-child(25) { width: 95px; } /* Status */
          
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
          .wo-table .wo-row-approved {
            background: #43a047 !important; /* Verde fuerte */
            color: #fff !important;
          }
          .wo-table .wo-row-finished {
            background: #ffd600 !important; /* Amarillo fuerte */
            color: #333 !important;
          }
          .wo-table .wo-row-processing {
            background: #fff !important; /* Blanco */
            color: #1976d2 !important;
          }
          .wo-table .missing-parts-row {
            animation: missingPartsBlink 1s ease-in-out infinite !important;
            font-weight: 700 !important;
            border: 3px solid #f44336 !important;
            transition: none !important;
          }
          .wo-table .missing-parts-row td {
            animation: missingPartsBlink 1s ease-in-out infinite !important;
            font-weight: 700 !important;
          }
          .wo-table .missing-parts-row:hover {
            animation: missingPartsBlink 1s ease-in-out infinite !important;
            background-color: transparent !important;
          }
          .wo-row-selected {
            outline: 2px solid #1976d2 !important;
            box-shadow: 0 0 0 2px #1976d233;
          }
          
          /* Animación para cards de Kanban en MISSING PARTS */
          .kanban-card-missing {
            animation: kanbanMissingBlink 2s ease-in-out infinite !important;
            box-shadow: 0 0 12px rgba(244, 67, 54, 0.4) !important;
          }
          
          @keyframes kanbanMissingBlink {
            0% { 
              border-left-color: #f44336;
              background-color: #ffffff;
            }
            50% { 
              border-left-color: #ff5722;
              background-color: #ffebee;
            }
            100% { 
              border-left-color: #f44336;
              background-color: #ffffff;
            }
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
            minWidth: 220
          }}
          onClick={hideTooltip}        >
          <div style={{ fontWeight: 700, color: '#1976d2', marginBottom: 6 }}>Part Info</div>
          <div><b>Part Name:</b> {tooltip.info.part || 'N/A'}</div>
          <div><b>On Hand:</b> {tooltip.info.onHand || 'N/A'}</div>
          <div><b>U/M:</b> {tooltip.info.um || 'N/A'}</div>
          <div>
            <b>Precio actual:</b>{" "}
            {tooltip.info.precio
              ? Number(tooltip.info.precio).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
              : '$0.00'}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>(Click para cerrar)</div>
        </div>
      )}
      
      <div
        style={{
          padding: '32px',
          background: 'linear-gradient(90deg, #fff9c4 0%, #ffffff 100%)',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(255, 193, 7, 0.10)',
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
      background: '#ffd600',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    }}
  >
    <span style={{ color: '#333', fontWeight: 'bold', fontSize: 22 }}>✓</span>
  </div>
  <span
    style={{
      fontSize: 32,
      fontWeight: 700,
      color: '#ffd600',
      fontFamily: 'Courier New, Courier, monospace',
      letterSpacing: 2,
      textShadow: '1px 1px 0 #fff',
    }}  >    W.O ENTRY
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
        {/* FILTRO: ID Classic (sin consulta al servidor) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 16, marginTop: -16 }}>
          <label className="wo-filter-label">
            <span style={{ fontWeight: 'bold', color: '#1976d2' }}>🔍 Search ID Classic:</span>&nbsp;
            <input
              type="text"
              value={searchIdClassic}
              onChange={e => setSearchIdClassic(e.target.value)}
              className="wo-filter-input"
              style={{ 
                minWidth: 160, 
                backgroundColor: searchIdClassic ? '#e3f2fd' : 'white',
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
                          const normalizedOrder = normalizeWorkOrderForEdit(found);
                          setEditWorkOrder(normalizedOrder);
                          setExtraOptions(normalizedOrder.extraOptions || []);
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
        )}        {/* --- BOARD ABAJO --- */}
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
        <div style={{ marginBottom: 12, color: '#455a64', fontSize: 13, fontWeight: 600 }}>
          Drag and drop cards between columns to update status.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
          {boardColumns.map(column => {
            const columnOrders = sortedBoardOrders.filter(order => getStatusForBoard(order.status) === column.key);

            return (
              <div
                key={column.key}
                onDragOver={handleColumnDragOver(column.key)}
                onDrop={handleColumnDrop(column.key)}
                onDragLeave={() => setDragOverStatus((prev) => (prev === column.key ? null : prev))}
                style={{
                  minHeight: 550,
                  background: dragOverStatus === column.key ? '#e3f2fd' : '#f8fbff',
                  border: `2px solid ${dragOverStatus === column.key ? '#1976d2' : '#d0d7e2'}`,
                  borderRadius: 12,
                  padding: 12,
                  transition: 'all 0.2s ease',
                  overflowY: 'auto',
                  maxHeight: '85vh'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '6px 8px', borderRadius: 6, background: '#fff', border: `1px solid ${column.color}` }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: column.color }}>{column.title}</span>
                  <span style={{ minWidth: 24, textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#fff', background: column.color, borderRadius: 999, padding: '2px 6px' }}>
                    {columnOrders.length}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, alignItems: 'start' }}>
                  {columnOrders.map(order => {
                    const startDateStr = getOrderStartDate(order);
                    const endDateStr = getOrderEndDate(order);
                    const [startYYYY, startMM, startDD] = startDateStr.split('-');
                    const [endYYYY, endMM, endDD] = endDateStr.split('-');
                    const displayStartDate = startMM && startDD && startYYYY ? `${startMM}/${startDD}/${startYYYY}` : formatDateSafely(startDateStr || order.date || '');
                    const displayEndDate = endMM && endDD && endYYYY ? `${endMM}/${endDD}/${endYYYY}` : (endDateStr ? formatDateSafely(endDateStr) : '--/--/----');
                    const isMissing = isMissingPartsStatus(order.status);

                    return (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={handleCardDragStart(Number(order.id))}
                        onDragEnd={handleCardDragEnd}
                        onClick={() => {
                          setSelectedRow(order.id);
                          setDetailOrder(order);
                        }}
                        onContextMenu={event => {
                          event.preventDefault();
                          setSelectedRow(order.id);
                          setContextMenu({ visible: true, x: event.clientX, y: event.clientY, order });
                        }}
                        className={isMissing ? 'kanban-card-missing' : ''}
                        style={{
                          background: '#fff',
                          border: selectedRow === order.id ? '2px solid #1976d2' : '1px solid #d0d7e2',
                          borderLeft: `4px solid ${column.color}`,
                          borderRadius: 6,
                          padding: 8,
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(25,118,210,0.08)',
                          transition: 'all 0.15s ease',
                          minHeight: '130px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                        aria-label={`Work Order ${order.id} ${formatStatusLabel(order.status)}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#0d47a1', lineHeight: 1.1 }}>
                              W.O #{order.id}
                            </div>
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: column.color, whiteSpace: 'nowrap', textAlign: 'right', lineHeight: 1.2 }}>
                            <div>INI: {displayStartDate}</div>
                            <div>FIN: {displayEndDate}</div>
                          </div>
                        </div>

                        <div style={{ marginTop: 3, fontSize: 11, color: '#263238', fontWeight: 700, lineHeight: 1.2 }}>
                          {(order.billToCo || 'N/C').slice(0, 18)}
                        </div>

                        <div style={{ marginTop: 2, fontSize: 10, color: '#455a64', lineHeight: 1.2, fontWeight: 600 }}>
                          {(order.trailer || 'N/T').slice(0, 12)}
                        </div>

                        <div style={{ marginTop: 2, fontSize: 9, color: '#546e7a', lineHeight: 1.2 }}>
                          👨‍🔧 {Array.isArray(order.mechanics) && order.mechanics.length > 0
                            ? order.mechanics.map((mechanic: any) => mechanic.name).join(', ').slice(0, 20)
                            : (order.mechanic || 'N/A').slice(0, 20)}
                          {(Array.isArray(order.mechanics) && order.mechanics.length > 0
                            ? order.mechanics.map((mechanic: any) => mechanic.name).join(', ')
                            : (order.mechanic || 'N/A')).length > 20 ? '...' : ''}
                        </div>

                        <div style={{ marginTop: 3, fontSize: 9, color: '#546e7a', background: '#f4f8ff', borderRadius: 3, padding: '4px 5px', lineHeight: 1.3, maxHeight: 36, overflow: 'hidden', flex: 1 }}>
                          {(order.description || 'S/D').slice(0, 60)}
                          {(order.description || '').length > 60 ? '...' : ''}
                        </div>

                        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 'auto' }}>
                          <span style={{ fontWeight: 700, color: '#37474f' }}>HRS: {order.totalHrs || 0}</span>
                          <span style={{ fontWeight: 800, color: '#1b5e20', fontSize: 11 }}>
                            {order.totalLabAndParts !== undefined && order.totalLabAndParts !== null && order.totalLabAndParts !== ''
                              ? '$' + Number(order.totalLabAndParts).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '$0.00'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {columnOrders.length === 0 && (
                    <div style={{ border: '1px dashed #b0bec5', borderRadius: 8, padding: 12, textAlign: 'center', fontSize: 11, color: '#607d8b', background: '#fff' }}>
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {detailOrder && (() => {
        const detailMechanics = Array.isArray(detailOrder.mechanics) ? detailOrder.mechanics : [];
        const validParts = Array.isArray(detailOrder.parts)
          ? detailOrder.parts.filter((part: any) => part && part.sku)
          : [];
        const totalHrsValue = detailMechanics.length > 0
          ? detailMechanics.reduce((sum: number, mechanic: any) => sum + (Number(mechanic?.hrs) || 0), 0)
          : (Number(detailOrder.totalHrs) || 0);
        const laborRate = 60;
        const laborSubtotal = totalHrsValue * laborRate;
        const partsSubtotal = validParts.reduce((sum: number, part: any) => {
          const qty = Number(part.qty) || 0;
          const unitCost = Number(String(part.cost ?? '').replace(/[^0-9.-]/g, '')) || 0;
          return sum + (qty * unitCost);
        }, 0);
        const baseSubtotal = laborSubtotal + partsSubtotal;
        const miscPercentRaw = detailOrder.miscellaneous ?? detailOrder.miscellaneousPercent;
        const miscPercent = Number(miscPercentRaw);
        const miscPercentValue = Number.isFinite(miscPercent) && miscPercent > 0 ? miscPercent : 0;
        const weldPercent = Number(detailOrder.weldPercent);
        const weldPercentValue = Number.isFinite(weldPercent) && weldPercent > 0 ? weldPercent : 0;
        const miscAmount = baseSubtotal * (miscPercentValue / 100);
        const weldAmount = baseSubtotal * (weldPercentValue / 100);
        const calculatedTotal = baseSubtotal + miscAmount + weldAmount;
        const rawStoredTotal = detailOrder.totalLabAndParts;
        const storedTotal = Number(String(rawStoredTotal ?? '').replace(/[^0-9.-]/g, ''));
        const hasStoredTotal =
          rawStoredTotal !== undefined &&
          rawStoredTotal !== null &&
          String(rawStoredTotal).trim() !== '' &&
          Number.isFinite(storedTotal);
        const finalTotal = hasStoredTotal ? storedTotal : calculatedTotal;

        return (
        <div style={modalStyle} onClick={() => setDetailOrder(null)}>
          <div style={{ ...modalContentStyle, maxWidth: 980, width: '90vw' }} onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: '#1976d2' }}>
                W.O #{detailOrder.id} {detailOrder.idClassic ? `• ${detailOrder.idClassic}` : ''}
              </h2>
              <button
                onClick={() => setDetailOrder(null)}
                style={{ border: 'none', background: '#eceff1', color: '#37474f', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div><strong>Status:</strong> {formatStatusLabel(detailOrder.status)}</div>
              <div><strong>Bill To:</strong> {detailOrder.billToCo || 'N/A'}</div>
              <div><strong>Trailer:</strong> {detailOrder.trailer || 'N/A'}</div>
              <div><strong>Start Date:</strong> {formatDateSafely(getOrderStartDate(detailOrder) || '')}</div>
              <div><strong>End Date:</strong> {getOrderEndDate(detailOrder) ? formatDateSafely(getOrderEndDate(detailOrder)) : 'Pending'}</div>
              <div><strong>Mechanic:</strong> {detailMechanics.length > 0
                ? detailMechanics.map((mechanic: any) => mechanic.name).join(', ')
                : (detailOrder.mechanic || 'N/A')}</div>
              <div><strong>Total HRS:</strong> {totalHrsValue.toFixed(2)}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong>Description:</strong>
              <div style={{ marginTop: 6, background: '#f8f9fb', border: '1px solid #d0d7e2', borderRadius: 8, padding: 10, whiteSpace: 'pre-line' }}>
                {detailOrder.description || 'No description'}
              </div>
            </div>

            <div>
              <strong>Parts:</strong>
              <div style={{ marginTop: 8, overflowX: 'auto' }}>
                <table className="wo-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>SKU</th>
                      <th>Part</th>
                      <th>Qty</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validParts.length > 0 ? (
                      validParts
                        .map((part: any, index: number) => (
                          <tr key={`${detailOrder.id}-${index}`}>
                            <td>{index + 1}</td>
                            <td>{part.sku}</td>
                            <td>{part.part || part.description || '-'}</td>
                            <td>{part.qty || 0}</td>
                            <td>
                              {part.cost !== undefined && part.cost !== null && part.cost !== ''
                                ? Number(part.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                                : '$0.00'}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={5}>No parts registered</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <strong>Hours Logged:</strong>
              <div style={{ marginTop: 6, background: '#f8f9fb', border: '1px solid #d0d7e2', borderRadius: 8, padding: 10 }}>
                {detailMechanics.length > 0 ? (
                  detailMechanics.map((mechanic: any, index: number) => (
                    <div key={`hrs-${index}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{mechanic?.name || `Mechanic ${index + 1}`}</span>
                      <strong>{(Number(mechanic?.hrs) || 0).toFixed(2)} h</strong>
                    </div>
                  ))
                ) : (
                  <div>No individual mechanic hours recorded.</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <strong>Totals Breakdown:</strong>
              <div style={{ marginTop: 6, background: '#f8f9fb', border: '1px solid #d0d7e2', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Labor ({totalHrsValue.toFixed(2)}h × ${laborRate}/h)</span>
                  <strong>{laborSubtotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Parts Subtotal</span>
                  <strong>{partsSubtotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Miscellaneous ({miscPercentValue.toFixed(2)}%)</span>
                  <strong>{miscAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Welding Supplies ({weldPercentValue.toFixed(2)}%)</span>
                  <strong>{weldAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d0d7e2', paddingTop: 6, marginTop: 6 }}>
                  <span><strong>Total Calculated</strong></span>
                  <strong>{calculatedTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#1b5e20', fontSize: 18 }}>
                Total W.O: {finalTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </strong>
              <button
                style={secondaryBtn}
                onClick={() => handleViewPDF(detailOrder.id)}
              >
                Ver PDF
              </button>
            </div>
          </div>
        </div>
      )})()}

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
                    const normalizedOrder = normalizeWorkOrderForEdit(data);
                    setEditWorkOrder(normalizedOrder);
                    setExtraOptions(normalizedOrder.extraOptions || []);
                  } else {
                    const normalizedOrder = normalizeWorkOrderForEdit(contextMenu.order);
                    setEditWorkOrder(normalizedOrder);
                    setExtraOptions(normalizedOrder.extraOptions || []);
                  }
                } catch {
                  const normalizedOrder = normalizeWorkOrderForEdit(contextMenu.order);
                  setEditWorkOrder(normalizedOrder);
                  setExtraOptions(normalizedOrder.extraOptions || []);
                }
                setShowEditForm(true);
                setEditId(contextMenu.order.id);
                setContextMenu({ ...contextMenu, visible: false });
              } else if (pwd !== null) {
                alert('Contraseña incorrecta');
              }
            }}
          >Edit</button>
          <button
            style={{ background: '#d32f2f', color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', border: 'none', borderBottom: '2px solid #eee', width: '100%', cursor: 'pointer' }}
            onClick={() => {
              handleDelete(contextMenu.order.id);
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >Delete</button>
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
                try {
                  await updateWorkOrderStatus(contextMenu.order, 'APPROVED');
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
      minWidth: 220
    }}
    onClick={hideTooltip}
  >
    <div style={{ fontWeight: 700, color: '#1976d2', marginBottom: 6 }}>Part Info</div>
    <div><b>Part Name:</b> {tooltip.info.part}</div>
    <div><b>On Hand:</b> {tooltip.info.onHand}</div>
    <div><b>U/M:</b> {tooltip.info.um}</div>
    <div>
      <b>Precio actual:</b>{" "}
      {tooltip.info.precio
        ? Number(tooltip.info.precio).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        : '$0.00'}
    </div>
    <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>(Click para cerrar)</div>
  </div>
)}
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