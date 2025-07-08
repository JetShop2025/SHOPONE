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
  const [serverStatus, setServerStatus] = useState<'online' | 'waking' | 'offline'>('online');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  // Función para cargar las órdenes con manejo inteligente de errores
  const fetchWorkOrders = useCallback(async (isRetry = false) => {
    try {
      setFetchingData(true);
      const res = await axios.get(`${API_URL}/work-orders`, { timeout: 15000 });      setWorkOrders(Array.isArray(res.data) ? (res.data as any[]) : []);
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
  
  useEffect(() => {
    console.log('🔄 Cargando inventario...');
    axios.get(`${API_URL}/inventory`)
      .then(res => {
        const inventoryData = Array.isArray(res.data) ? res.data : [];
        setInventory(inventoryData);
        console.log('✅ Inventario cargado:', inventoryData.length, 'items');
        console.log('📋 Primeros 3 items del inventario:', inventoryData.slice(0, 3));
        console.log('📋 Campos disponibles en inventory[0]:', inventoryData[0] ? Object.keys(inventoryData[0]) : 'N/A');
        // Verificar que tenemos campos de precio
        const withPrice = inventoryData.filter(item => item.precio || item.cost || item.price).length;
        console.log(`💰 Items con precio: ${withPrice}/${inventoryData.length}`);
      })
      .catch(err => {
        console.error('❌ Error cargando inventario:', err);
        setInventory([]);
      });
  }, []);
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
        setNewWorkOrder((prev: typeof newWorkOrder) => ({ ...prev, [name]: value }));
        if (name === 'trailer') fetchPendingParts(value);
      } else if (showEditForm && editWorkOrder) {
        setEditWorkOrder((prev: any) => ({ ...prev, [name]: value }));
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
  };  // Cambios en partes con autocompletado
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
        }
      }

      setEditWorkOrder((prev: any) => ({ ...prev, parts: updatedParts }));
    }
  };
  // Guardar nueva orden
  const handleAddWorkOrder = async (datosOrden: any) => {
    setLoading(true);
    try {
      // 1. Prepara las partes a descontar
      const partesUsadas = datosOrden.parts
        .filter((p: any) => p.sku && p.qty && Number(p.qty) > 0)
        .map((p: any) => ({
          sku: p.sku,
          qty: Number(p.qty)
        }));

      // 2. Descuenta del inventario
      if (partesUsadas.length > 0) {
        await axios.post(`${API_URL}/inventory/deduct`, {
          parts: partesUsadas,
          usuario: localStorage.getItem('username') || ''
        });
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
      const newWorkOrderId = data.id;      // REGISTRA PARTES USADAS EN work_order_parts
      for (const part of partesParaGuardar) {
        await axios.post(`${API_URL}/work-order-parts`, {
          work_order_id: newWorkOrderId,
          sku: part.sku,
          part_name: inventory.find(i => i.sku === part.sku)?.part || '',
          qty_used: part.qty,
          cost: Number(String(part.cost).replace(/[^0-9.]/g, '')), // <-- LIMPIA AQUÍ TAMBIÉN
          usuario: localStorage.getItem('username') || ''
        });
      }

      // MARCA PARTES PENDIENTES COMO USADAS
      const partesConPendingId = datosOrden.parts.filter((p: any) => p._pendingPartId);
      for (const part of partesConPendingId) {
        try {
          await axios.put(`${API_URL}/receive/${part._pendingPartId}/mark-used`, {
            usuario: localStorage.getItem('username') || ''
          });
          console.log(`✅ Parte pendiente ${part._pendingPartId} marcada como USED`);
        } catch (error) {
          console.error(`❌ Error marcando parte pendiente ${part._pendingPartId} como USED:`, error);
        }
      }

      // Muestra mensaje de éxito
      alert(`¡Orden de trabajo #${newWorkOrderId} creada exitosamente!`);

      if (data.pdfUrl) {
        window.open(`${API_URL}${data.pdfUrl}`, '_blank', 'noopener,noreferrer');
      }
      
      // Cierra el formulario y resetea
      setShowForm(false);
      resetNewWorkOrder();
      
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
      setPendingParts([]);
    }
  };
  const partesSeleccionadas = pendingParts.filter(p => selectedPendingParts.includes(p.id));

  useEffect(() => {
    if (showForm) {
      // Obtén las partes seleccionadas
      const partesSeleccionadas = pendingParts.filter(p => selectedPendingParts.includes(p.id));
      // Rellena los primeros campos vacíos del formulario con las partes seleccionadas
      const nuevasPartes = [...newWorkOrder.parts];
      let idx = 0;
      for (const parte of partesSeleccionadas) {
        if (idx < nuevasPartes.length) {
          nuevasPartes[idx] = {
            part: parte.sku,
            sku: parte.sku, // <-- obligatorio
            qty: parte.qty,
            cost: ''
          };
          idx++;
        }
      }
      // Vacía los campos restantes si sobran
      for (; idx < nuevasPartes.length; idx++) {
        nuevasPartes[idx] = { part: '', sku: '', qty: '', cost: '' }; // <-- obligatorio
      }
      setNewWorkOrder(prev => ({
        ...prev,
        parts: nuevasPartes
      }));
    }    // Solo ejecuta cuando cambia la selección o las partes pendientes
    // eslint-disable-next-line
  }, [selectedPendingParts, pendingParts, showForm, setNewWorkOrder]);

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
    if (showEditForm && editWorkOrder) {
      // Calcula el subtotal de partes y labor
      const partsCost = editWorkOrder.parts.reduce((sum: number, p: any) => sum + (parseFloat(p.cost) || 0), 0);
      const totalHrs = parseFloat(editWorkOrder.totalHrs) || 0;
      const laborTotal = totalHrs * 60;
      let subtotal = partsCost + laborTotal;

      // Suma extras
      let extra = 0;
      (extraOptions || []).forEach((opt: string) => {
        if (opt === '5') extra += subtotal * 0.05;
        if (opt === '15shop') extra += subtotal * 0.15;
        if (opt === '15weld') extra += subtotal * 0.15;
      });

      const totalLabAndParts = subtotal + extra;
      setEditWorkOrder((prev: any) => ({
        ...prev,
        totalLabAndParts: totalLabAndParts ? totalLabAndParts.toFixed(2) : ''
      }));
    }
  }, [editWorkOrder?.parts, editWorkOrder?.totalHrs, extraOptions, showEditForm]);

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
  };  const addEmptyPart = () => {    if (showEditForm && editWorkOrder) {
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
    if (showEditForm && editWorkOrder) {      // Agregar al editWorkOrder
      setEditWorkOrder((prev: any) => ({
        ...prev,
        parts: [
          ...(prev.parts || []),
          newPart
        ]
      }));
    } else {
      // Agregar al newWorkOrder
      setNewWorkOrder(prev => ({
        ...prev,
        parts: [
          ...prev.parts,
          newPart
        ]
      }));
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
      setTrailersWithPendingParts([]);
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
        </div>

        {/* --- BOTONES ARRIBA --- */}
        <div style={{ margin: '24px 0 16px 0' }}>
          <button
            className="wo-btn"
            style={primaryBtn}
            onClick={() => {
              resetNewWorkOrder(); // <-- LIMPIA LOS CAMPOS
              setExtraOptions([]); // <-- LIMPIA EXTRAS SI USAS
              setShowForm(true);
            }}
          >
            NEW W.O
          </button>
          <button className="wo-btn" style={secondaryBtn} onClick={exportToExcel}>
            Export Excel
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
          <button
            className="wo-btn"
            style={secondaryBtn}
            disabled={selectedRow === null}
            onClick={() => {
              if (selectedRow !== null) {
                window.open(`${API_URL}/work-orders/${selectedRow}/pdf`, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            View PDF
          </button>
        </div>

        {/* --- FORMULARIO NUEVA ORDEN --- */}
        {showForm && (
          <div style={modalStyle} onClick={() => setShowForm(false)}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>              <WorkOrderForm
                workOrder={newWorkOrder}
                onChange={handleWorkOrderChange}
                onPartChange={handlePartChange}
                onSubmit={(data) => handleAddWorkOrder(data || newWorkOrder)}
                onCancel={() => setShowForm(false)}                title="New Work Order"
                billToCoOptions={billToCoOptions}
                getTrailerOptions={(billToCo: string) => getTrailerOptionsWithPendingIndicator(billToCo, trailersWithPendingParts)}
                inventory={inventory}
                trailersWithPendingParts={trailersWithPendingParts}
                pendingParts={pendingParts}
                pendingPartsQty={pendingPartsQty}
                setPendingPartsQty={setPendingPartsQty}
                onAddPendingPart={(part: any, qty: any) => {
                  setNewWorkOrder(prev => {
                    const emptyIdx = prev.parts.findIndex(p => !p.part);
                    const cantidad = qty || part.qty?.toString() || '1';
                    if (emptyIdx !== -1) {
                      const newParts = [...prev.parts];
                      newParts[emptyIdx] = {
                        part: part.part || part.sku,
                        sku: part.sku, // <-- ahora siempre se asigna sku
                        qty: cantidad,
                        cost: part.costTax?.toString() || ''
                      };
                      return { ...prev, parts: newParts };
                    } else {
                      return {
                        ...prev,
                        parts: [
                          ...prev.parts,
                          {
                            part: part.part || part.sku,
                            sku: part.sku,
                            qty: cantidad,
                            cost: part.costTax?.toString() || ''
                          }                        ]
                      };
                    }                  });
                }}
                onAddEmptyPart={addEmptyPart}
                extraOptions={extraOptions}
                setExtraOptions={setExtraOptions}
                loading={loading}
                setLoading={setLoading}
              />
            </div>
          </div>
        )}
        {/* --- FORMULARIO MODIFICAR ORDEN --- */}
        {showEditForm && (
          <div style={modalStyle} onClick={() => setShowEditForm(false)}>
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
                      onClick={() => { setShowEditForm(false); setEditId(''); setEditWorkOrder(null); setEditError(''); setEditPassword(''); }}
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
                          // LIMPIA EL TOTAL ANTES DE ENVIAR
                          const totalLabAndPartsLimpio = Number(String(editWorkOrder.totalLabAndParts).replace(/[^0-9.]/g, ''));                          // Actualizar la work order
                          await axios.put(`${API_URL}/work-orders/${editWorkOrder.id}`, {
                            ...editWorkOrder,
                            totalLabAndParts: totalLabAndPartsLimpio,
                            manualTotalEdit: true,
                            date: editWorkOrder.date ? editWorkOrder.date.slice(0, 10) : '',
                            parts: editWorkOrder.parts,
                            usuario: localStorage.getItem('username') || '',
                            extraOptions,
                          });

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
                            await axios.post(`${API_URL}/work-orders/${editWorkOrder.id}/generate-pdf`);
                            console.log('PDF generado exitosamente tras edición');
                          } catch (pdfError) {
                            console.error('Error generando PDF tras edición:', pdfError);
                            // No interrumpir el flujo si falla el PDF
                          }
                          
                          // CIERRA EL MODAL Y LIMPIA ESTADO INMEDIATAMENTE
                          setShowEditForm(false);
                          setEditWorkOrder(null);
                          setEditId('');
                          setEditError('');
                          // REFRESCA LA TABLA EN SEGUNDO PLANO
                          fetchWorkOrders();
                          alert('Order updated successfully and PDF regenerated.');
                        } catch (err) {
                          console.error('Error updating order:', err);
                          alert('Error updating order.');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      onCancel={() => { setShowEditForm(false); setEditWorkOrder(null); setEditId(''); setEditError(''); }}                      title="Edit Work Order"
                      billToCoOptions={billToCoOptions}
                      getTrailerOptions={(billToCo: string) => getTrailerOptionsWithPendingIndicator(billToCo, trailersWithPendingParts)}
                      inventory={inventory}onAddEmptyPart={addEmptyPart}
                      onAddPendingPart={addPendingPart}
                      trailersWithPendingParts={trailersWithPendingParts}
                      pendingParts={pendingParts}
                      pendingPartsQty={pendingPartsQty}
                      setPendingPartsQty={setPendingPartsQty}
                      extraOptions={extraOptions}
                      setExtraOptions={setExtraOptions}
                      loading={loading}
                      setLoading={setLoading}
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