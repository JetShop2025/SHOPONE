import React, { useState, useEffect } from 'react';
import axios from 'axios';
import WorkOrderForm from './WorkOrderForm';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/es';
dayjs.extend(isBetween);
dayjs.extend(weekOfYear);

const API_URL = process.env.REACT_APP_API_URL || '';

const billToCoOptions = [
  "JETSHO","PRIGRE","GABGRE","GALGRE","RAN100","JCGLOG","JGTBAK","VIDBAK","JETGRE","ALLSAN","AGMGRE","TAYRET","TRUSAL","BRAGON","FRESAL","SEBSOL","LFLCOR","GARGRE","MCCGRE","LAZGRE","MEJADE"
];

function getTrailerOptions(billToCo: string): string[] {
  if (billToCo === "GALGRE") return Array.from({length: 54}, (_, i) => `1-${100+i}`);
  if (billToCo === "JETGRE") return Array.from({length: 16}, (_, i) => `2-${(i+1).toString().padStart(3, '0')}`);
  if (billToCo === "PRIGRE") return Array.from({length: 24}, (_, i) => `3-${(300+i).toString()}`);
  if (billToCo === "RAN100") return Array.from({length: 20}, (_, i) => `4-${(400+i).toString()}`);
  if (billToCo === "GABGRE") return Array.from({length: 30}, (_, i) => `5-${(500+i).toString()}`);
  return [];
}

function getWeekRange(weekStr: string) {
  const [year, week] = weekStr.split('-W');
  const start = dayjs().year(Number(year)).week(Number(week)).startOf('week');
  const end = dayjs().year(Number(year)).week(Number(week)).endOf('week');
  return { start, end };
}

const STATUS_OPTIONS = [
  "PRE W.O",
  "PROCESSING",
  "APPROVED",
  "FINISHED"
];

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
  ...buttonBase,
  background: '#1976d2',
  color: '#fff',
};

const dangerBtn = {
  ...buttonBase,
  background: '#d32f2f',
  color: '#fff',
};

const secondaryBtn = {
  ...buttonBase,
  background: '#fff',
  color: '#1976d2',
  border: '1px solid #1976d2',
};

const mainTitleStyle = {
  color: '#1976d2',
  fontWeight: 800,
  fontSize: 32,
  marginBottom: 24,
  letterSpacing: 2,
  fontFamily: 'Segoe UI, Arial, sans-serif',
};

const sectionTitleStyle = {
  color: '#1976d2',
  fontWeight: 700,
  fontSize: 22,
  marginBottom: 16,
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function calcularTotalWO(order: any) {
  // Suma de partes
  const partsTotal = order.parts?.reduce((sum: number, part: any) => {
    const val = Number(part.cost?.toString().replace(/[^0-9.]/g, ''));
    return sum + (isNaN(val) ? 0 : val);
  }, 0) || 0;

  // Labor
  const laborHrs = Number(order.totalHrs);
  const laborTotal = !isNaN(laborHrs) && laborHrs > 0 ? laborHrs * 60 : 0;

  // Subtotal
  const subtotal = partsTotal + laborTotal;

  // Extras
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
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [newWorkOrder, setNewWorkOrder] = useState({
    billToCo: '',
    trailer: '',
    mechanic: '',
    date: '',
    description: '',
    parts: [
      { part: '', sku: '', qty: '', cost: '' },
      { part: '', sku: '', qty: '', cost: '' },
      { part: '', sku: '', qty: '', cost: '' },
      { part: '', sku: '', qty: '', cost: '' },
      { part: '', sku: '', qty: '', cost: '' },
    ],
    totalHrs: '',
    totalLabAndParts: '',
    status: '',
  });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteDate, setDeleteDate] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const week = (() => {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      const weekNum = Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1)/7);
      return weekNum.toString().padStart(2, '0');
    })();
    return `${year}-W${week}`;
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [multiDeleteEnabled, setMultiDeleteEnabled] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedPendingParts, setSelectedPendingParts] = useState<number[]>([]);
  const [trailersWithPendingParts, setTrailersWithPendingParts] = useState<string[]>([]);
  const [pendingPartsQty, setPendingPartsQty] = useState<{ [id: number]: string }>({});
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [extraOptions, setExtraOptions] = React.useState<string[]>([]);

  useEffect(() => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    axios.get(`${API_URL}/work-orders`)
      .then((response: any) => {
        setWorkOrders(response.data);
      })
      .catch((error: any) => {
        console.error('Error al obtener las órdenes de trabajo:', error);
      });
  }, []);

  useEffect(() => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    axios.get(`${API_URL}/inventory`)
      .then(res => setInventory(res.data as any[]))
      .catch(() => setInventory([]));
  }, []);

  useEffect(() => {
    // Solo cargar una vez al abrir el formulario
    if (showForm) {
      axios.get(`${API_URL}/receive?estatus=PENDING`)
        .then(res => {
          // Cast explícito para TypeScript
          const receives = res.data as { destino_trailer?: string }[];
          const trailers = Array.from(
            new Set(
              receives
                .map(r => r.destino_trailer)
                .filter((t): t is string => !!t)
            )
          );
          setTrailersWithPendingParts(trailers);
        })
        .catch(() => setTrailersWithPendingParts([]));
    }
  }, [showForm]);

  useEffect(() => {
    if (showForm && newWorkOrder.trailer) {
      axios.get(`${API_URL}/receive?destino_trailer=${newWorkOrder.trailer}&estatus=PENDING`)
        .then(res => setPendingParts(res.data as any[]))
        .catch(() => setPendingParts([]));
    } else {
      setPendingParts([]);
    }
  }, [showForm, newWorkOrder.trailer]);

  const filteredOrders = workOrders.filter(order => {
    if (!order.date) return false;
    const { start, end } = getWeekRange(selectedWeek);
    const orderDate = dayjs(order.date.slice(0, 10));
    const inWeek = orderDate.isBetween(start, end, 'day', '[]');
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return inWeek && matchesStatus;
  });



  // Cambios generales
  const handleWorkOrderChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (showForm) {
      setNewWorkOrder(prev => ({ ...prev, [name]: value }));
      if (name === 'trailer') {
        fetchPendingParts(value); // <-- Agrega esta línea
      }
    } else if (showEditForm && editWorkOrder) {
      setEditWorkOrder((prev: any) => ({ ...prev, [name]: value }));
      if (name === 'trailer') {
        fetchPendingParts(value); // <-- Agrega esta línea
      }
    }
  };

  // Cambios en partes
  const handlePartChange = (index: number, field: string, value: string) => {
    if (showForm) {
      const updatedParts = [...newWorkOrder.parts];
      updatedParts[index][field as 'part' | 'sku' | 'qty' | 'cost'] = value;
      setNewWorkOrder(prev => ({ ...prev, parts: updatedParts }));
    } else if (showEditForm && editWorkOrder) {
      const updatedParts = [...editWorkOrder.parts];
      updatedParts[index][field as 'part' | 'sku' | 'qty' | 'cost'] = value;
      setEditWorkOrder((prev: any) => ({ ...prev, parts: updatedParts }));
    }
  };

  // Guardar nueva orden
  const handleAddWorkOrder = async (datosOrden: any) => {
    if (!datosOrden.date) {
      alert('Debes seleccionar una fecha para la orden.');
      return;
    }
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
        .filter((p: any) => p.sku && p.qty && Number(p.qty) > 0)
        .map((p: any) => ({
          sku: p.sku,
          part: p.part,
          qty: Number(p.qty),
          cost: p.cost
        }));

      // 4. Guarda la orden
      const res = await axios.post(`${API_URL}/work-orders`, {
        ...datosOrden,
        parts: partesParaGuardar,
        extraOptions,
        usuario: localStorage.getItem('username') || ''
      });
      const data = res.data as { id: number, pdfUrl?: string };
      const newWorkOrderId = data.id;

      // REGISTRA PARTES USADAS EN work_order_parts
      for (const part of partesParaGuardar) {
        await axios.post(`${API_URL}/work-order-parts`, {
          work_order_id: newWorkOrderId,
          sku: part.sku,
          part_name: inventory.find(i => i.sku === part.sku)?.part || '',
          qty_used: part.qty,
          cost: part.cost,
          usuario: localStorage.getItem('username') || ''
        });
      }

      if (data.pdfUrl) {
        const link = document.createElement('a');
        link.href = `${API_URL}${data.pdfUrl}`;
        link.download = data.pdfUrl.split('/').pop() || 'orden.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setShowForm(false);
      setNewWorkOrder({
        billToCo: '',
        trailer: '',
        mechanic: '',
        date: '',
        description: '',
        parts: [
          { part: '', sku: '', qty: '', cost: '' },
          { part: '', sku: '', qty: '', cost: '' },
          { part: '', sku: '', qty: '', cost: '' },
          { part: '', sku: '', qty: '', cost: '' },
          { part: '', sku: '', qty: '', cost: '' },
        ],
        totalHrs: '',
        totalLabAndParts: '',
        status: '',
      });
      const updated = await axios.get(`${API_URL}/work-orders`);
      setWorkOrders(updated.data as any[]);
      for (const part of pendingParts) {
        await axios.put(`${API_URL}/receive/${part.id}/use`);
      }
      for (const partId of selectedPendingParts) {
        await axios.put(`${API_URL}/receive/${partId}/use`);
      }
      setSelectedPendingParts([]);
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        alert('Error: ' + err.response.data.error);
      } else {
        alert('Error al guardar la orden');
      }
    }
  };

  // Función para obtener partes pendientes para una traila
  const fetchPendingParts = async (trailer: string) => {
    if (!trailer) {
      setPendingParts([]);
      return;
    }
    try {
      const res = await axios.get(`${API_URL}/receive?destino_trailer=${trailer}&estatus=PENDING`);
      setPendingParts(res.data as any[]); // <-- Corrige aquí
    } catch {
      setPendingParts([]);
    }
  };

  const partesSeleccionadas = pendingParts.filter(p => selectedPendingParts.includes(p.id));
  const partesWO = [
    ...partesSeleccionadas.map(p => ({
      part: p.sku,
      qty: p.qty,
      cost: '' // o algún valor si tienes el costo
    })),
    ...newWorkOrder.parts.filter(p => !p.part) // rellena los espacios vacíos si quieres
  ];

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
    }
    // Solo ejecuta cuando cambia la selección o las partes pendientes
    // eslint-disable-next-line
  }, [selectedPendingParts, pendingParts, showForm]);

  // Calcula el total cada vez que cambian las partes o las horas
  useEffect(() => {
    if (showForm) {
      const totalHrs = parseFloat(newWorkOrder.totalHrs) || 0;
      const partsCost = newWorkOrder.parts.reduce((sum, p) => sum + (parseFloat(p.cost) || 0), 0);
      const totalLabAndParts = (totalHrs * 60) + partsCost;
      setNewWorkOrder(prev => ({
        ...prev,
        totalLabAndParts: totalLabAndParts ? totalLabAndParts.toFixed(2) : ''
      }));
    }
  }, [newWorkOrder.parts, newWorkOrder.totalHrs, showForm]);

  const handleEdit = () => {
    if (selectedRow === null) return;
    const pwd = window.prompt('Enter password to edit:');
    if (pwd === '6214') {
      const found = workOrders.find(wo => wo.id === selectedRow);
      if (found) {
        setEditWorkOrder({
          ...found,
          date: found.date ? found.date.slice(0, 10) : ''
        });
        setShowEditForm(true);
      }
    } else if (pwd !== null) {
      alert('Incorrect password');
    }
  };

  const handleDelete = async () => {
    if (selectedRow === null) return;
    const pwd = window.prompt('Enter password to delete:');
    if (pwd === '6214') {
      if (window.confirm('Are you sure you want to delete this order?')) {
        try {
          await axios.request({
            url: `${API_URL}/work-orders/${selectedRow}`,
            method: 'DELETE',
            data: { usuario: localStorage.getItem('username') || '' }
          });
          setWorkOrders(workOrders.filter(order => order.id !== selectedRow));
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
    setNewWorkOrder(prev => ({
      ...prev,
      parts: [
        ...prev.parts,
        { part: '', sku: '', qty: '', cost: '' }
      ]
    }));
  };

  return (
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
          .wo-table {
            border-collapse: collapse;
            width: 100%;
            min-width: 1200px;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(25,118,210,0.07);
            font-size: 12px;
          }
          .wo-table th, .wo-table td {
            border: 1px solid #d0d7e2;
            padding: 4px 3px;
            font-size: 12px;
            max-width: 120px;
            word-break: break-word;
            white-space: pre-line;
          }
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
          .wo-row-processing, .wo-row-pre {
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
        style={{
          padding: '32px',
          background: 'linear-gradient(90deg, #e3f2fd 0%, #ffffff 100%)',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(25, 118, 210, 0.10)',
          maxWidth: 1400,
          margin: '32px auto'
        }}
      >
        <div className="wo-header">
          <h1 className="wo-title">
            <span className="wo-title-icon">WO</span>
            Work Orders
          </h1>
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
        </div>

        {/* --- BOTONES ARRIBA --- */}
        <div style={{ margin: '24px 0 16px 0' }}>
          <button className="wo-btn" style={primaryBtn} onClick={() => setShowForm(true)}>
            NEW W.O
          </button>
          <button
            className="wo-btn"
            style={dangerBtn}
            disabled={selectedRow === null}
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            className="wo-btn"
            style={secondaryBtn}
            disabled={selectedRow === null}
            onClick={handleEdit}
          >
            Edit
          </button>
        </div>

        {/* --- FORMULARIO NUEVA ORDEN --- */}
        {showForm && (
          <div style={modalStyle} onClick={() => setShowForm(false)}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <WorkOrderForm
                workOrder={newWorkOrder}
                onChange={handleWorkOrderChange}
                onPartChange={handlePartChange}
                onSubmit={() => handleAddWorkOrder(newWorkOrder)}
                onCancel={() => setShowForm(false)}
                title="New Work Order"
                billToCoOptions={billToCoOptions}
                getTrailerOptions={getTrailerOptions}
                inventory={inventory}
                trailersWithPendingParts={trailersWithPendingParts}
                pendingParts={pendingParts}
                pendingPartsQty={pendingPartsQty}
                setPendingPartsQty={setPendingPartsQty}
                onAddPendingPart={(part, qty) => {
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
                          }
                        ]
                      };
                    }
                  });
                }}
                onAddEmptyPart={addEmptyPart}
                extraOptions={extraOptions}
                setExtraOptions={setExtraOptions}
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
                            date: found.date ? found.date.slice(0, 10) : ''
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
                    <WorkOrderForm
                      workOrder={editWorkOrder}
                      onChange={handleWorkOrderChange}
                      onPartChange={handlePartChange}
                      onSubmit={async () => {
                        try {
                          await axios.put(`${API_URL}/work-orders/${editWorkOrder.id}`, {
                            ...editWorkOrder,
                            date: editWorkOrder.date ? editWorkOrder.date.slice(0, 10) : '',
                            parts: editWorkOrder.parts,
                            usuario: localStorage.getItem('username') || '',
                            extraOptions, // <-- agrega esto
                          });
                          const updated = await axios.get(`${API_URL}/work-orders`);
                          setWorkOrders(updated.data as any[]);
                          setShowEditForm(false);
                          setEditWorkOrder(null);
                          setEditId('');
                          setEditError('');
                          alert('Order updated successfully.');
                        } catch (err) {
                          alert('Error updating order.');
                        }
                      }}
                      onCancel={() => { setShowEditForm(false); setEditWorkOrder(null); setEditId(''); setEditError(''); }}
                      title="Edit Work Order"
                      billToCoOptions={billToCoOptions}
                      getTrailerOptions={getTrailerOptions}
                      inventory={inventory}
                      onAddEmptyPart={addEmptyPart}
                      extraOptions={extraOptions}           // <-- agrega esto
                      setExtraOptions={setExtraOptions}     // <-- agrega esto
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
            <tbody>
  {filteredOrders.map((order, index) => {
    let rowClass = '';
    if (order.status === 'APPROVED') rowClass = 'wo-row-approved';
    else if (order.status === 'FINISHED') rowClass = 'wo-row-finished';
    else if (order.status === 'PROCESSING') rowClass = 'wo-row-processing';
    else if (order.status === 'PRE W.O') rowClass = 'wo-row-pre';

    const hasMoreParts = order.parts && order.parts.length > 5;

    return (
      <React.Fragment key={order.id}>
        <tr
          className={`${rowClass} ${selectedRow === order.id ? 'wo-row-selected' : ''}`}
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
          <td>{order.billToCo}</td>
          <td>{order.trailer}</td>
          <td>{order.mechanic}</td>
          <td>{order.date?.slice(0, 10)}</td>
          <td style={{ minWidth: 200, maxWidth: 300, whiteSpace: 'pre-line' }}>{order.description}</td>
          {[0,1,2,3,4].map(i => (
            <React.Fragment key={i}>
              <td>{order.parts && order.parts[i] && order.parts[i].part ? order.parts[i].part : ''}</td>
              <td>{order.parts && order.parts[i] && order.parts[i].qty ? order.parts[i].qty : ''}</td>
              <td>{order.parts && order.parts[i] && order.parts[i].cost ? order.parts[i].cost : ''}</td>
            </React.Fragment>
          ))}
          <td>{order.totalHrs}</td>
          <td>{formatCurrency(calcularTotalWO(order))}</td>
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
                      <td>{p.part}</td>
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
    </>
  );
};

export default WorkOrdersTable;