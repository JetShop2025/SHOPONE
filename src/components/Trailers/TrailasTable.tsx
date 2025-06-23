import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com';
const clientes = ['GALGRE', 'JETGRE', 'PRIGRE', 'RAN100', 'GABGRE'];
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
  maxWidth: 600,
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
};
const clientePrefijos: Record<string, string> = {
  GALGRE: '1-',
  JETGRE: '2-',
  PRIGRE: '3-',
  RAN100: '4-',
  GABGRE: '5-'
};

const TrailasTable: React.FC = () => {
  const [trailas, setTrailas] = useState<any[]>([]);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  // Modals
  const [showRentModal, setShowRentModal] = useState(false);
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [showRentasModal, setShowRentasModal] = useState(false);
  const [showWorkOrdersModal, setShowWorkOrdersModal] = useState(false);

  // Rent form
  const [rentCliente, setRentCliente] = useState('');
  const [rentFechaRenta, setRentFechaRenta] = useState(dayjs().format('YYYY-MM-DD'));
  const [rentFechaEntrega, setRentFechaEntrega] = useState(dayjs().add(1, 'month').format('YYYY-MM-DD'));
  const [rentPassword, setRentPassword] = useState('');

  // Entrega form
  const [nuevaFechaEntrega, setNuevaFechaEntrega] = useState(dayjs().format('YYYY-MM-DD'));

  // Historial
  const [rentasHistorial, setRentasHistorial] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loadingWO, setLoadingWO] = useState(false);
  const [pdfError, setPdfError] = useState<number | null>(null);

  // Para saber qué tráiler se está entregando
  const [trailaAEntregar, setTrailaAEntregar] = useState<any>(null);

  // Cargar trailas
  useEffect(() => {
    let isMounted = true;
    const fetchData = () => {
      axios.get<any[]>(`${API_URL}/trailas`)
        .then(res => { if (isMounted) setTrailas(res.data); })
        .catch(() => { if (isMounted) setTrailas([]); });
    };
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // Cargar historial de rentas
  const fetchRentasHistorial = async (nombre: string) => {
    const res = await axios.get(`${API_URL}/trailas/${nombre}/historial-rentas`);
    setRentasHistorial(res.data as any[]);
    setShowRentasModal(true);
  };

  // Cargar historial de W.O.
  const fetchWorkOrders = async (trailerNombre: string) => {
    setLoadingWO(true);
    setPdfError(null);
    try {
      const res = await axios.get<any[]>(`${API_URL}/trailas/${encodeURIComponent(trailerNombre)}/work-orders-historial`);
      setWorkOrders(res.data);
    } catch {
      setWorkOrders([]);
    }
    setShowWorkOrdersModal(true);
    setLoadingWO(false);
  };

  // Cambiar estatus (rentar o devolver)
  const handleChangeStatus = (traila: any) => {
    if (traila.estatus === 'RENTADA') {
      setTrailaAEntregar(traila);
      setNuevaFechaEntrega(traila.fechaEntrega ? traila.fechaEntrega.slice(0, 10) : dayjs().format('YYYY-MM-DD'));
      setShowEntregaModal(true);
    } else {
      setSelected(traila);
      setRentCliente('');
      setRentFechaRenta(dayjs().format('YYYY-MM-DD'));
      setRentFechaEntrega(dayjs().add(1, 'month').format('YYYY-MM-DD'));
      setRentPassword('');
      setShowRentModal(true);
    }
  };

  // Confirmar renta
  const handleConfirmRent = async () => {
    if (!rentPassword) {
      alert('Debes ingresar el password');
      return;
    }
    try {
      await axios.put(`${API_URL}/trailas/${selected.nombre}/estatus`, {
        estatus: 'RENTADA',
        password: rentPassword,
        cliente: rentCliente,
        fechaRenta: rentFechaRenta,
        fechaEntrega: rentFechaEntrega,
        usuario: localStorage.getItem('username') || ''
      });
      setShowRentModal(false);
      alert('Estatus actualizado');
    } catch (err: any) {
      alert(err.response?.data || 'Error al actualizar estatus');
    }
  };

  // Confirmar entrega
  const handleConfirmEntrega = async () => {
    if (!trailaAEntregar) return;
    const fechaEntregaFormatted = dayjs(nuevaFechaEntrega).format('YYYY-MM-DD');
    await axios.put(`${API_URL}/trailas/${trailaAEntregar.nombre}/estatus`, {
      estatus: 'DISPONIBLE',
      password: '6214',
      fechaEntrega: fechaEntregaFormatted,
      usuario: localStorage.getItem('username') || ''
    });
    setShowEntregaModal(false);
    setTrailaAEntregar(null);
    alert('Tráiler marcado como disponible');
  };

  const trailasPorCliente = (cliente: string) =>
    trailas.filter(t => t.nombre.startsWith(clientePrefijos[cliente]));

  const handlePdfClick = async (woId: number, e: React.MouseEvent) => {
    e.preventDefault();
    setPdfError(null);
    try {
      await axios.head(`${API_URL}/work-orders/${woId}/pdf`);
      window.open(`${API_URL}/work-orders/${woId}/pdf`, '_blank');
    } catch {
      setPdfError(woId);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>Trailer Control</h1>

      {/* Panel de tráiler seleccionado */}
      {selected && (
        <div style={{ marginBottom: 24, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
          <h2 style={{ color: '#1976d2', fontWeight: 700, fontSize: 22 }}>
            Selected Trailer: {selected.nombre}
          </h2>
          <div style={{ marginBottom: 16 }}>
            <strong>Current Status:</strong>{' '}
            <span style={{ color: selected.estatus === 'RENTADA' ? '#d32f2f' : '#388e3c', fontWeight: 700 }}>
              {selected.estatus === 'RENTADA' ? 'RENTED' : 'AVAILABLE'}
            </span>
          </div>
          <button
            onClick={() => handleChangeStatus(selected)}
            style={{
              background: selected.estatus === 'RENTADA' ? '#388e3c' : '#d32f2f',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 28px',
              fontWeight: 700,
              fontSize: 18,
              marginBottom: 16,
              cursor: 'pointer'
            }}
          >
            Mark as {selected.estatus === 'RENTADA' ? 'AVAILABLE' : 'RENTED'}
          </button>
          <button
            onClick={() => fetchWorkOrders(selected.nombre)}
            style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 28px',
              fontWeight: 700,
              fontSize: 18,
              marginLeft: 16,
              cursor: 'pointer'
            }}
          >
            View Work Order History
          </button>
          <button
            onClick={() => fetchRentasHistorial(selected.nombre)}
            style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 28px',
              fontWeight: 700,
              fontSize: 18,
              marginLeft: 16,
              cursor: 'pointer'
            }}
          >
            View Rental History
          </button>
        </div>
      )}

      {/* Tablas agrupadas por cliente */}
      {clientes.map(cliente => (
        <div key={cliente} style={{ marginBottom: 16 }}>
          <div
            style={{
              background: '#1976d2',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 20
            }}
            onClick={() => setExpandedCliente(expandedCliente === cliente ? null : cliente)}
          >
            {cliente} {expandedCliente === cliente ? '▲' : '▼'}
          </div>
          {expandedCliente === cliente && (
            <table style={{ width: '100%', background: '#fff', borderRadius: 12, marginTop: 8, marginBottom: 8 }}>
              <thead>
                <tr style={{ background: '#e3f2fd', color: '#1976d2' }}>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trailasPorCliente(cliente).map(traila => {
                  // Cálculo de colores para vencidas y por vencer
                  let rowStyle: React.CSSProperties = {};
                  if (traila.fechaEntrega) {
                    const hoy = dayjs();
                    const entrega = dayjs(traila.fechaEntrega);
                    const diff = entrega.diff(hoy, 'day');
                    if (diff < 0) rowStyle.background = '#ffcccc'; // Vencida (rojo claro)
                    else if (diff <= 3) rowStyle.background = '#fff3cd'; // Por vencer (amarillo claro)
                  }
                  return (
                    <tr
                      key={traila.nombre}
                      style={{
                        ...rowStyle,
                        background: selected?.nombre === traila.nombre ? '#e3f2fd' : rowStyle.background,
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelected(traila)}
                    >
                      <td>{traila.nombre}</td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 12,
                          background: traila.estatus === 'RENTADA' ? '#ffe0e0' : '#e0ffe0',
                          color: traila.estatus === 'RENTADA' ? '#d32f2f' : '#388e3c',
                          fontWeight: 700,
                          fontSize: 14
                        }}>
                          {traila.estatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* Modal para rentar */}
      {showRentModal && (
        <div style={modalStyle} onClick={() => setShowRentModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#1976d2', fontWeight: 700, marginBottom: 18 }}>Rent Trailer</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 600 }}>Customer:</label>
              <input
                type="text"
                value={rentCliente}
                onChange={e => setRentCliente(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #b0c4de', marginTop: 4 }}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 600 }}>Rental Start Date:</label>
              <input
                type="date"
                value={rentFechaRenta}
                onChange={e => setRentFechaRenta(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #b0c4de', marginTop: 4 }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 600 }}>Expected Delivery Date:</label>
              <input
                type="date"
                value={rentFechaEntrega}
                onChange={e => setRentFechaEntrega(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #b0c4de', marginTop: 4 }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 600 }}>Password:</label>
              <input
                type="password"
                value={rentPassword}
                onChange={e => setRentPassword(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #b0c4de', marginTop: 4 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={handleConfirmRent}
                style={{
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 28px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                Confirm Rent
              </button>
              <button
                onClick={() => setShowRentModal(false)}
                style={{
                  background: '#fff',
                  color: '#1976d2',
                  border: '1.5px solid #1976d2',
                  borderRadius: 6,
                  padding: '10px 28px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para entrega */}
      {showEntregaModal && (
        <div style={modalStyle} onClick={() => setShowEntregaModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#1976d2', fontWeight: 700, marginBottom: 18 }}>Confirm Trailer Delivery</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 600 }}>New Delivery Date:</label>
              <input
                type="date"
                value={nuevaFechaEntrega}
                onChange={e => setNuevaFechaEntrega(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #b0c4de', marginTop: 4 }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={handleConfirmEntrega}
                style={{
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 28px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                Confirm Delivery
              </button>
              <button
                onClick={() => setShowEntregaModal(false)}
                style={{
                  background: '#fff',
                  color: '#1976d2',
                  border: '1.5px solid #1976d2',
                  borderRadius: 6,
                  padding: '10px 28px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial de rentas */}
      {showRentasModal && (
        <div style={modalStyle} onClick={() => setShowRentasModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#1976d2', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>
              Rental History for {selected?.nombre}
            </h2>
            <button onClick={() => setShowRentasModal(false)} style={{ marginBottom: 16, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, float: 'right' }}>✕ Close</button>
            {rentasHistorial.length === 0 ? (
              <div style={{ color: '#888', fontStyle: 'italic' }}>No rental history for this trailer.</div>
            ) : (
              <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
                <thead>
                  <tr style={{ background: '#1976d2', color: '#fff' }}>
                    <th>Customer</th>
                    <th>Rental Date</th>
                    <th>Delivery Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rentasHistorial.map((renta, index) => (
                    <tr key={index}>
                      <td>{renta.cliente}</td>
                      <td>{renta.fecha_renta ? dayjs(renta.fecha_renta).format('MM/DD/YYYY') : '-'}</td>
                      <td>{renta.fecha_entrega ? dayjs(renta.fecha_entrega).format('MM/DD/YYYY') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal historial de Work Orders */}
      {showWorkOrdersModal && selected && (
        <div style={modalStyle} onClick={() => setShowWorkOrdersModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ color: '#1976d2', fontWeight: 700, fontSize: 22, margin: 0 }}>
                Work Order History for {selected.nombre}
              </h2>
              <button onClick={() => setShowWorkOrdersModal(false)} style={{ marginLeft: 'auto', color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 22 }}>
                ✕
              </button>
            </div>
            {loadingWO ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div className="loader" />
                <div style={{ color: '#1976d2', marginTop: 12 }}>Loading work orders...</div>
              </div>
            ) : workOrders.length === 0 ? (
              <div style={{ color: '#888', fontStyle: 'italic', padding: 24 }}>No work orders for this trailer.</div>
            ) : (
              <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
                <thead>
                  <tr style={{ background: '#1976d2', color: '#fff' }}>
                    <th>ID</th>
                    <th>ID CLASSIC</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Mechanic(s)</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map(wo => (
                    <tr key={wo.id}>
                      <td>{wo.id}</td>
                      <td>{wo.idClassic || '-'}</td>
                      <td>{wo.date ? dayjs(wo.date).format('MM/DD/YYYY') : '-'}</td>
                      <td>{wo.status}</td>
                      <td>{wo.mechanic}</td>
                      <td>
                        <a
                          href={`${API_URL}/work-orders/${wo.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#d32f2f', textDecoration: 'underline', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={e => handlePdfClick(wo.id, e)}
                        >
                          
                        </a>
                        {pdfError === wo.id && (
                          <div style={{ color: '#d32f2f', fontSize: 12 }}>PDF not found for this W.O.</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrailasTable;
