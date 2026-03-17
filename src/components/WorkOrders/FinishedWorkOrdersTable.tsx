import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import WorkOrderForm from './WorkOrderForm';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
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
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(weekOfYear);

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

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

// PROFESSIONAL COLOR SCHEME: Blue Dark + Grays + Accents
const colors = {
  primary: '#0A3854',      // Professional Dark Navy
  primaryDark: '#0D47A1',  // Darker Blue
  accent: '#E3F2FD',       // Light Blue (accent)
  success: '#388E3C',      // Green
  warning: '#F57C00',      // Orange
  danger: '#C62828',       // Red
  gray100: '#F5F7FA',      // Lightest gray bg
  gray200: '#EEEEEE',      // Light gray
  gray300: '#E0E0E0',      // Medium-light gray
  gray600: '#424242',      // Dark gray text
  gray700: '#212121',      // Darker gray text
  white:   '#FFFFFF'
};

const primaryBtn = {
  background: colors.primary,
  color: colors.white,
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  fontWeight: '600',
  cursor: 'pointer',
  marginRight: '8px',
  fontSize: '14px'
};

const dangerBtn = {
  background: colors.danger,
  color: colors.white,
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  fontWeight: '600',
  cursor: 'pointer',
  marginRight: '8px',
  fontSize: '14px'
};

const secondaryBtn = {
  background: colors.gray200,
  color: colors.gray600,
  border: `1px solid ${colors.gray300}`,
  padding: '8px 16px',
  borderRadius: '6px',
  fontWeight: '600',
  cursor: 'pointer',
  marginRight: '8px',
  fontSize: '14px'
};

function calcularTotalWO(order: any) {
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
  return '$0.00';
}

const FinishedWorkOrdersTable: React.FC = () => {
  const handleEditWorkOrderSubmit = async (data: any) => {
    const safeData = { ...data };
    if (Array.isArray(safeData.mechanics) && safeData.mechanics.length > 0) {
      safeData.mechanic = safeData.mechanics[0]?.name || '';
    } else if (typeof safeData.mechanic !== 'string') {
      safeData.mechanic = '';
    }
    safeData.date = safeData.date || '';
    safeData.description = safeData.description || '';
    safeData.status = safeData.status || 'FINISHED';
    safeData.totalLabAndParts = safeData.totalLabAndParts || '$0.00';
    safeData.parts = Array.isArray(safeData.parts) ? safeData.parts : [];
    safeData.mechanics = Array.isArray(safeData.mechanics) ? safeData.mechanics : [];

    if (!editWorkOrder) {
      alert('No work order loaded for editing.');
      return;
    }
    setLoading(true);
    try {
      let dateToSend = data.date;
      if (dateToSend && dateToSend.length >= 10) {
        if (dateToSend.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [month, day, year] = dateToSend.split('/');
          dateToSend = `${year}-${month}-${day}`;
        } else if (dateToSend.match(/^\d{4}-\d{2}-\d{2}/)) {
          dateToSend = dateToSend.slice(0, 10);
        }
      }
      let totalToSend = data.totalLabAndParts;
      if (typeof totalToSend === 'string') {
        totalToSend = Number(String(totalToSend).replace(/[^0-9.]/g, ''));
      }
      if (!totalToSend || isNaN(totalToSend)) {
        totalToSend = 0;
      }

      const dataToSend = { 
        ...safeData, 
        date: dateToSend, 
        totalLabAndParts: totalToSend
      };

      await axios.put(`${API_URL}/work-orders/${editWorkOrder.id}`, dataToSend);
      await fetchWorkOrders();
      await fetchInventory();

      setWorkOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === editWorkOrder.id
            ? { ...order, ...editWorkOrder, ...data,
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

      alert(`✅ Work Order updated successfully!`);
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message;
      if (err?.response?.status === 409 && err?.response?.data?.error === 'DUPLICATE_IDCLASSIC_FINISHED') {
        alert(`❌ Cannot update Work Order: ${backendMessage}`);
        return;
      }
      if (err?.response?.status === 400 && err?.response?.data?.error === 'IDCLASSIC_REQUIRED_FOR_FINISHED') {
        alert(`❌ Cannot update Work Order: ${backendMessage}`);
        return;
      }
      alert(`❌ Error updating Work Order: ${backendMessage || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [editWorkOrder, setEditWorkOrder] = useState<any | null>(null);
  const [editError, setEditError] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [newWorkOrder, setNewWorkOrder, resetNewWorkOrder] = useNewWorkOrder();
  const [selectedWeek, setSelectedWeek] = useState(dayjs().format('YYYY-[W]WW'));
  const [selectedDay, setSelectedDay] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean, x: number, y: number, info: any }>({ visible: false, x: 0, y: 0, info: null });
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [, setServerStatus] = useState<'online' | 'waking' | 'offline'>('online');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [searchIdClassic, setSearchIdClassic] = useState('');
  const [currentPageData, setCurrentPageData] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, order: any | null }>({ visible: false, x: 0, y: 0, order: null });
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  
  // NEW: Admin filters
  const [selectedClient, setSelectedClient] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchId, setSearchId] = useState('');
  
  const pageSize = 100;

  const formatDateSafely = (dateString: string) => {
    if (!dateString) return '';
    try {
      if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${month}/${day}/${year}`;
      }
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('en-US');
    } catch (error) {
      console.error('Error formateando fecha:', dateString, error);
      return dateString;
    }
  };

  const loadWorkOrderWithDetailedParts = useCallback(async (orderOrId: any) => {
    const orderId = typeof orderOrId === 'number' ? orderOrId : Number(orderOrId?.id);
    const baseOrder = typeof orderOrId === 'object' ? orderOrId : null;

    if (!orderId) return baseOrder;

    try {
      const [workOrderRes, partsRes] = await Promise.all([
        axios.get(`${API_URL}/work-orders/${orderId}`),
        axios.get(`${API_URL}/work-order-parts/${orderId}`).catch(() => ({ data: [] })),
      ]);

      const latestOrder = workOrderRes?.data || baseOrder || {};
      const partRows = Array.isArray(partsRes?.data) ? partsRes.data : [];

      const normalizedParts = partRows.map((part: any) => {
        const sku = String(part.sku || '').trim();
        const inventoryItem = inventory.find((item: any) => String(item.sku || '').trim().toLowerCase() === sku.toLowerCase());
        const resolvedInvoiceLink =
          part.invoiceLink ||
          part.invoice_link ||
          inventoryItem?.invoiceLink ||
          inventoryItem?.invoice_link ||
          null;

        return {
          sku,
          part: part.part || part.part_name || part.description || '',
          part_name: part.part_name || part.part || part.description || '',
          qty: part.qty_used ?? part.qty ?? 0,
          qty_used: part.qty_used ?? part.qty ?? 0,
          cost: part.cost ?? 0,
          invoiceLink: resolvedInvoiceLink,
          invoice_link: resolvedInvoiceLink,
        };
      });

      return {
        ...latestOrder,
        parts: normalizedParts.length > 0
          ? normalizedParts
          : (Array.isArray(latestOrder?.parts) ? latestOrder.parts : []),
      };
    } catch (error) {
      console.warn('Error loading detailed parts for finished W.O:', error);
      return baseOrder;
    }
  }, [inventory]);

  const openFinishedWorkOrderDetail = useCallback(async (order: any) => {
    if (!order) return;

    setDetailOrder(order);
    const detailedOrder = await loadWorkOrderWithDetailedParts(order);
    if (detailedOrder) {
      setDetailOrder(detailedOrder);
    }
  }, [loadWorkOrderWithDetailedParts]);

  const fetchWorkOrders = useCallback(async (isRetry = false, pageToLoad?: number) => {
    try {
      setFetchingData(true);
      const targetPage = pageToLoad || currentPageData;

      const res = await axios.get<WorkOrdersApiResponse | any[]>(`${API_URL}/work-orders`, {
        params: {
          page: targetPage,
          pageSize: pageSize,
          status: 'FINISHED'
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
        const fetchedOrders = Array.isArray(res.data) ? res.data : [];
        setWorkOrders(fetchedOrders);
        setTotalPages(1);
        setTotalRecords(fetchedOrders.length);
        setHasNextPage(false);
        setHasPreviousPage(false);
      }

      setServerStatus('online');
      setRetryCount(0);
    } catch (err: any) {
      console.error('Error cargando órdenes finalizadas:', err);
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
      } else {
        setServerStatus('offline');
      }
    } finally {
      setFetchingData(false);
    }
  }, [retryCount, currentPageData, pageSize]);

  useEffect(() => {
    fetchWorkOrders();
    const handleSystemChange = () => fetchWorkOrders();
    window.addEventListener('systemDataChanged', handleSystemChange);

    return () => {
      window.removeEventListener('systemDataChanged', handleSystemChange);
    };
  }, [fetchWorkOrders]);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/inventory`, { timeout: 15000 });
      const inventoryData = Array.isArray(res.data) ? res.data : [];
      setInventory(inventoryData);
    } catch (err) {
      console.error('Error cargando inventario:', err);
      setInventory([]);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const filteredOrders = workOrders.filter(order => {
    if (!order.date) return false;

    // SOLO mostrar W.O con status FINISHED
    if (order.status !== 'FINISHED') return false;

    // Filter by week (default: current week)
    let inWeek = true;
    if (selectedWeek) {
      const { start, end } = getWeekRange(selectedWeek);
      const orderDate = dayjs(order.date.slice(0, 10));
      inWeek = orderDate.isBetween(start, end, 'day', '[]');
    }

    // Client filter (optional, default: all)
    if (selectedClient && selectedClient !== '' && selectedClient !== 'all') {
      const client = order.billToCo || 'No Client';
      if (client !== selectedClient) return false;
    }

    // Search filter
    if (searchId) {
      const searchLower = searchId.toLowerCase();
      const matches = String(order.id).toLowerCase().includes(searchLower) ||
        (order.idClassic && String(order.idClassic).toLowerCase().includes(searchLower)) ||
        (order.billToCo && order.billToCo.toLowerCase().includes(searchLower)) ||
        (order.trailer && String(order.trailer).toLowerCase().includes(searchLower));
      if (!matches) return false;
    }

    return inWeek;
  });

  // NEW: Calculate statistics
  const stats = React.useMemo(() => {
    const totalWOs = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, wo) => {
      return sum + (Number(wo.totalLabAndParts) || 0);
    }, 0);
    const averagePerWO = totalWOs > 0 ? totalRevenue / totalWOs : 0;

    // Get unique clients
    const clientStats = new Map<string, { count: number; revenue: number }>();
    filteredOrders.forEach(wo => {
      const client = wo.billToCo || 'Sin Cliente';
      const current = clientStats.get(client) || { count: 0, revenue: 0 };
      clientStats.set(client, {
        count: current.count + 1,
        revenue: current.revenue + (Number(wo.totalLabAndParts) || 0)
      });
    });

    const topClients = Array.from(clientStats.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);

    return { totalWOs, totalRevenue, averagePerWO, topClients };
  }, [filteredOrders]);

  // Get unique clients for dropdown
  const uniqueClients = React.useMemo(() => {
    return Array.from(
      new Set(workOrders.map(wo => wo.billToCo || 'No Client'))
    ).sort();
  }, [workOrders]);

  const handleWorkOrderChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any
  ) => {
    if (e && e.target) {
      const { name, value, type } = e.target;
      if (type === 'date' && editWorkOrder) {
        setEditWorkOrder((prev: any) => ({ ...prev, date: value }));
        return;
      }
      if (editWorkOrder) {
        setEditWorkOrder((prev: any) => ({ ...prev, [name]: value }));
      }
    }
  };

  const handlePartChange = (index: number, field: string, value: string) => {
    if (editWorkOrder) {
      const updatedParts = [...editWorkOrder.parts];
      updatedParts[index][field as 'part' | 'sku' | 'qty' | 'cost'] = value;
      setEditWorkOrder((prev: any) => ({ ...prev, parts: updatedParts }));
    }
  };

  const handleEdit = () => {
    if (selectedRow === null) return;
    const pwd = window.prompt('Enter edit password (Level 3):');
    if (pwd === '6214') {
      const found = workOrders.find(wo => wo.id === selectedRow);
      if (found) {
        setEditWorkOrder({
          ...found,
          date: found.date ? found.date.slice(0, 10) : '',
          parts: Array.isArray(found.parts) ? found.parts : [],
          mechanics: Array.isArray(found.mechanics) ? found.mechanics : [],
        });
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
          await axios.delete(`${API_URL}/work-orders/${id}`, {
            headers: { 'Content-Type': 'application/json' },
            data: { usuario: localStorage.getItem('username') || '' }
          } as any);
          setWorkOrders(workOrders.filter((order: any) => order.id !== id));
          setSelectedRow(null);
          alert('✅ Order deleted successfully');
        } catch {
          alert('❌ Error deleting order');
        }
      }
    } else if (pwd !== null) {
      alert('Incorrect password');
    }
  };

  const handleViewPDF = async (workOrderId: number) => {
    try {
      const workOrderFromTable = await loadWorkOrderWithDetailedParts(workOrderId);
      
      if (!workOrderFromTable) {
        alert('Work Order no encontrada');
        return;
      }

      let workOrderParts: any[] = [];
      if (workOrderFromTable.parts && Array.isArray(workOrderFromTable.parts) && workOrderFromTable.parts.length > 0) {
        workOrderParts = workOrderFromTable.parts.map((part: any, index: number) => ({
          id: `table_${index}`,
          sku: part.sku || '',
          part_name: part.part || part.description || '',
          qty_used: Number(part.qty) || 0,
          cost: Number(String(part.cost).replace(/[^0-9.]/g, '')) || 0,
          invoiceLink: part.invoiceLink || part.invoice_link || null,
        }));
      }

      let mechanicsString = '';
      let totalHrs = 0;
      if (workOrderFromTable.mechanic && workOrderFromTable.mechanic.trim() !== '') {
        mechanicsString = workOrderFromTable.mechanic;
        totalHrs = Number(workOrderFromTable.totalHrs) || 0;
      } else if (workOrderFromTable.mechanics) {
        try {
          let mechanicsArray = workOrderFromTable.mechanics;
          if (typeof mechanicsArray === 'string') {
            mechanicsArray = JSON.parse(mechanicsArray);
          }
          if (Array.isArray(mechanicsArray) && mechanicsArray.length > 0) {
            mechanicsString = mechanicsArray.map((m: any) => {
              const hrs = Number(m.hrs) || 0;
              totalHrs += hrs;
              return `${m.name} (${hrs}h)`;
            }).join(', ');
          }
        } catch (error) {
          mechanicsString = String(workOrderFromTable.mechanics || '');
        }
      }

      const miscPercentRaw = workOrderFromTable.miscellaneous ?? workOrderFromTable.miscellaneousPercent;
      const miscPercent = Number(miscPercentRaw);
      const weldPercent = Number(workOrderFromTable.weldPercent);
      const normalizedMiscPercent = Number.isFinite(miscPercent) && miscPercent > 0 ? miscPercent : 0;
      const normalizedWeldPercent = Number.isFinite(weldPercent) && weldPercent > 0 ? weldPercent : 0;
      const normalizedExtraOptions = Array.isArray(workOrderFromTable.extraOptions)
        ? workOrderFromTable.extraOptions
        : [];

      const pdfData = {
        id: workOrderFromTable.id,
        idClassic: workOrderFromTable.idClassic || workOrderFromTable.id.toString(),
        customer: workOrderFromTable.billToCo || 'N/A',
        trailer: workOrderFromTable.trailer || '',
        date: formatDateSafely(workOrderFromTable.date || ''),
        mechanics: mechanicsString,
        description: workOrderFromTable.description || '',
        status: 'FINISHED',
        parts: workOrderParts.map((part: any) => ({
          sku: part.sku,
          description: part.part_name,
          um: 'EA',
          qty: part.qty_used,
          unitCost: part.cost,
          total: part.qty_used * part.cost,
          invoiceLink: part.invoiceLink || null,
        })),
        totalHrs: totalHrs,
        laborRate: 60,
        laborCost: totalHrs * 60,
        subtotalParts: workOrderParts.reduce((sum, part) => sum + (part.qty_used * part.cost), 0),
        totalCost: Number(workOrderFromTable.totalLabAndParts) || 0,
        extraOptions: normalizedExtraOptions,
        miscellaneousPercent: normalizedMiscPercent,
        weldPercent: normalizedWeldPercent,
      };

      const pdf = await generateWorkOrderPDF(pdfData);
      openPDFInNewTab(pdf, `work_order_${pdfData.idClassic}_finished.pdf`);
    } catch (error: any) {
      console.error('Error visualizando PDF:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  const hideTooltip = () => setTooltip({ visible: false, x: 0, y: 0, info: null });

  const handlePartHover = (e: React.MouseEvent, partFromOrder: any) => {
    const sku = partFromOrder.sku;
    const partInfo = inventory.find(i => i.sku === sku);
    if (partInfo) {
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
      });
    }
  };

  const exportToExcel = () => {
    const exportData = filteredOrders.map(order => ({
      'ID': order.id,
      'ID Classic': order.idClassic || 'N/A',
      'Client': order.billToCo || 'No Client',
      'Trailer': order.trailer || 'N/A',
      'Mechanic': order.mechanic || 'N/A',
      'Date': dayjs(order.date).format('MM/DD/YYYY'),
      'Description': order.description || 'N/A',
      'Total Hours': order.totalHrs || 0,
      'Total $': Number(order.totalLabAndParts).toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Finished W.O');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), `finished_wo_report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const exportToPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const pdf = new jsPDF('l', 'mm', 'a4'); // landscape mode
      pdf.setFont('courier');
      
      // Header
      pdf.setFontSize(16);
      pdf.setTextColor(10, 56, 84);
      pdf.text('FINISHED WORK ORDERS REPORT', 15, 15);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`, 15, 22);
      pdf.text(`Client: ${selectedClient}`, 15, 28);
      if (selectedWeek) {
        pdf.text(`Week: ${selectedWeek}`, 15, 34);
      }
      
      // Table data
      const tableData = filteredOrders.map(order => [
        String(order.id),
        String(order.idClassic || 'N/A'),
        String(order.billToCo || 'No Client'),
        String(order.trailer || 'N/A'),
        dayjs(order.date).format('MM/DD/YYYY'),
        String(order.description || 'N/A').substring(0, 30) || 'N/A',
        String(Number(order.totalHrs || 0).toFixed(1)),
        `$${Number(order.totalLabAndParts).toFixed(2)}`
      ]);
      
      autoTable(pdf, {
        startY: 42,
        head: [['ID', 'ID Classic', 'Client', 'Trailer', 'Date', 'Description', 'Hours', 'Total']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [10, 56, 84],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          1: { halign: 'center', cellWidth: 20 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { cellWidth: 35 },
          6: { halign: 'center', cellWidth: 15 },
          7: { halign: 'right', cellWidth: 18 }
        }
      });
      
      // Footer with totals
      const finalY = (pdf as any).lastAutoTable?.finalY || 150;
      pdf.setFontSize(11);
      pdf.setTextColor(10, 56, 84);
      pdf.setFont('courier', 'bold');
      pdf.text(`Total W.O: ${stats.totalWOs}`, 15, finalY + 10);
      pdf.text(`Total Revenue: $${stats.totalRevenue.toFixed(2)}`, 15, finalY + 16);
      pdf.text(`Average per W.O: $${stats.averagePerWO.toFixed(2)}`, 15, finalY + 22);
      
      pdf.save(`finished_wo_report_${dayjs().format('YYYY-MM-DD')}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('❌ Error generating PDF. Try exporting to Excel instead.');
    }
  };

  const handleResetFilters = () => {
    setSelectedClient('');
    setSearchId('');
    setSelectedWeek('');
  };

  const handleSendEmailReport = async () => {
    try {
      const reportData = {
        period: dateFrom && dateTo 
          ? `${dayjs(dateFrom).format('MM/DD/YYYY')} - ${dayjs(dateTo).format('MM/DD/YYYY')}`
          : 'Selected Period',
        generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        totalWOs: stats.totalWOs,
        totalRevenue: stats.totalRevenue,
        averagePerWO: stats.averagePerWO,
        topClients: stats.topClients,
        workOrders: filteredOrders
      };

      await axios.post(`${API_URL}/reports/send-email`, {
        type: 'final_work_orders',
        report: reportData,
        usuario: localStorage.getItem('username') || 'system'
      });

      alert('✅ Report sent successfully via email');
    } catch (error) {
      console.error('Error sending email report:', error);
      alert('❌ Error sending report. Try exporting to Excel manually.');
    }
  };

  const addEmptyPart = () => {
    if (editWorkOrder) {
      setEditWorkOrder((prev: any) => ({
        ...prev,
        parts: [
          ...(prev.parts || []),
          { part: '', sku: '', qty: '', cost: '' }
        ]
      }));
    }
  };

  const deletePart = (index: number) => {
    if (editWorkOrder) {
      setEditWorkOrder((prev: any) => ({
        ...prev,
        parts: (prev.parts || []).filter((_: any, i: number) => i !== index)
      }));
    }
  };

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
    background: colors.white,
    borderRadius: 16,
    padding: 20,
    width: '96vw',
    maxWidth: 1480,
    maxHeight: '92vh',
    overflow: 'auto',
    boxShadow: `0 4px 24px rgba(21,101,192,0.15)`
  };

  return (
    <>
      <style>
        {`
          .wo-table {
            border-collapse: collapse;
            width: 100%;
            min-width: 1750px;
            background: ${colors.white};
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border: 1px solid ${colors.gray300};
            font-size: 11px;
          }
          
          .wo-table th, .wo-table td {
            border: 1px solid ${colors.gray300};
            padding: 12px 16px;
            font-size: 12px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
          }
          
          .wo-table th:nth-child(1), .wo-table td:nth-child(1) { width: 60px; text-align: left; }
          .wo-table th:nth-child(2), .wo-table td:nth-child(2) { width: 85px; text-align: left; }
          .wo-table th:nth-child(3), .wo-table td:nth-child(3) { width: 85px; text-align: left; }
          .wo-table th:nth-child(4), .wo-table td:nth-child(4) { width: 85px; text-align: left; }
          .wo-table th:nth-child(5), .wo-table td:nth-child(5) { width: 100px; text-align: left; }
          .wo-table th:nth-child(6), .wo-table td:nth-child(6) { width: 100px; text-align: left; }
          .wo-table th:nth-child(7), .wo-table td:nth-child(7) { width: 200px; text-align: left; white-space: normal; }
          .wo-table th:nth-child(n+8), .wo-table td:nth-child(n+8) { text-align: right; }
          
          .wo-table th {
            background: ${colors.primary};
            color: ${colors.white};
            font-weight: 700;
            font-size: 13px;
            position: sticky;
            top: 0;
            z-index: 10;
            border-bottom: 2px solid ${colors.primaryDark};
          }
          
          .wo-table tbody tr {
            background: ${colors.white};
            border-bottom: 1px solid ${colors.gray300};
            transition: background 0.2s;
          }
          
          .wo-table tbody tr:nth-child(even) {
            background: ${colors.gray100};
          }
          
          .wo-table tbody tr:hover {
            background: ${colors.accent} !important;
          }
          
          .wo-table tr.selected {
            background: ${colors.accent} !important;
            font-weight: 700;
          }
          
          .wo-row-finished {
            background: #FFFDE7 !important;
            color: ${colors.gray700} !important;
            font-weight: 600;
          }
        `}
      </style>

      {tooltip.visible && tooltip.info && (
        <div
          style={{
            position: 'fixed',
            top: tooltip.y + 10,
            left: tooltip.x + 10,
            background: colors.white,
            border: `1px solid ${colors.primary}`,
            borderRadius: 8,
            boxShadow: `0 2px 8px rgba(21,101,192,0.15)`,
            padding: 16,
            zIndex: 9999,
            minWidth: 220
          }}
          onClick={hideTooltip}
        >
          <div style={{ fontWeight: 700, color: colors.primary, marginBottom: 6 }}>Part Info</div>
          <div style={{ fontSize: 12, color: colors.gray600 }}><b>Part Name:</b> {tooltip.info.part || 'N/A'}</div>
          <div style={{ fontSize: 12, color: colors.gray600 }}><b>On Hand:</b> {tooltip.info.onHand || 'N/A'}</div>
          <div style={{ fontSize: 12, color: colors.gray600 }}><b>U/M:</b> {tooltip.info.um || 'N/A'}</div>
          <div style={{ fontSize: 12, color: colors.gray600, marginTop: 4 }}>
            <b>Precio:</b>{" "}
            {tooltip.info.precio
              ? Number(tooltip.info.precio).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
              : '$0.00'}
          </div>
        </div>
      )}

      <div style={{ padding: 24, background: colors.gray100, minHeight: '100vh' }}>
        {/* Professional Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          marginBottom: 24,
          background: colors.primary,
          borderRadius: 8,
          boxShadow: `0 2px 8px rgba(21,101,192,0.15)`
        }}>
          <div>
            <div style={{
              fontSize: 24,
              fontWeight: 700,
              color: colors.white,
              letterSpacing: 0.5,
            }}>
              📋 FINALIZED WORK ORDERS
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: 500 }}>
              Historical records & analytics
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 16, color: colors.accent, fontWeight: 600 }}>
              {filteredOrders.length} Records
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 500, marginTop: 4 }}>
              💰 ${stats.totalRevenue.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Filter Section - Professional */}
        <div style={{
          background: colors.white,
          borderRadius: 8,
          marginBottom: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: `1px solid ${colors.gray300}`,
          overflow: 'hidden'
        }}>
          {/* Filter Header */}
          <div style={{
            background: colors.primary,
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.white, letterSpacing: 0.5 }}>FILTERS & ANALYTICS</span>
          </div>

          {/* Filters Grid */}
          <div style={{ padding: '24px', borderBottom: `1px solid ${colors.gray300}` }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1fr', 
              gap: 20,
              marginBottom: 0
            }}>
              {/* Client Filter */}
              <div>
                <label style={{ 
                  fontSize: 11, 
                  fontWeight: 700, 
                  color: colors.gray600, 
                  display: 'block', 
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  📋 Client *
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => { setSelectedClient(e.target.value); setCurrentPageData(1); }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    background: colors.white,
                    cursor: 'pointer',
                    color: colors.gray600
                  }}
                >
                  <option value="">Select Client...</option>
                  <option value="all">🌎 All Clients</option>
                  {uniqueClients.map(client => (
                    <option key={client} value={client}>{client}</option>
                  ))}
                </select>
              </div>

              {/* Week Filter */}
              <div>
                <label style={{ 
                  fontSize: 11, 
                  fontWeight: 700, 
                  color: colors.gray600, 
                  display: 'block', 
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  📅 Week
                </label>
                <input
                  type="week"
                  value={selectedWeek}
                  onChange={(e) => { setSelectedWeek(e.target.value); setCurrentPageData(1); }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    background: colors.white,
                    color: colors.gray600
                  }}
                />
              </div>

              {/* Search */}
              <div>
                <label style={{ 
                  fontSize: 11, 
                  fontWeight: 700, 
                  color: colors.gray600, 
                  display: 'block', 
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  🔍 Search
                </label>
                <input
                  type="text"
                  placeholder="ID / Client / Trailer"
                  value={searchId}
                  onChange={(e) => { setSearchId(e.target.value); setCurrentPageData(1); }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    background: colors.white,
                    color: colors.gray600
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 20 }}>
              <button 
                style={{
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: colors.gray200,
                  color: colors.gray600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }} 
                onClick={handleResetFilters}
              >
                <span>🔄</span> Reset
              </button>
              <button 
                style={{
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: colors.success,
                  color: colors.white,
                  border: 'none',
                  cursor: filteredOrders.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: filteredOrders.length === 0 ? 0.5 : 1
                }} 
                onClick={exportToPDF}
                disabled={filteredOrders.length === 0}
              >
                <span>📄</span> Export PDF
              </button>
              <button 
                style={{
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: colors.warning,
                  color: colors.white,
                  border: 'none',
                  cursor: filteredOrders.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: filteredOrders.length === 0 ? 0.5 : 1
                }} 
                onClick={handleSendEmailReport}
                disabled={filteredOrders.length === 0}
              >
                <span>📧</span> Send Email Report
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {filteredOrders.length > 0 && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
              gap: 16,
              padding: '24px',
              background: colors.gray100
            }}>
              <div style={{ 
                background: colors.white,
                borderRadius: 8, 
                padding: '16px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: `1px solid ${colors.gray300}`,
                borderLeft: `4px solid ${colors.primary}`
              }}>
                <div style={{ fontSize: 10, color: '#90A4AE', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Work Orders
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: colors.primary }}>{stats.totalWOs}</div>
              </div>
              <div style={{ 
                background: colors.white,
                borderRadius: 8, 
                padding: '16px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: `1px solid ${colors.gray300}`,
                borderLeft: `4px solid ${colors.success}`
              }}>
                <div style={{ fontSize: 10, color: '#90A4AE', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Revenue
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: colors.success }}>${stats.totalRevenue.toFixed(2)}</div>
              </div>
              <div style={{ 
                background: colors.white,
                borderRadius: 8, 
                padding: '16px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: `1px solid ${colors.gray300}`,
                borderLeft: `4px solid ${colors.warning}`
              }}>
                <div style={{ fontSize: 10, color: '#90A4AE', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Average Per Order
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.warning }}>${stats.averagePerWO.toFixed(2)}</div>
              </div>
              {stats.topClients.length > 0 && (
                <div style={{ 
                  background: colors.white,
                  borderRadius: 8, 
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  border: `1px solid ${colors.gray300}`,
                  borderLeft: `4px solid ${colors.danger}`
                }}>
                  <div style={{ fontSize: 10, color: '#90A4AE', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Top Client
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.danger, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stats.topClients[0].name}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No client selected message */}
          {(!selectedClient || selectedClient === '') && (
            <div style={{
              padding: '32px 24px',
              textAlign: 'center',
              background: colors.gray100,
              borderTop: `1px solid ${colors.gray300}`
            }}>
              <div style={{ fontSize: 16, color: '#90A4AE', fontWeight: 600 }}>
                ⚠️ Select a client to view orders and analytics
              </div>
            </div>
          )}
        </div>



        {showEditForm && (
          <div style={modalStyle} onClick={() => { setShowEditForm(false); }}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <div style={{
                marginBottom: 24,
                border: `1px solid ${colors.primary}`,
                background: colors.accent,
                borderRadius: 8,
                padding: 24,
              }}>
                <h2 style={{ color: colors.primary, marginBottom: 12 }}>Edit Finished Work Order</h2>
                {editWorkOrder && (
                  <>
                    <div style={{ marginBottom: 12, fontWeight: 'bold', color: colors.primary }}>
                      ID: {editWorkOrder.id} | ID CLASSIC: {editWorkOrder.idClassic}
                    </div>
                    <WorkOrderForm
                      workOrder={editWorkOrder}
                      onChange={handleWorkOrderChange}
                      onPartChange={handlePartChange}
                      onSubmit={handleEditWorkOrderSubmit}
                      onCancel={() => { setShowEditForm(false); setEditWorkOrder(null); }}
                      title="Edit Finished Work Order"
                      billToCoOptions={billToCoOptions}
                      getTrailerOptions={getTrailerOptions}
                      inventory={inventory}
                      onAddEmptyPart={addEmptyPart}
                      onDeletePart={deletePart}
                      loading={loading}
                      setLoading={setLoading}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Work Orders Cards View */}
        {selectedClient && selectedClient !== '' && filteredOrders.length > 0 &&
          (<div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
            marginBottom: 24
          }}>
            {filteredOrders
              .slice()
              .sort((a, b) => (new Date(b.date).getTime()) - (new Date(a.date).getTime()))
              .map((order) => {
                const dateStr = (order.date || '').slice(0, 10);
                const [yyyy, mm, dd] = dateStr.split('-');
                const displayDate = mm && dd && yyyy ? `${mm}/${dd}/${yyyy}` : '';
                const isSelected = selectedRow === order.id;

                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      setSelectedRow(order.id);
                      openFinishedWorkOrderDetail(order);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedRow(order.id);
                      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, order });
                    }}
                    style={{
                      background: isSelected ? colors.accent : colors.white,
                      borderRadius: 12,
                      padding: 16,
                      border: `2px solid ${isSelected ? colors.primary : colors.gray300}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(10,56,84,0.15)' : '0 2px 8px rgba(0,0,0,0.08)',
                      position: 'relative'
                    }}
                  >
                    {/* Header con ID */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${colors.gray300}` }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: colors.primary }}>W.O #{order.id}</div>
                        <div style={{ fontSize: 12, color: colors.gray600, marginTop: 2 }}>ID: {order.idClassic || 'N/A'}</div>
                      </div>
                      <div style={{ 
                        background: colors.success, 
                        color: colors.white, 
                        padding: '4px 10px', 
                        borderRadius: 6, 
                        fontSize: 11, 
                        fontWeight: 700 
                      }}>
                        FINISHED
                      </div>
                    </div>

                    {/* Info Principal */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: colors.gray600, fontWeight: 600, width: 60 }}>Client:</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: colors.gray700 }}>{order.billToCo || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: colors.gray600, fontWeight: 600, width: 60 }}>Trailer:</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: colors.gray700 }}>{order.trailer || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: colors.gray600, fontWeight: 600, width: 60 }}>Date:</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>{displayDate}</span>
                      </div>
                    </div>

                    {/*Description Preview */}
                    <div style={{ 
                      fontSize: 11, 
                      color: colors.gray600, 
                      background: colors.gray100, 
                      padding: '8px 10px', 
                      borderRadius: 6, 
                      marginBottom: 12,
                      minHeight: 40,
                      maxHeight: 60,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {(order.description || 'No description').slice(0, 100)}{(order.description || '').length > 100 ? '...' : ''}
                    </div>

                    {/* Footer con Total */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      paddingTop: 12,
                      borderTop: `1px solid ${colors.gray300}`
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: colors.gray600, fontWeight: 600 }}>Total HRS</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.gray700 }}>{order.totalHrs || 0} h</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: colors.gray600, fontWeight: 600 }}>Total Amount</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: colors.success }}>
                          {order.totalLabAndParts !== undefined && order.totalLabAndParts !== null
                            ? Number(order.totalLabAndParts).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                            : '$0.00'}
                        </div>
                      </div>
                    </div>

                    {/* Mechanic Info */}
                    <div style={{ marginTop: 8, fontSize: 10, color: colors.gray600, textAlign: 'center' }}>
                      👤 {Array.isArray(order.mechanics) && order.mechanics.length > 0
                        ? order.mechanics.map((m: any) => m.name).join(', ')
                        : order.mechanic || 'N/A'}
                    </div>
                  </div>
                );
              })
            }
          </div>)
        }
      </div>

      {/* Detail Modal */}
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
        const miscPercentRaw = detailOrder.miscellaneous ?? detailOrder.miscellaneousPercent;
        const miscPercent = Number(miscPercentRaw);
        const miscPercentValue = Number.isFinite(miscPercent) && miscPercent > 0 ? miscPercent : 0;
        const weldPercent = Number(detailOrder.weldPercent);
        const weldPercentValue = Number.isFinite(weldPercent) && weldPercent > 0 ? weldPercent : 0;
        const miscAmount = (laborSubtotal + partsSubtotal) * (miscPercentValue / 100);
        const weldAmount = (laborSubtotal + partsSubtotal) * (weldPercentValue / 100);
        const calculatedTotal = laborSubtotal + partsSubtotal + miscAmount + weldAmount;
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
          <div style={{ ...modalContentStyle, maxWidth: 750, width: '90vw' }} onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: colors.primary }}>
                W.O #{detailOrder.id} {detailOrder.idClassic ? `• ${detailOrder.idClassic}` : ''}
              </h2>
              <button
                onClick={() => setDetailOrder(null)}
                style={{ border: 'none', background: colors.gray200, color: colors.gray700, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 12, marginBottom: 8 }}>
              <div>
                <strong style={{ fontSize: 14 }}>Status:</strong>{' '}
                <span style={{ 
                  color: colors.success, 
                  fontWeight: 700,
                  fontSize: 16,
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  FINISHED
                </span>
              </div>
              <div><strong>Bill To:</strong> {detailOrder.billToCo || 'N/A'}</div>
              <div><strong>Trailer:</strong> {detailOrder.trailer || 'N/A'}</div>
              <div><strong>Start Date:</strong> {formatDateSafely(detailOrder.date || '')}</div>
              <div><strong>End Date:</strong> {detailOrder.endDate ? formatDateSafely(detailOrder.endDate) : 'N/A'}</div>
              <div><strong>Mechanic:</strong> {detailMechanics.length > 0
                ? detailMechanics.map((mechanic: any) => mechanic.name).join(', ')
                : (detailOrder.mechanic || 'N/A')}</div>
              <div><strong style={{ fontSize: 14 }}>Total HRS:</strong> {totalHrsValue.toFixed(2)}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong>Description:</strong>
              <div style={{ marginTop: 6, background: colors.gray100, border: `1px solid ${colors.gray300}`, borderRadius: 8, padding: 10, whiteSpace: 'pre-line' }}>
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
                      <th>Purchase Link</th>
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
                            <td>
                              {part.invoiceLink || part.invoice_link ? (
                                <a 
                                  href={part.invoiceLink || part.invoice_link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ 
                                    color: colors.primary, 
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    fontSize: 11
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  🔗 View
                                </a>
                              ) : (
                                <span style={{ color: '#999', fontSize: 11 }}>N/A</span>
                              )}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={6}>No parts registered</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <strong>Hours Logged:</strong>
              <div style={{ marginTop: 6, background: colors.gray100, border: `1px solid ${colors.gray300}`, borderRadius: 8, padding: 10 }}>
                {detailMechanics.length > 0 ? (
                  detailMechanics.map((mechanic: any, index: number) => (
                    <div key={`hrs-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingBottom: 6, borderBottom: index < detailMechanics.length - 1 ? `1px solid ${colors.gray300}` : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: colors.gray700 }}>
                          {mechanic?.name || `Mechanic ${index + 1}`}
                        </div>
                        {mechanic?.date && (
                          <div style={{ fontSize: 11, color: colors.gray600, marginTop: 2 }}>
                            📅 {formatDateSafely(mechanic.date)}
                          </div>
                        )}
                      </div>
                      <strong style={{ fontSize: 14, color: colors.primary }}>{(Number(mechanic?.hrs) || 0).toFixed(2)} h</strong>
                    </div>
                  ))
                ) : (
                  <div>No individual mechanic hours recorded.</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <strong>Totals Breakdown:</strong>
              <div style={{ marginTop: 6, background: colors.gray100, border: `1px solid ${colors.gray300}`, borderRadius: 8, padding: 10 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${colors.gray300}`, paddingTop: 6, marginTop: 6 }}>
                  <span><strong>Total Calculated</strong></span>
                  <strong>{calculatedTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: colors.success, fontSize: 18 }}>
                Total W.O: {finalTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </strong>
              <button
                style={secondaryBtn}
                onClick={() => handleViewPDF(detailOrder.id)}
              >
                📄 Ver PDF
              </button>
            </div>
          </div>
        </div>
      )})()}

      {contextMenu.visible && contextMenu.order && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: colors.white,
            border: `1px solid ${colors.gray300}`,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
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
            style={{ background: colors.primary, color: colors.white, fontWeight: 700, fontSize: 13, padding: '12px 0', border: 'none', borderBottom: `1px solid ${colors.gray300}`, cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={async () => {
              const pwd = window.prompt('Enter password (Level 3):');
              if (pwd === '6214') {
                handleEdit();
              } else if (pwd !== null) {
                alert('Incorrect password');
              }
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            ✏️ Edit
          </button>
          <button
            style={{ background: colors.danger, color: colors.white, fontWeight: 700, fontSize: 13, padding: '12px 0', border: 'none', borderBottom: `1px solid ${colors.gray300}`, cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => {
              handleDelete(contextMenu.order.id);
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            🗑️ Delete
          </button>
          <button
            style={{ background: colors.primaryDark, color: colors.white, fontWeight: 700, fontSize: 13, padding: '12px 0', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => {
              setContextMenu({ ...contextMenu, visible: false });
              handleViewPDF(contextMenu.order.id);
            }}
          >
            📄 View PDF
          </button>
        </div>
      )}

      {contextMenu.visible && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setContextMenu({ ...contextMenu, visible: false })}
        />
      )}

      {loading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ 
            color: colors.primary, 
            fontWeight: 700, 
            fontSize: 18,
            background: colors.white,
            padding: '24px 32px',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }}>
            ⏳ Processing...
          </div>
        </div>
      )}
    </>
  );
};

export default FinishedWorkOrdersTable;
