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
  "PROCESANDO",
  "APROBADA",
  "FINALIZADA"
];

const WorkOrdersTable: React.FC = () => {
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
      { part: '', qty: '', cost: '' },
      { part: '', qty: '', cost: '' },
      { part: '', qty: '', cost: '' },
      { part: '', qty: '', cost: '' },
      { part: '', qty: '', cost: '' },
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
      updatedParts[index][field as 'part' | 'qty' | 'cost'] = value;
      setNewWorkOrder(prev => ({ ...prev, parts: updatedParts }));
    } else if (showEditForm && editWorkOrder) {
      const updatedParts = [...editWorkOrder.parts];
      updatedParts[index][field as 'part' | 'qty' | 'cost'] = value;
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
        .filter((p: any) => p.part && p.qty && !isNaN(Number(p.qty)))
        .map((p: any) => ({
          sku: p.part,
          qty: Number(p.qty)
        }));

      // 2. Descuenta del inventario
      if (partesUsadas.length > 0) {
        await axios.post(`${API_URL}/inventory/deduct`, {
          parts: partesUsadas
        });
      }

      // 3. Guarda la orden como ya lo haces
      const res = await axios.post(`${API_URL}/work-orders`, {
        ...datosOrden,
        usuario: localStorage.getItem('username') || ''
      });
      const data = res.data as { pdfUrl?: string };
      if (data.pdfUrl) {
        window.open(`${API_URL}${data.pdfUrl}`, '_blank');
      }
      setShowForm(false);
      setNewWorkOrder({
        billToCo: '',
        trailer: '',
        mechanic: '',
        date: '',
        description: '',
        parts: [
          { part: '', qty: '', cost: '' },
          { part: '', qty: '', cost: '' },
          { part: '', qty: '', cost: '' },
          { part: '', qty: '', cost: '' },
          { part: '', qty: '', cost: '' },
        ],
        totalHrs: '',
        totalLabAndParts: '',
        status: '',
      });
      const updated = await axios.get(`${API_URL}/work-orders`);
      setWorkOrders(updated.data as any[]);
      for (const part of pendingParts) {
        // Si quieres marcar todas como usadas, o filtra según lo que el usuario seleccione
        await axios.put(`${API_URL}/receive/${part.id}/use`);
      }
      for (const partId of selectedPendingParts) {
        await axios.put(`${API_URL}/receive/${partId}/use`);
      }
      setSelectedPendingParts([]); // Limpia la selección después de guardar
    } catch (err) {
      // Manejo de error
    }
  };

  // Función para obtener partes pendientes para una traila
  const fetchPendingParts = async (trailer: string) => {
    if (!trailer) {
      setPendingParts([]);
      return;
    }
    try {
      const res = await axios.get(`${API_URL}/receive?destino_trailer=${trailer}&estatus=PENDIENTE`);
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
            qty: parte.qty,
            cost: '' // Puedes poner el costo si lo tienes
          };
          idx++;
        }
      }
      // Vacía los campos restantes si sobran
      for (; idx < nuevasPartes.length; idx++) {
        nuevasPartes[idx] = { part: '', qty: '', cost: '' };
      }
      setNewWorkOrder(prev => ({
        ...prev,
        parts: nuevasPartes
      }));
    }
    // Solo ejecuta cuando cambia la selección o las partes pendientes
    // eslint-disable-next-line
  }, [selectedPendingParts, pendingParts, showForm]);

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
          }
          .wo-table th, .wo-table td {
            border: 1px solid #d0d7e2;
            padding: 8px 6px;
            font-size: 14px;
          }
          .wo-table th {
            background: #1976d2;
            color: #fff;
            font-weight: 700;
            font-size: 15px;
            border-bottom: 2px solid #1565c0;
          }
          .wo-table tr:last-child td {
            border-bottom: 1px solid #d0d7e2;
          }
          .wo-title {
            color: #1976d2;
            font-weight: 800;
            letter-spacing: 2px;
            font-size: 36px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
          }
          .wo-title-icon {
            display: inline-block;
            background: #1976d2;
            color: #fff;
            border-radius: 50%;
            width: 48px;
            height: 48px;
            text-align: center;
            line-height: 48px;
            margin-right: 16px;
            font-size: 28px;
            font-weight: 900;
            box-shadow: 0 2px 8px rgba(25, 118, 210, 0.15);
          }
          .wo-btn {
            background: #1976d2;
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 10px 28px;
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 24px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(25,118,210,0.10);
            transition: background 0.2s, color 0.2s;
          }
          .wo-btn.secondary {
            background: #fff;
            color: #1976d2;
            border: 1px solid #1976d2;
          }
          .wo-btn.danger {
            background: #fff;
            color: #d32f2f;
            border: 1px solid #d32f2f;
          }
          .wo-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
          }
          .wo-filter-label {
            font-weight: 600;
            color: #1976d2;
          }
          .wo-filter-input {
            border: 1px solid #b0c4de;
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 15px;
            margin-left: 8px;
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
            Filtrar por semana:&nbsp;
            <input
              type="week"
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              className="wo-filter-input"
            />
          </label>
          <label className="wo-filter-label">
            Filtrar por estatus:&nbsp;
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="wo-filter-input"
              style={{ minWidth: 160 }}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        </div>

        {/* --- BOTONES ARRIBA --- */}
        <div style={{ margin: '24px 0 16px 0' }}>
          <button className="wo-btn" onClick={() => setShowForm(true)}>NEW W.O</button>
          <button
            className="wo-btn danger"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setShowDeleteForm(true);
              setMultiDeleteEnabled(true);
            }}
          >
            Eliminar
          </button>
          <button className="wo-btn secondary" style={{ marginLeft: 8 }} onClick={() => setShowEditForm(true)}>Modificar</button>
        </div>

        {/* --- FORMULARIO NUEVA ORDEN --- */}
        {showForm && (
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 32 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#1976d2' }}>
                {workOrders.length > 0 && (
                  <>ID sugerido: {Math.max(...workOrders.map(wo => wo.id)) + 1}</>
                )}
              </div>
              <WorkOrderForm
                workOrder={newWorkOrder}
                onChange={handleWorkOrderChange}
                onPartChange={handlePartChange}
                onSubmit={() => handleAddWorkOrder(newWorkOrder)}
                onCancel={() => setShowForm(false)}
                title="Nueva Orden de Trabajo"
                billToCoOptions={billToCoOptions}
                getTrailerOptions={getTrailerOptions}
                inventory={inventory}
              />
            </div>
            {pendingParts.length > 0 && (
              <div
                style={{
                  minWidth: 340,
                  background: 'linear-gradient(120deg, #e3f2fd 60%, #fffbe6 100%)',
                  border: '1.5px solid #1976d2',
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: '0 2px 12px rgba(25,118,210,0.08)',
                  fontSize: 15,
                }}
              >
                <div style={{ fontWeight: 700, color: '#1976d2', marginBottom: 10, fontSize: 17, letterSpacing: 1 }}>
                  <span style={{ marginRight: 8, fontSize: 18 }}>🛒</span>
                  Partes pendientes para esta traila
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'disc' }}>
                  {pendingParts.map(part => (
                    <li key={part.id} style={{ marginBottom: 8, lineHeight: 1.5 }}>
                      <input
                        type="checkbox"
                        checked={selectedPendingParts.includes(part.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedPendingParts(prev => [...prev, part.id]);
                          } else {
                            setSelectedPendingParts(prev => prev.filter(id => id !== part.id));
                          }
                        }}
                        style={{ marginRight: 8 }}
                      />
                      <span style={{ fontWeight: 600, color: '#333' }}>{part.part}</span>
                      <span style={{ color: '#888', marginLeft: 6 }}>(SKU: {part.sku})</span>
                      <span style={{ background: '#1976d2', color: '#fff', borderRadius: 6, padding: '2px 10px', marginLeft: 10, fontWeight: 700, fontSize: 14 }}>
                        {part.qty}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* --- FORMULARIO ELIMINAR ORDENES --- */}
        {showDeleteForm && (
          <div style={{
            marginBottom: 24,
            border: '1px solid #d32f2f',
            background: '#fffbe6',
            borderRadius: 8,
            padding: 24,
            maxWidth: 600,
            boxShadow: '0 2px 8px rgba(211,47,47,0.10)'
          }}>
            <h2 style={{ color: '#d32f2f', marginBottom: 12 }}>Eliminar Órdenes Seleccionadas</h2>
            <div style={{ marginBottom: 12 }}>
              Selecciona las órdenes que deseas eliminar usando los checkboxes de la tabla.
            </div>
            <label style={{ fontWeight: 600 }}>
              Password:
              <input
                type="password"
                placeholder="Password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                style={{ width: 120, marginLeft: 8, marginRight: 8, borderRadius: 4, border: '1px solid #d32f2f', padding: 4 }}
              />
            </label>
            <div style={{ marginTop: 16 }}>
              <button
                className="wo-btn danger"
                disabled={deletePassword !== '6214' || selectedIds.length === 0}
                onClick={async () => {
                  if (window.confirm(`¿Seguro que deseas eliminar las órdenes con IDs: ${selectedIds.join(', ')}?`)) {
                    try {
                      await axios.request({
                        url: `${API_URL}/work-orders`,
                        method: 'DELETE',
                        data: { ids: selectedIds, usuario: localStorage.getItem('username') || '' }
                      });
                      setWorkOrders(workOrders.filter(order => !selectedIds.includes(order.id)));
                      setSelectedIds([]);
                      setShowDeleteForm(false);
                      setMultiDeleteEnabled(false);
                      setDeletePassword('');
                      alert('Órdenes eliminadas correctamente');
                    } catch {
                      alert('Error al eliminar las órdenes');
                    }
                  }
                }}
              >
                Eliminar seleccionados
              </button>
              <button
                className="wo-btn secondary"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  setShowDeleteForm(false);
                  setMultiDeleteEnabled(false);
                  setSelectedIds([]);
                  setDeletePassword('');
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* --- FORMULARIO MODIFICAR ORDEN --- */}
        {showEditForm && (
          <div style={{
            marginBottom: 24,
            border: '1px solid orange',
            background: '#fffbe6',
            borderRadius: 8,
            padding: 24,
            maxWidth: 700,
            boxShadow: '0 2px 8px rgba(255,152,0,0.10)'
          }}>
            <h2 style={{ color: '#ff9800', marginBottom: 12 }}>Editar Orden de Trabajo</h2>
            {!editWorkOrder ? (
              <>
                <label style={{ fontWeight: 600 }}>
                  ID:
                  <input
                    type="number"
                    placeholder="ID a editar"
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
                      setEditError('Contraseña incorrecta');
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
                      setEditError('No se encontró una orden con ese ID.');
                    }
                  }}
                >
                  Cargar
                </button>
                <button
                  className="wo-btn secondary"
                  style={{ marginLeft: 8 }}
                  onClick={() => { setShowEditForm(false); setEditId(''); setEditWorkOrder(null); setEditError(''); setEditPassword(''); }}
                >
                  Cancelar
                </button>
                {editError && <div style={{ color: 'red', marginTop: 8 }}>{editError}</div>}
              </>
            ) : (
              <>
                <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#1976d2' }}>
                  ID de la orden: {editWorkOrder.id}
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
                        usuario: localStorage.getItem('username') || ''
                      });
                      const updated = await axios.get(`${API_URL}/work-orders`);
                      setWorkOrders(updated.data as any[]);
                      setShowEditForm(false);
                      setEditWorkOrder(null);
                      setEditId('');
                      setEditError('');
                      alert('Orden actualizada correctamente.');
                    } catch (err) {
                      alert('Error al actualizar la orden.');
                    }
                  }}
                  onCancel={() => { setShowEditForm(false); setEditWorkOrder(null); setEditId(''); setEditError(''); }}
                  title="Editar Orden de Trabajo"
                  billToCoOptions={billToCoOptions}
                  getTrailerOptions={getTrailerOptions}
                  inventory={inventory}
                />
              </>
            )}
          </div>
        )}

        {/* --- TABLA ABAJO --- */}
        <div style={{ overflowX: 'auto' }}>
          <table className="wo-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={filteredOrders.length > 0 && selectedIds.length === filteredOrders.length}
                    disabled={!multiDeleteEnabled}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedIds(filteredOrders.map(order => order.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
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
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, index) => {
                // Define el color de fondo según el estatus
                let bgColor = '#fff';
                if (order.status === 'APROBADA') bgColor = '#43a047'; // verde fuerte
                else if (order.status === 'FINALIZADA') bgColor = '#ffe082'; // amarillo fuerte
                else if (order.status === 'PRE W.O') bgColor = '#fff'; // blanco

                return (
                  <tr
                    key={index}
                    style={{
                      background: bgColor,
                      borderBottom: '1px solid #e3eaf2',
                      color: order.status === 'APROBADA' ? '#fff' : order.status === 'FINALIZADA' ? '#333' : '#1976d2',
                      fontWeight: 600
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        disabled={!multiDeleteEnabled}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, order.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== order.id));
                          }
                        }}
                      />
                    </td>
                    <td>{order.id}</td>
                    <td>{order.billToCo}</td>
                    <td>{order.trailer}</td>
                    <td>{order.mechanic}</td>
                    <td>{order.date?.slice(0, 10)}</td>
                    <td style={{ minWidth: 300, maxWidth: 500, whiteSpace: 'pre-wrap' }}>{order.description}</td>
                    {[0,1,2,3,4].map(i => (
                      <React.Fragment key={i}>
                        <td>{order.parts && order.parts[i] && order.parts[i].part ? order.parts[i].part : ''}</td>
                        <td>{order.parts && order.parts[i] && order.parts[i].qty ? order.parts[i].qty : ''}</td>
                        <td>{order.parts && order.parts[i] && order.parts[i].cost ? order.parts[i].cost : ''}</td>
                      </React.Fragment>
                    ))}
                    <td>{order.totalHrs}</td>
                    <td>{order.totalLabAndParts}</td>
                    <td>{order.status}</td>
                  </tr>
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