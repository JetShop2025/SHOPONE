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

      alert(`Work Order updated successfully. Total: ${dataToSend.totalLabAndParts}`);
    } catch (err) {
      alert('Error updating Work Order.');
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
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean, x: number, y: number, info: any }>({ visible: false, x: 0, y: 0, info: null });
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'waking' | 'offline'>('online');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [searchIdClassic, setSearchIdClassic] = useState('');
  const [currentPageData, setCurrentPageData] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, order: any | null }>({ visible: false, x: 0, y: 0, order: null });
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
    let interval: NodeJS.Timeout;
    if (serverStatus === 'online') {
      interval = setInterval(() => fetchWorkOrders(), 300000);
    } else if (serverStatus === 'waking') {
      interval = setInterval(() => fetchWorkOrders(), 120000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchWorkOrders, serverStatus]);

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

    let inWeek = true;
    if (selectedWeek) {
      const { start, end } = getWeekRange(selectedWeek);
      const orderDate = dayjs(order.date.slice(0, 10));
      inWeek = orderDate.isBetween(start, end, 'day', '[]');
    }

    const matchesDay = !selectedDay || order.date.slice(0, 10) === selectedDay;

    return inWeek && matchesDay;
  });

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
    const pwd = window.prompt('Ingrese contraseña de edición (Level 3):');
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
      alert('Contraseña incorrecta');
    }
  };

  const handleDelete = async (id: number) => {
    if (id == null) return;
    const pwd = window.prompt('Ingrese contraseña para eliminar:');
    if (pwd === '6214') {
      if (window.confirm('¿Estás seguro de que deseas eliminar esta orden?')) {
        try {
          await axios.delete(`${API_URL}/work-orders/${id}`, {
            headers: { 'Content-Type': 'application/json' },
            data: { usuario: localStorage.getItem('username') || '' }
          } as any);
          setWorkOrders(workOrders.filter((order: any) => order.id !== id));
          setSelectedRow(null);
          alert('Orden eliminada exitosamente');
        } catch {
          alert('Error eliminando orden');
        }
      }
    } else if (pwd !== null) {
      alert('Contraseña incorrecta');
    }
  };

  const handleViewPDF = async (workOrderId: number) => {
    try {
      const workOrderFromTable = workOrders.find(wo => wo.id === workOrderId);
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
          invoiceLink: null,
          invoice_number: 'N/A'
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
          invoice: part.invoice_number,
          invoiceLink: part.invoiceLink
        })),
        totalHrs: totalHrs,
        laborRate: 60,
        laborCost: totalHrs * 60,
        subtotalParts: workOrderParts.reduce((sum, part) => sum + (part.qty_used * part.cost), 0),
        totalCost: Number(workOrderFromTable.totalLabAndParts) || 0,
        extraOptions: []
      };

      const pdf = await generateWorkOrderPDF(pdfData);
      openPDFInNewTab(pdf, `work_order_${pdfData.idClassic}_finished.pdf`);
    } catch (error: any) {
      console.error('Error visualizando PDF:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const hideTooltip = () => setTooltip({ visible: false, x: 0, y: 0, info: null });

  const handlePartHover = (e: React.MouseEvent, sku: string) => {
    const partInfo = inventory.find(i => i.sku === sku);
    if (partInfo) {
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        info: partInfo
      });
    }
  };

  const exportToExcel = () => {
    const data = filteredOrders.map(order => ({
      ID: order.id,
      'ID CLASSIC': order.idClassic || '',
      'Bill To Co': order.billToCo,
      Trailer: order.trailer,
      Mechanic: order.mechanic,
      Date: order.date?.slice(0, 10),
      Description: order.description,
      'Total HRS': order.totalHrs,
      'Total LAB & PRTS': calcularTotalWO(order),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FinishedWorkOrders');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'finished_work_orders.xlsx');
  };

  const normalizeWorkOrderForEdit = (workOrder: any) => {
    return {
      ...workOrder,
      date: workOrder?.date ? workOrder.date.slice(0, 10) : '',
      parts: Array.isArray(workOrder?.parts) ? workOrder.parts : [],
      mechanics: Array.isArray(workOrder?.mechanics) ? workOrder.mechanics : [],
    };
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
    background: '#fff',
    borderRadius: 16,
    padding: 32,
    minWidth: 400,
    maxWidth: 520,
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
  };

  return (
    <>
      <style>
        {`
          .wo-table {
            border-collapse: collapse;
            width: 100%;
            min-width: 1400px;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(25,118,210,0.07);
            font-size: 11px;
          }
          
          .wo-table th, .wo-table td {
            border: 1px solid #d0d7e2;
            padding: 6px 8px;
            font-size: 11px;
            text-align: center;
          }
          
          .wo-table th {
            background: #1976d2;
            color: #fff;
            font-weight: 700;
            font-size: 13px;
            position: sticky;
            top: 0;
            z-index: 10;
          }
          
          .wo-table tr:hover {
            background-color: #e3f2fd !important;
          }
          
          .wo-table tr.selected {
            background-color: #bbdefb !important;
          }
          
          .wo-row-finished {
            background: #ffd600 !important;
            color: #333 !important;
          }
          
          .error-text {
            color: #d32f2f;
            font-size: 12px;
            font-weight: 600;
            margin-top: 4px;
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
          onClick={hideTooltip}
        >
          <div style={{ fontWeight: 700, color: '#1976d2', marginBottom: 6 }}>Part Info</div>
          <div><b>Part Name:</b> {tooltip.info.part || 'N/A'}</div>
          <div><b>On Hand:</b> {tooltip.info.onHand || 'N/A'}</div>
          <div><b>U/M:</b> {tooltip.info.um || 'N/A'}</div>
          <div>
            <b>Precio:</b>{" "}
            {tooltip.info.precio
              ? Number(tooltip.info.precio).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
              : '$0.00'}
          </div>
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
      >
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
              letterSpacing: 2,
              textShadow: '1px 1px 0 #fff',
            }}
          >
            FINAL WORK ORDERS
          </span>
          <div style={{ marginLeft: 'auto', fontSize: 14, color: '#666', fontWeight: '500' }}>
            📋 Total: {filteredOrders.length} Órdenes Finalizadas
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 16, gap: 8 }}>
          <label style={{ fontWeight: 600 }}>
            Filtrar por semana:&nbsp;
            <input
              type="week"
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4 }}
            />
          </label>
          <label style={{ fontWeight: 600 }}>
            Filtrar por día:&nbsp;
            <input
              type="date"
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4 }}
            />
          </label>
        </div>

        <div style={{ margin: '24px 0 16px 0' }}>
          <button style={primaryBtn} onClick={handleEdit} disabled={selectedRow === null}>
            ✏️ Editar
          </button>
          <button style={dangerBtn} onClick={() => selectedRow !== null && handleDelete(selectedRow)} disabled={selectedRow === null}>
            🗑️ Eliminar
          </button>
          <button style={secondaryBtn} disabled={selectedRow === null} onClick={() => selectedRow !== null && handleViewPDF(selectedRow)}>
            📄 Ver PDF
          </button>
          <button style={secondaryBtn} onClick={exportToExcel}>
            📊 Exportar Excel
          </button>
        </div>

        {showEditForm && (
          <div style={modalStyle} onClick={() => { setShowEditForm(false); }}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <div style={{
                marginBottom: 24,
                border: '1px solid #ffd600',
                background: '#fffbe6',
                borderRadius: 8,
                padding: 24,
              }}>
                <h2 style={{ color: '#ffd600', marginBottom: 12 }}>Editar Orden Finalizada</h2>
                {editWorkOrder && (
                  <>
                    <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#1976d2' }}>
                      ID: {editWorkOrder.id} | ID CLASSIC: {editWorkOrder.idClassic}
                    </div>
                    <WorkOrderForm
                      workOrder={editWorkOrder}
                      onChange={handleWorkOrderChange}
                      onPartChange={handlePartChange}
                      onSubmit={handleEditWorkOrderSubmit}
                      onCancel={() => { setShowEditForm(false); setEditWorkOrder(null); }}
                      title="Editar Work Order Finalizada"
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

        <div style={{ overflowX: 'auto', marginTop: 24 }}>
          <table className="wo-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>ID CLASSIC</th>
                <th>Bill To Co</th>
                <th>Trailer</th>
                <th>Mechanic</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Total HRS</th>
                <th>Total LAB & PRTS</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders
                .slice()
                .sort((a, b) => (new Date(b.date).getTime()) - (new Date(a.date).getTime()))
                .map((order) => {
                  const dateStr = (order.date || '').slice(0, 10);
                  const [yyyy, mm, dd] = dateStr.split('-');
                  const displayDate = mm && dd && yyyy ? `${mm}/${dd}/${yyyy}` : '';

                  return (
                    <tr
                      key={order.id}
                      className={'wo-row-finished' + (selectedRow === order.id ? ' selected' : '')}
                      style={{ cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setSelectedRow(order.id)}
                      onContextMenu={e => {
                        e.preventDefault();
                        setSelectedRow(order.id);
                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, order });
                      }}
                    >
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
                      <td style={{ maxWidth: 250, whiteSpace: 'pre-wrap' }}>{order.description}</td>
                      <td>{order.totalHrs}</td>
                      <td>
                        {order.totalLabAndParts !== undefined && order.totalLabAndParts !== null
                          ? Number(order.totalLabAndParts).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                          : '$0.00'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {contextMenu.visible && contextMenu.order && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '2px solid #ffd600',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(255,193,7,0.18)',
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
            style={{ background: '#ffd600', color: '#333', fontWeight: 700, fontSize: 14, padding: '12px 0', border: 'none', borderBottom: '1px solid #eee', cursor: 'pointer' }}
            onClick={async () => {
              const pwd = window.prompt('Ingrese contraseña (Level 3):');
              if (pwd === '6214') {
                handleEdit();
              } else if (pwd !== null) {
                alert('Contraseña incorrecta');
              }
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            ✏️ Editar
          </button>
          <button
            style={{ background: '#d32f2f', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px 0', border: 'none', borderBottom: '1px solid #eee', cursor: 'pointer' }}
            onClick={() => {
              handleDelete(contextMenu.order.id);
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            🗑️ Eliminar
          </button>
          <button
            style={{ background: '#1976d2', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px 0', border: 'none', cursor: 'pointer' }}
            onClick={() => {
              setContextMenu({ ...contextMenu, visible: false });
              handleViewPDF(contextMenu.order.id);
            }}
          >
            📄 Ver PDF
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
          background: 'rgba(255,255,255,0.7)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ color: '#ffd600', fontWeight: 700, fontSize: 20 }}>
            Procesando...
          </div>
        </div>
      )}
    </>
  );
};

export default FinishedWorkOrdersTable;
