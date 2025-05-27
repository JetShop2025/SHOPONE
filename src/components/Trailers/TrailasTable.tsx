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
  maxWidth: 420,
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
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Para el modal de captura de renta
  const [showRentModal, setShowRentModal] = useState(false);
  const [rentCliente, setRentCliente] = useState('');
  const [rentFechaRenta, setRentFechaRenta] = useState(dayjs().format('YYYY-MM-DD'));
  const rentFechaEntrega = dayjs(rentFechaRenta).add(1, 'month').format('YYYY-MM-DD');
  const [rentPassword, setRentPassword] = useState('');

  const [rentasHistorial, setRentasHistorial] = useState<any[]>([]);
  const [showRentasModal, setShowRentasModal] = useState(false);

  const [showPartsModal, setShowPartsModal] = useState(false);
  const [selectedWO, setSelectedWO] = useState<number | null>(null);
  const [woParts, setWoParts] = useState<any[]>([]);

  // Determina si hay receives para la traila de la WO seleccionada
  const [receivesForTrailer, setReceivesForTrailer] = useState<any[]>([]);

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

  useEffect(() => {
    if (selected && showModal) {
      axios.get<any[]>(`${API_URL}/work-orders`)
        .then(res => {
          const filtered = res.data
            .filter((wo: any) => wo.trailer === selected.nombre)
            .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
          setWorkOrders(filtered);
        })
        .catch(() => setWorkOrders([]));
    } else {
      setWorkOrders([]);
    }
  }, [selected, showModal]);

  useEffect(() => {
    if (showPartsModal && selectedWO) {
      axios.get(`${API_URL}/work-order-parts/${selectedWO}`)
        .then(res => setWoParts(res.data as any[]))
        .catch(() => setWoParts([]));
    }
  }, [showPartsModal, selectedWO]);

  useEffect(() => {
    if (showPartsModal && selected && selectedWO) {
      axios.get(`${API_URL}/receive?destino_trailer=${selected.nombre}&estatus=PENDING`)
        .then(res => setReceivesForTrailer(res.data as any[]))
        .catch(() => setReceivesForTrailer([]));
    }
  }, [showPartsModal, selected, selectedWO]);

  const hasReceivesForTrailer = receivesForTrailer.length > 0;

  // Cambiar estatus con modal elegante
  const handleChangeStatus = async () => {
    if (!selected) return;
    if (selected.estatus === 'RENTADA') {
      // Cambiar a DISPONIBLE (solo pide password)
      const password = prompt('Ingresa el password para cambiar el estatus:');
      if (!password) return;
      try {
        await axios.put(`${API_URL}/trailas/${selected.nombre}/estatus`, {
          estatus: 'DISPONIBLE',
          password,
          cliente: '',
          fechaRenta: null,
          fechaEntrega: null,
          usuario: localStorage.getItem('username') || ''
        });
        setTrailas(trailas.map(t =>
          t.nombre === selected.nombre
            ? { ...t, estatus: 'DISPONIBLE', cliente: '', fechaRenta: '', fechaEntrega: '' }
            : t
        ));
        setSelected({ ...selected, estatus: 'DISPONIBLE', cliente: '', fechaRenta: '', fechaEntrega: '' });
        alert('Estatus actualizado');
      } catch (err: any) {
        alert(err.response?.data?.error || 'Error al actualizar estatus');
      }
    } else {
      // Cambiar a RENTADA: abre modal elegante
      setRentCliente(selected.cliente || '');
      setRentFechaRenta(dayjs().format('YYYY-MM-DD'));
      setRentPassword('');
      setShowRentModal(true);
    }
  };

  // Confirmar renta desde el modal elegante
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
        fechaEntrega: rentFechaEntrega
      });
      setTrailas(trailas.map(t =>
        t.nombre === selected.nombre
          ? { ...t, estatus: 'RENTADA', cliente: rentCliente, fechaRenta: rentFechaRenta, fechaEntrega: rentFechaEntrega }
          : t
      ));
      setSelected({ ...selected, estatus: 'RENTADA', cliente: rentCliente, fechaRenta: rentFechaRenta, fechaEntrega: rentFechaEntrega });
      setShowRentModal(false);
      alert('Estatus actualizado');
    } catch (err: any) {
      alert(err.response?.data || 'Error al actualizar estatus');
    }
  };

  const fetchRentasHistorial = async (nombre: string) => {
    const res = await axios.get(`${API_URL}/trailas/${nombre}/historial-rentas`);
    setRentasHistorial(res.data as any[]);
    setShowRentasModal(true);
  };

  const trailasPorCliente = (cliente: string) =>
    trailas.filter(t => t.nombre.startsWith(clientePrefijos[cliente]));

  return (
    <div style={{ maxWidth: 1000, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>Trailer Control</h1>

      {/* Selected trailer panel */}
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
            onClick={handleChangeStatus}
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
            onClick={() => setShowModal(true)}
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

      {/* Modal elegante para capturar datos de renta */}
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
                disabled
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #b0c4de', marginTop: 4, background: '#eee' }}
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
                  <th>Customer</th>
                  <th>Rental Date</th>
                  <th>Delivery Date</th>
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
                      <td style={{ color: traila.estatus === 'RENTADA' ? '#d32f2f' : '#388e3c', fontWeight: 700 }}>
                        {traila.estatus}
                      </td>
                      <td>{traila.cliente || '-'}</td>
                      <td>{traila.fechaRenta ? traila.fechaRenta.slice(0, 10) : '-'}</td>
                      <td>{traila.fechaEntrega ? traila.fechaEntrega.slice(0, 10) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* Modal for work order history */}
      {showModal && selected && (
        <div style={modalStyle} onClick={() => setShowModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#1976d2', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>
              Work Order History for {selected.nombre}
            </h2>
            <button onClick={() => setShowModal(false)} style={{ marginBottom: 16, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, float: 'right' }}>✕ Close</button>
            {workOrders.length === 0 ? (
              <div style={{ color: '#888', fontStyle: 'italic' }}>No work orders for this trailer.</div>
            ) : (
              <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
                <thead>
                  <tr style={{ background: '#1976d2', color: '#fff' }}>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>PDF</th>
                    <th>Parts</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map(wo => (
                    <tr key={wo.id}>
                      <td>{wo.id}</td>
                      <td>{wo.date ? wo.date.slice(0, 10) : ''}</td>
                      <td>{wo.status}</td>
                      <td>
                        <a
                          href={`${API_URL}/pdfs/${wo.date ? wo.date.slice(5, 7) + '-' + wo.date.slice(8, 10) + '-' + wo.date.slice(0, 4) : ''}_${wo.id}.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#1976d2', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          View PDF
                        </a>
                      </td>
                      <td>
                        <button
                          style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedWO(wo.id);
                            setShowPartsModal(true);
                          }}
                        >
                          Ver partes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal for rental history */}
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

      {/* Modal for parts used in work order */}
      {showPartsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, minWidth: 400, maxWidth: 600, boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
          }}>
            <h2 style={{ color: '#1976d2', marginBottom: 16 }}>Partes usadas en WO #{selectedWO}</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Cantidad</th>
                  <th>Costo</th>
                  <th>Invoice</th> 
                  <th>Usuario</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {woParts.map((p, idx) => (
                  <tr key={idx}>
                    <td>{p.sku}</td>
                    <td>{p.part_name}</td>
                    <td>{p.qty_used}</td>
                    <td>{p.cost}</td>
                    <td>
                      {p.invoice
                        ? (
                            p.invoiceLink
                              ? <a href={p.invoiceLink} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>{p.invoice}</a>
                              : p.invoice
                          )
                        : '—'
                      }
                    </td>
                    <td>{p.usuario}</td>
                    <td>{p.fecha?.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
                {woParts.length > 0 && !hasReceivesForTrailer && (
                  <tr>
                    <td colSpan={7} style={{ color: '#1976d2', textAlign: 'center', fontStyle: 'italic', paddingTop: 8 }}>
                      Estas partes se tomaron de inventario general (sin compras asociadas a esta traila).
                    </td>
                  </tr>
                )}
                {woParts.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ color: '#888', textAlign: 'center', fontStyle: 'italic', paddingTop: 8 }}>
                      No hay partes registradas para esta orden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <button
              style={{ marginTop: 16, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', cursor: 'pointer' }}
              onClick={() => setShowPartsModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrailasTable;