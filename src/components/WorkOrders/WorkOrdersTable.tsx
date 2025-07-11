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
import { generateWorkOrderPDF, openInvoiceLinks, downloadPDF, savePDFToDatabase } from '../../utils/pdfGenerator';
dayjs.extend(isBetween);
dayjs.extend(weekOfYear);

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

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
  if (
    order.totalLabAndParts !== undefined &&
    order.totalLabAndParts !== null &&
    order.totalLabAndParts !== ''
  ) {
    return Number(String(order.totalLabAndParts).replace(/[^0-9.]/g, ''));
  }
  // Suma el total de partes
  const partsTotal = order.parts?.reduce((sum: number, part: any) => {
    const qty = Number(part.qty);
    const cost = Number(part.cost?.toString().replace(/[^0-9.]/g, ''));
    return sum + (isNaN(qty) || isNaN(cost) ? 0 : qty * cost);
  }, 0) || 0;

  // Suma las horas de todos los mecánicos
  let laborHrs = 0;
  if (Array.isArray(order.mechanics) && order.mechanics.length > 0) {
    laborHrs = order.mechanics.reduce((sum: number, m: any) => sum + (parseFloat(m.hrs) || 0), 0);
  } else if (order.totalHrs) {
    laborHrs = parseFloat(order.totalHrs) || 0;
  }
  const laborTotal = laborHrs * 60;

  const subtotal = partsTotal + laborTotal;

  // Suma extras
  let extra = 0;
  (order.extraOptions || []).forEach((opt: string) => {
    if (opt === '5') extra += subtotal * 0.05;
    if (opt === '15shop') extra += subtotal * 0.15;
    if (opt === '15weld') extra += subtotal * 0.15;
  });

  return subtotal + extra;
}

const WorkOrdersTable: React.FC = () => {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [pendingParts, setPendingParts] = useState<any[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [editWorkOrder, setEditWorkOrder] = useState<any | null>(null);
  const [editError, setEditError] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newWorkOrder, setNewWorkOrder, resetNewWorkOrder] = useNewWorkOrder();
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [idClassicFilter, setIdClassicFilter] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedPendingParts, setSelectedPendingParts] = useState<number[]>([]);
  const [trailersWithPendingParts, setTrailersWithPendingParts] = useState<string[]>([]);
  const [pendingPartsQty, setPendingPartsQty] = useState<{ [id: number]: string }>({});
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [extraOptions, setExtraOptions] = React.useState<string[]>([]);  const [tooltip, setTooltip] = useState<{ visible: boolean, x: number, y: number, info: any }>({ visible: false, x: 0, y: 0, info: null });
  const [showHourmeter, setShowHourmeter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'waking' | 'offline'>('online');  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [idClassicError, setIdClassicError] = useState('');
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

  // Función para cargar las órdenes con manejo inteligente de errores
  const fetchWorkOrders = useCallback(async (isRetry = false) => {
    try {      setFetchingData(true);
      const res = await axios.get(`${API_URL}/work-orders`, { timeout: 15000 });
      const fetchedOrders = Array.isArray(res.data) ? (res.data as any[]) : [];
      console.log('✅ Órdenes actualizadas:', fetchedOrders.length);
      
      // Log para debugging del problema de totalHrs
      if (fetchedOrders.length > 0) {
        console.log('🔍 Primer orden después de fetch:', {
          id: fetchedOrders[0].id,
          totalHrs: fetchedOrders[0].totalHrs,
          totalLabAndParts: fetchedOrders[0].totalLabAndParts
        });
      }
      
      setWorkOrders(fetchedOrders);
      setServerStatus('online');
      setRetryCount(0); // Reset retry count on success
    } catch (err: any) {
      console.error('Error cargando órdenes:', err);
      
      // Si es un error 502/503 (servidor dormido) y no hemos excedido reintentos
      if ((err?.response?.status === 502 || err?.response?.status === 503 || err.code === 'ECONNABORTED') && retryCount < maxRetries) {
        if (!isRetry) {
          setServerStatus('waking');
          console.log(`Servidor dormido, intento ${retryCount + 1}/${maxRetries} de reactivación...`);
          
          // Usar el servicio keepAlive para intentar despertar el servidor
          try {
            const pingSuccess = await keepAliveService.manualPing();
            if (pingSuccess) {
              console.log('Keep-alive ping exitoso, servidor despertando...');
            }
          } catch (keepAliveError) {
            console.log('Keep-alive ping falló, server might be cold starting...');
          }
          
          setRetryCount(prev => prev + 1);
          // Reintentar con backoff exponencial (más agresivo para despertar el servidor)
          setTimeout(() => {
            fetchWorkOrders(true);
          }, Math.min(8000 * Math.pow(1.5, retryCount), 25000));
        }
      } else {
        setServerStatus('offline');
        if (retryCount >= maxRetries) {
          console.error('Max reintentos alcanzados, servidor no responde');        }
      }
    } finally {
      setFetchingData(false);
    }
  }, [retryCount]);
  // Polling inteligente - ajusta frecuencia según estado del servidor
  useEffect(() => {
    fetchWorkOrders();
    
    let interval: NodeJS.Timeout;
    
    if (serverStatus === 'online') {
      // Servidor online: polling normal cada 30 segundos
      interval = setInterval(() => fetchWorkOrders(), 30000);
    } else if (serverStatus === 'waking') {
      // Servidor despertando: polling más frecuente cada 15 segundos
      interval = setInterval(() => fetchWorkOrders(), 15000);
    }
    // Si está offline, no hacer polling automático
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchWorkOrders, serverStatus]);
  
  // Functions removed - handleFormSuccess and findPartBySku were unused
    // Función para cargar inventario con reintentos inteligentes
  const fetchInventory = useCallback(async () => {
    try {
      console.log('🔄 Cargando inventario...');
      const res = await axios.get(`${API_URL}/inventory`, { timeout: 15000 });
      const inventoryData = Array.isArray(res.data) ? res.data : [];
      setInventory(inventoryData);
      console.log('✅ Inventario cargado:', inventoryData.length, 'items');
      console.log('📋 Primeros 3 items del inventario:', inventoryData.slice(0, 3));
      console.log('📋 Campos disponibles en inventory[0]:', inventoryData[0] ? Object.keys(inventoryData[0]) : 'N/A');
      // Verificar que tenemos campos de precio
      const withPrice = inventoryData.filter(item => item.precio || item.cost || item.price).length;
      console.log(`💰 Items con precio: ${withPrice}/${inventoryData.length}`);
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
          const receives = res.data as { destino_trailer?: string }[];
          console.log('📦 Receives PENDING cargados:', receives.length, 'registros');
          console.log('📦 Primeros 3 receives:', receives.slice(0, 3));
          
          const trailers = Array.from(
            new Set(
              receives
                .map(r => r.destino_trailer)
                .filter((t): t is string => !!t)
            )
          );
          console.log('🚛 Trailers con partes pendientes encontrados:', trailers);
          setTrailersWithPendingParts(trailers);
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
  
  useEffect(() => {
    if (showForm && newWorkOrder.trailer) {
      console.log('� Cargando partes pendientes para trailer:', newWorkOrder.trailer);
      fetchPendingParts(newWorkOrder.trailer);
    } else {
      console.log('🔄 Limpiando partes pendientes (sin trailer o formulario cerrado)');
      setPendingParts([]);
    }
  }, [showForm, newWorkOrder.trailer]);

  const filteredOrders = workOrders.filter(order => {
    if (!order.date) return false;

    // Si no hay filtro de semana, no filtra por semana
    let inWeek = true;
    if (selectedWeek) {
      const { start, end } = getWeekRange(selectedWeek);
      const orderDate = dayjs(order.date.slice(0, 10));
      inWeek = orderDate.isBetween(start, end, 'day', '[]');
    }

    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesDay = !selectedDay || order.date.slice(0, 10) === selectedDay;
    const matchesIdClassic = !idClassicFilter || (order.idClassic || '').toLowerCase().includes(idClassicFilter.toLowerCase());

    return inWeek && matchesStatus && matchesDay && matchesIdClassic;
  });

  // Cambios generales
  const handleWorkOrderChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any
  ) => {
    // Si es un evento (input, select, textarea)
    if (e && e.target) {
      const { name, value } = e.target;
      
      if (showForm) {
        const updatedWorkOrder = { ...newWorkOrder, [name]: value };
        setNewWorkOrder(updatedWorkOrder);
        
        // Validar ID Classic cuando cambia el ID Classic o el status
        if (name === 'idClassic' || name === 'status') {
          const idClassicValue = name === 'idClassic' ? value : updatedWorkOrder.idClassic;
          const statusValue = name === 'status' ? value : updatedWorkOrder.status;
          validateIdClassic(idClassicValue || '', statusValue);
        }
        
        if (name === 'trailer') fetchPendingParts(value);
      } else if (showEditForm && editWorkOrder) {
        const updatedEditWorkOrder = { ...editWorkOrder, [name]: value };
        setEditWorkOrder(updatedEditWorkOrder);
        
        // Validar ID Classic cuando cambia el ID Classic o el status
        if (name === 'idClassic' || name === 'status') {
          const idClassicValue = name === 'idClassic' ? value : updatedEditWorkOrder.idClassic;
          const statusValue = name === 'status' ? value : updatedEditWorkOrder.status;
          validateIdClassic(idClassicValue || '', statusValue);
        }
        
        if (name === 'trailer') fetchPendingParts(value);
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
  };// Cambios en partes con autocompletado
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
      // 4. Guarda la orden
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

      // NOTA: Ya no es necesario marcar partes pendientes manualmente porque
      // el sistema FIFO automáticamente las marca como USED cuando las dedujo
      console.log('✅ Sistema FIFO manejó automáticamente las partes pending');      // Muestra mensaje de éxito
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
          date: workOrderData.date ? new Date(workOrderData.date).toLocaleDateString('en-US') : 
                workOrderData.fecha ? new Date(workOrderData.fecha).toLocaleDateString('en-US') : '',
          mechanics: Array.isArray(workOrderData.mechanics) ? 
            workOrderData.mechanics.map((m: any) => `${m.name} (${m.hrs}h)`).join(', ') :
            workOrderData.mechanics || workOrderData.mechanic || '',          description: workOrderData.description || '',
          parts: enrichedParts.map((part: any) => ({
            sku: part.sku || '',
            description: part.part_name || part.sku || 'N/A',
            um: 'EA',
            qty: Number(part.qty_used) || 0,
            unitCost: Number(part.cost) || 0,
            total: (Number(part.qty_used) || 0) * (Number(part.cost) || 0),
            invoice: part.invoice_number || 'N/A',
            invoiceLink: part.invoiceLink  // Usar el campo correcto de la BD
          })),
          laborCost: Number(workOrderData.totalHrs || 0) * 60 || 0,
          subtotalParts: enrichedParts.reduce((sum: number, part: any) => 
            sum + ((Number(part.qty_used) || 0) * (Number(part.cost) || 0)), 0),
          totalCost: Number(workOrderData.totalLabAndParts) || 0
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
        
        // Descargar PDF
        downloadPDF(pdf, `work_order_${pdfData.idClassic}.pdf`);
        
        // Abrir enlaces de facturas automáticamente
        openInvoiceLinks(pdfData.parts);
        
        console.log('✅ PDF generado y enlaces de facturas abiertos');
      } catch (pdfError: any) {
        console.error('❌ Error generando PDF:', pdfError);
        console.error('❌ Detalles del error:', {
          message: pdfError.message,
          response: pdfError.response?.data,
          status: pdfError.response?.status
        });
        
        // Crear PDF básico con los datos que tenemos
        try {
          const basicPdfData = {
            id: newWorkOrderId,
            idClassic: newWorkOrderId.toString(),
            customer: datosOrden.billToCo || '',
            trailer: datosOrden.trailer || '',
            date: datosOrden.date || new Date().toLocaleDateString('en-US'),
            mechanics: Array.isArray(datosOrden.mechanics) ? 
              datosOrden.mechanics.map((m: any) => `${m.name} (${m.hrs}h)`).join(', ') : '',
            description: datosOrden.description || '',
            parts: datosOrden.parts.map((part: any) => ({
              sku: part.sku || '',
              description: part.part || 'N/A',
              um: 'EA',
              qty: Number(part.qty) || 0,
              unitCost: Number(part.cost) || 0,
              total: (Number(part.qty) || 0) * (Number(part.cost) || 0),
              invoice: 'N/A',
              invoiceLink: undefined
            })),
            laborCost: Number(datosOrden.totalHrs || 0) * 60 || 0,
            subtotalParts: datosOrden.parts.reduce((sum: number, part: any) => 
              sum + ((Number(part.qty) || 0) * (Number(part.cost) || 0)), 0),
            totalCost: Number(datosOrden.totalLabAndParts) || 0
          };
          
          const pdf = await generateWorkOrderPDF(basicPdfData);
          downloadPDF(pdf, `work_order_${newWorkOrderId}_basic.pdf`);
          console.log('✅ PDF básico generado como fallback');
        } catch (fallbackError) {
          console.error('❌ Error generando PDF básico:', fallbackError);
        }
      }

      if (data.pdfUrl) {
        window.open(`${API_URL}${data.pdfUrl}`, '_blank', 'noopener,noreferrer');
      }
        // Cierra el formulario y resetea COMPLETAMENTE
      setShowForm(false);
      resetNewWorkOrder();
      setExtraOptions([]);
      setPendingPartsQty({});
      setSelectedPendingParts([]);
      
      // Actualiza la tabla inmediatamente
      await fetchWorkOrders();
      
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

  // Calcula el total cada vez que cambian las partes o las horas
  useEffect(() => {
    if (showForm) {
      const totalHrs = parseFloat(newWorkOrder.totalHrs) || 0;
      const partsCost = newWorkOrder.parts.reduce((sum: number, p: any) => sum + (parseFloat(p.cost) || 0), 0);
      const totalLabAndParts = (totalHrs * 60) + partsCost;
      setNewWorkOrder(prev => ({
        ...prev,
        totalLabAndParts: totalLabAndParts ? totalLabAndParts.toFixed(2) : ''
      }));
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
    setPendingParts(prevPending => 
      prevPending.map(pp => 
        pp.id === pendingPart.id 
          ? { ...pp, qty_remaining: pp.qty_remaining - qtyToUse }
          : pp
      ).filter(pp => pp.qty_remaining > 0) // Remover si no quedan unidades
    );
    
    console.log(`🎉 Parte ${pendingPart.sku} agregada exitosamente a la WO con costo $${cost.toFixed(2)}`);
  };
  // handlePartClick function removed - was unused

  // Función para ocultar el tooltip
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
  // Función para cargar trailers con partes pendientes
  const fetchTrailersWithPendingParts = async () => {
    try {
      console.log('🔍 Cargando trailers con partes pendientes...');
      const res = await axios.get(`${API_URL}/receive/trailers/with-pending`);
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
      
      // Priorizar campo 'mechanic' simple de la tabla
      if (finalWorkOrderData.mechanic && typeof finalWorkOrderData.mechanic === 'string') {
        mechanicsString = finalWorkOrderData.mechanic;
        // Intentar obtener horas del campo totalHrs
        totalHrs = Number(finalWorkOrderData.totalHrs) || 0;
        if (totalHrs > 0) {
          mechanicsString += ` (${totalHrs}h)`;
        }
        console.log('👷 Usando mechanic simple:', mechanicsString);
      } 
      // Si no hay mechanic simple, procesar array de mechanics
      else if (finalWorkOrderData.mechanics) {
        if (typeof finalWorkOrderData.mechanics === 'string') {
          try {
            const mechanicsArray = JSON.parse(finalWorkOrderData.mechanics);
            if (Array.isArray(mechanicsArray)) {
              mechanicsString = mechanicsArray.map((m: any) => {
                const hrs = Number(m.hrs) || 0;
                totalHrs += hrs;
                return typeof m === 'object' ? `${m.name || m.mechanic || 'Unknown'} (${hrs}h)` : String(m);
              }).join(', ');
            } else {
              mechanicsString = String(mechanicsArray);
            }
          } catch {
            mechanicsString = finalWorkOrderData.mechanics;
          }
        } else if (Array.isArray(finalWorkOrderData.mechanics)) {
          mechanicsString = finalWorkOrderData.mechanics.map((m: any) => {
            const hrs = Number(m.hrs) || 0;
            totalHrs += hrs;
            return typeof m === 'object' ? `${m.name || m.mechanic || 'Unknown'} (${hrs}h)` : String(m);
          }).join(', ');
        } else {
          mechanicsString = String(finalWorkOrderData.mechanics);
        }
        console.log('👷 Usando mechanics array:', mechanicsString, 'Total hrs:', totalHrs);
      }
      
      // Si aún no hay horas, usar totalHrs del objeto
      if (totalHrs === 0) {
        totalHrs = Number(finalWorkOrderData.totalHrs) || 0;
      }
      
      // 7. Procesar fecha correctamente
      let formattedDate = '';
      if (finalWorkOrderData.date) {
        try {
          // Si la fecha tiene formato ISO o similar, convertirla
          const dateObj = new Date(finalWorkOrderData.date);
          if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toLocaleDateString('en-US');
          } else {
            // Si no se puede parsear, usar string original
            formattedDate = String(finalWorkOrderData.date).slice(0, 10);
          }
        } catch {
          formattedDate = String(finalWorkOrderData.date).slice(0, 10);
        }
      }
      console.log('📅 Fecha procesada:', formattedDate);
      
      // 8. Calcular totales
      const subtotalParts = enrichedParts.reduce((sum: number, part: any) => 
        sum + ((Number(part.qty_used) || 0) * (Number(part.cost) || 0)), 0);
      
      const laborCost = totalHrs * 60; // $60 por hora
      
      const totalCost = Number(finalWorkOrderData.totalLabAndParts) || (laborCost + subtotalParts);
      
      // 9. Preparar datos para el PDF con todos los datos correctos
      const pdfData = {
        id: finalWorkOrderData.id || workOrderId,
        idClassic: finalWorkOrderData.idClassic || finalWorkOrderData.id?.toString() || workOrderId.toString(),
        customer: finalWorkOrderData.billToCo || finalWorkOrderData.customer || '',
        trailer: finalWorkOrderData.trailer || '',
        date: formattedDate,
        mechanics: mechanicsString || '',
        description: finalWorkOrderData.description || '',
        parts: enrichedParts.map((part: any) => ({
          sku: part.sku || '',
          description: part.part_name || part.sku || 'N/A',
          um: 'EA',
          qty: Number(part.qty_used) || 0,
          unitCost: Number(part.cost) || 0,
          total: (Number(part.qty_used) || 0) * (Number(part.cost) || 0),
          invoice: part.invoice_number || 'N/A',
          invoiceLink: part.invoiceLink
        })),
        laborCost: laborCost,
        subtotalParts: subtotalParts,
        totalCost: totalCost
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
      
      // 11. Descargar PDF
      downloadPDF(pdf, `work_order_${pdfData.idClassic}_view.pdf`);
      
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
  };

  return (
    <>      <style>
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
          }            .wo-table {
            border-collapse: collapse;
            width: 100%;
            min-width: 1750px;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(25,118,210,0.07);
            font-size: 11px;
          }.wo-table th, .wo-table td {
            border: 1px solid #d0d7e2;
            padding: 2px 4px;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
          }          .wo-table th:nth-child(1), .wo-table td:nth-child(1) { width: 45px; } /* ID */
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
          .wo-row-approved {
            background: #43a047 !important; /* Verde fuerte */
            color: #fff !important;
          }
          .wo-row-finished {
            background: #ffd600 !important; /* Amarillo fuerte */
            color: #333 !important;
          }          .wo-row-processing {
            background: #fff !important; /* Blanco */
            color: #1976d2 !important;
          }
          .wo-row-selected {
            outline: 2px solid #1976d2 !important;
            box-shadow: 0 0 0 2px #1976d233;
          }
        `}
      </style>
      <div
        style={{          padding: '32px',
          background: 'linear-gradient(90deg, #e3f2fd 0%, #ffffff 100%)',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(25, 118, 210, 0.10)',
          maxWidth: 1800,
          margin: '32px auto'
        }}
      >        <div className="wo-header">
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
    }}
  >
    Work Orders
  </span>
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
              {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label className="wo-filter-label">
            Filter by ID CLASSIC:&nbsp;
            <input
              type="text"
              value={idClassicFilter}
              onChange={e => setIdClassicFilter(e.target.value)}
              className="wo-filter-input"
              style={{ minWidth: 160 }}
              placeholder="ID Classic"
            />
          </label>
        </div>        {/* --- BOTONES ARRIBA --- */}
        <div style={{ margin: '24px 0 16px 0' }}>
          <button
            className="wo-btn"
            style={primaryBtn}
            onClick={() => {
              // RESETEAR COMPLETAMENTE EL FORMULARIO
              resetNewWorkOrder(); 
              setExtraOptions([]);
              setPendingPartsQty({});
              // También resetear cualquier selección de partes pendientes
              setSelectedPendingParts([]);
              // Limpiar el error del ID Classic
              setIdClassicError('');
              setShowForm(true);
            }}
          >
            New Work Order
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
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>              <WorkOrderForm
                workOrder={newWorkOrder}
                onChange={handleWorkOrderChange}
                onPartChange={handlePartChange}
                onSubmit={(data) => handleAddWorkOrder(data || newWorkOrder)}                onCancel={() => {
                  // RESETEAR TODO CUANDO SE CANCELA
                  resetNewWorkOrder();
                  setExtraOptions([]);
                  setPendingPartsQty({});
                  setSelectedPendingParts([]);
                  setIdClassicError('');
                  setShowForm(false);
                }}
                title="New Work Order"
                billToCoOptions={billToCoOptions}
                getTrailerOptions={(billToCo: string) => getTrailerOptionsWithPendingIndicator(billToCo, trailersWithPendingParts)}
                inventory={inventory}
                trailersWithPendingParts={trailersWithPendingParts}
                pendingParts={pendingParts}
                pendingPartsQty={pendingPartsQty}
                setPendingPartsQty={setPendingPartsQty}                onAddPendingPart={(part: any, qty: any) => {
                  addPendingPart(part, qty || part.qty || 1);
                }}                onAddEmptyPart={addEmptyPart}
                extraOptions={extraOptions}
                setExtraOptions={setExtraOptions}
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
                      onPartChange={handlePartChange}                      onSubmit={async () => {
                        try {
                          setLoading(true);
                          
                          // Validate ID Classic is required when status is FINISHED
                          if (editWorkOrder.status === 'FINISHED') {
                            if (!editWorkOrder.idClassic || editWorkOrder.idClassic.trim() === '') {
                              setIdClassicError('⚠️ ID Classic is required when status is FINISHED!');
                              alert('Error: ID Classic is required when status is FINISHED. Please enter an ID Classic.');
                              setLoading(false);
                              return;
                            }
                          }
                          
                          // Validate ID Classic doesn't already exist (if changed)
                          if (editWorkOrder.idClassic) {
                            const originalOrder = workOrders.find(wo => wo.id === editWorkOrder.id);
                            const isIdClassicChanged = originalOrder && 
                              originalOrder.idClassic !== editWorkOrder.idClassic;
                            
                            if (isIdClassicChanged) {
                              const existingOrder = workOrders.find(wo => 
                                wo.idClassic && 
                                wo.idClassic.toLowerCase() === editWorkOrder.idClassic.toLowerCase() &&
                                wo.id !== editWorkOrder.id
                              );
                              if (existingOrder) {
                                setIdClassicError(`⚠️ Work Order with ID Classic "${editWorkOrder.idClassic}" already exists!`);
                                alert(`Error: Work Order with ID Classic "${editWorkOrder.idClassic}" already exists. Please use a different ID.`);
                                setLoading(false);
                                return;
                              }
                            }
                          }
                          
                          // Calcular horas totales automáticamente sumando las horas de todos los mecánicos
                          const calculateTotalHours = () => {
                            if (!editWorkOrder.mechanics || editWorkOrder.mechanics.length === 0) return 0;
                            return editWorkOrder.mechanics.reduce((total: number, mechanic: any) => {
                              return total + (parseFloat(mechanic.hrs) || 0);
                            }, 0);
                          };

                          const totalHoursCalculated = calculateTotalHours();
                          
                          // LIMPIA EL TOTAL ANTES DE ENVIAR
                          const totalLabAndPartsLimpio = Number(String(editWorkOrder.totalLabAndParts).replace(/[^0-9.]/g, ''));
                          
                          // Preparar datos para enviar
                          const dataToSend = {
                            ...editWorkOrder,
                            totalHrs: totalHoursCalculated.toString(), // Usar las horas calculadas automáticamente
                            totalLabAndParts: totalLabAndPartsLimpio,
                            manualTotalEdit: true,
                            date: editWorkOrder.date ? editWorkOrder.date.slice(0, 10) : '',
                            parts: editWorkOrder.parts,
                            usuario: localStorage.getItem('username') || '',
                            extraOptions,
                          };
                          
                          console.log('🔧 Enviando datos de WO editada:', {
                            id: editWorkOrder.id,
                            totalHrs: dataToSend.totalHrs,
                            mechanics: editWorkOrder.mechanics,
                            totalLabAndParts: dataToSend.totalLabAndParts
                          });

                          // Actualizar la work order
                          await axios.put(`${API_URL}/work-orders/${editWorkOrder.id}`, dataToSend);

                          // MARCA PARTES PENDIENTES COMO USADAS (si se agregaron nuevas partes pendientes)
                          const partesConPendingId = editWorkOrder.parts.filter((p: any) => p._pendingPartId);
                          for (const part of partesConPendingId) {
                            try {
                              await axios.put(`${API_URL}/receive/${part._pendingPartId}/mark-used`, {
                                usuario: localStorage.getItem('username') || ''
                              });
                              console.log(`✅ Parte pendiente ${part._pendingPartId} marcada como USED en edición`);
                            } catch (error) {
                              console.error(`❌ Error marcando parte pendiente ${part._pendingPartId} como USED en edición:`, error);
                            }
                          }
                            // Generar nuevo PDF tras la edición
                          try {

                            console.log('Generando nuevo PDF para Work Order editada...');
                            
                            // NUEVA FUNCIONALIDAD: Generar PDF y abrir enlaces de facturas                            // Obtener datos completos de la orden editada
                            const workOrderRes = await axios.get(`${API_URL}/work-orders/${editWorkOrder.id}`);
                            const workOrderData = workOrderRes.data as any;
                            
                            // Obtener partes usadas con sus enlaces de facturas
                            const partsRes = await axios.get(`${API_URL}/work-order-parts/${editWorkOrder.id}`);
                            const partsWithInvoices = partsRes.data as any[];
                              // Preparar datos para el PDF
                            const pdfData = {
                              id: workOrderData.id,
                              idClassic: workOrderData.idClassic || workOrderData.id.toString(),
                              customer: workOrderData.customer || '',
                              trailer: workOrderData.trailer || '',
                              date: workOrderData.fecha ? new Date(workOrderData.fecha).toLocaleDateString('en-US') : '',
                              mechanics: workOrderData.mechanics || '',
                              description: workOrderData.description || '',
                              parts: partsWithInvoices.map((part: any) => ({
                                sku: part.sku,
                                description: part.part_name || part.sku,
                                um: 'EA',
                                qty: part.qty_used,
                                unitCost: part.cost || 0,
                                total: (part.qty_used || 0) * (part.cost || 0),
                                invoice: part.invoice_number || 'N/A',
                                invoiceLink: part.invoice_link
                              })),
                              laborCost: Number(workOrderData.laborCost) || 0,
                              subtotalParts: Number(workOrderData.subtotalParts) || 0,
                              totalCost: Number(workOrderData.totalLabAndParts) || 0
                            };
                              // Generar PDF
                            const pdf = await generateWorkOrderPDF(pdfData);
                            
                            // Generar blob para guardar en BD
                            const pdfBlob = pdf.output('blob');
                            
                            // Guardar PDF en la base de datos
                            try {
                              await savePDFToDatabase(editWorkOrder.id, pdfBlob);
                              console.log('✅ PDF guardado en BD correctamente tras edición');
                            } catch (dbError) {
                              console.warn('⚠️ No se pudo guardar PDF en BD tras edición:', dbError);
                            }
                            
                            // Descargar PDF
                            downloadPDF(pdf, `work_order_${workOrderData.idClassic || editWorkOrder.id}.pdf`);
                            
                            // Abrir enlaces de facturas automáticamente
                            openInvoiceLinks(pdfData.parts);
                            
                            console.log('✅ PDF generado y enlaces de facturas abiertos tras edición');
                            
                            // Mantener el endpoint anterior para compatibilidad
                            await axios.post(`${API_URL}/work-orders/${editWorkOrder.id}/generate-pdf`);
                            console.log('PDF generado exitosamente tras edición');
                          } catch (pdfError) {
                            console.error('Error generando PDF tras edición:', pdfError);
                            // No interrumpir el flujo si falla el PDF
                          }// REFRESCA LA TABLA INMEDIATAMENTE CON AWAIT
                          console.log('📋 Refrescando tabla después de actualizar WO...');
                          await fetchWorkOrders();
                          console.log('✅ Tabla refrescada exitosamente');
                            // ACTUALIZA EL ESTADO LOCAL INMEDIATAMENTE PARA REFLEJAR LOS CAMBIOS
                          setWorkOrders(prevOrders => 
                            prevOrders.map(order => 
                              order.id === editWorkOrder.id 
                                ? { ...order, ...editWorkOrder, totalHrs: totalHoursCalculated.toString(), totalLabAndParts: totalLabAndPartsLimpio }
                                : order
                            )
                          );
                          
                          // CIERRA EL MODAL Y LIMPIA ESTADO DESPUÉS DE REFRESCAR
                          setShowEditForm(false);
                          setEditWorkOrder(null);
                          setEditId('');
                          setEditError('');
                          
                          alert('Order updated successfully and PDF regenerated.');
                        } catch (err) {
                          console.error('Error updating order:', err);
                          alert('Error updating order.');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      onCancel={() => { setShowEditForm(false); setEditWorkOrder(null); setEditId(''); setEditError(''); setIdClassicError(''); }}                      title="Edit Work Order"
                      billToCoOptions={billToCoOptions}
                      getTrailerOptions={(billToCo: string) => getTrailerOptionsWithPendingIndicator(billToCo, trailersWithPendingParts)}
                      inventory={inventory}
                      onAddEmptyPart={addEmptyPart}
                      onAddPendingPart={addPendingPart}
                      trailersWithPendingParts={trailersWithPendingParts}
                      pendingParts={pendingParts}
                      pendingPartsQty={pendingPartsQty}
                      setPendingPartsQty={setPendingPartsQty}
                      extraOptions={extraOptions}
                      setExtraOptions={setExtraOptions}
                      loading={loading}
                      setLoading={setLoading}
                      idClassicError={idClassicError}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TABLA ABAJO --- */}
        <div style={{ overflowX: 'auto' }}>
          <table className="wo-table">
            <thead>
              <tr>

                <th>ID</th>
                <th>ID CLASSIC</th>
                <th>Bill To Co</th>
                <th>Trailer</th>
                <th>Mechanic</th>
                <th>Date</th>
                <th>Description</th>
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
            <tbody>  {filteredOrders.map((order, index) => {
    let rowClass = '';
    if (order.status === 'APPROVED') rowClass = 'wo-row-approved';
    else if (order.status === 'FINISHED') rowClass = 'wo-row-finished';
    else if (order.status === 'PROCESSING') rowClass = 'wo-row-processing';

    const hasMoreParts = order.parts && order.parts.length > 5;

    const dateStr = (order.date || '').slice(0, 10); // '2025-05-29'
const [yyyy, mm, dd] = dateStr.split('-');
const displayDate = mm && dd && yyyy ? `${mm}/${dd}/${yyyy}` : '';

    return (
      <React.Fragment key={order.id}>
        <tr
          className={rowClass + (selectedRow === order.id ? ' wo-row-selected' : '')}
          style={{ fontWeight: 600, cursor: 'pointer' }}
          onClick={() => setSelectedRow(order.id)}
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
                  ? (
                      order.parts[i].cost !== undefined && order.parts[i].cost !== null && order.parts[i].cost !== ''
                        ? Number(order.parts[i].cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                        : '$0.00'
                    )
                  : ''
                }
              </td>
            </React.Fragment>
          ))}
          <td>{order.totalHrs}</td>
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
                  {order.parts.slice(5).map((p: any, idx: number) => (
                    <tr key={idx}>
                      <td>{idx + 6}</td>
                      <td>{p.sku}</td>
                      <td>{p.qty}</td>
                      <td>{p.cost}</td>
                    </tr>
                  ))}
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
        </div>       
      </div>
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