import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';
const clientes = ['GALGRE', 'JETGRE', 'PRIGRE', 'RAN100', 'GABGRE'];

const modalStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(8px)'
};

const modalContentStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 20,
  padding: 32,
  minWidth: 480,
  maxWidth: 800,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.2)',
  position: 'relative'
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
    <div style={{ 
      maxWidth: 1200, 
      margin: '0 auto', 
      padding: 24,
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      {/* Header moderno */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 32,
        background: 'white',
        padding: 24,
        borderRadius: 16,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#1976d2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12
        }}>
          <span style={{ fontSize: 24 }}>🚛</span>
        </div>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#1976d2',
          margin: 0,
          letterSpacing: 2
        }}>
          TRAILER CONTROL
        </h1>
        <div style={{ marginLeft: 'auto', fontSize: 14, color: '#666' }}>
          Gestión de Rentas y Órdenes de Trabajo
        </div>
      </div>

      {/* Panel de trailer seleccionado - Diseño moderno */}
      {selected && (
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          border: '2px solid #e3f2fd'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20
          }}>
            <div>
              <h2 style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#1976d2',
                margin: 0,
                marginBottom: 8
              }}>
                🚛 {selected.nombre}
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ color: '#666', fontSize: 16 }}>Estado actual:</span>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  background: selected.estatus === 'RENTADA' ? '#ffebee' : '#e8f5e8',
                  color: selected.estatus === 'RENTADA' ? '#d32f2f' : '#388e3c',
                  border: `2px solid ${selected.estatus === 'RENTADA' ? '#d32f2f' : '#388e3c'}`
                }}>
                  {selected.estatus === 'RENTADA' ? '🔴 RENTADO' : '🟢 DISPONIBLE'}
                </span>
              </div>
            </div>
          </div>

          {/* Botones de acción modernos */}
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => handleChangeStatus(selected)}
              style={{
                padding: '12px 24px',
                background: selected.estatus === 'RENTADA' 
                  ? 'linear-gradient(135deg, #4caf50, #388e3c)' 
                  : 'linear-gradient(135deg, #f44336, #d32f2f)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 3px 12px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {selected.estatus === 'RENTADA' ? '📋 Marcar como DISPONIBLE' : '🏃 Marcar como RENTADO'}
            </button>

            <button
              onClick={() => fetchWorkOrders(selected.nombre)}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #ff9800, #f57c00)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 3px 12px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              🔧 Historial de Work Orders
            </button>

            <button
              onClick={() => fetchRentasHistorial(selected.nombre)}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #9c27b0, #7b1fa2)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 3px 12px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              📊 Historial de Rentas
            </button>
          </div>
        </div>
      )}

      {/* Tablas agrupadas por cliente - Diseño moderno */}
      {clientes.map(cliente => (
        <div key={cliente} style={{
          marginBottom: 20,
          background: 'white',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
        }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #1976d2, #1565c0)',
              color: 'white',
              padding: '16px 24px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setExpandedCliente(expandedCliente === cliente ? null : cliente)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🏢</span>
              <span>{cliente}</span>
              <span style={{
                padding: '2px 8px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 12,
                fontSize: 14
              }}>
                {trailasPorCliente(cliente).length} trailers
              </span>
            </div>
            <span style={{ 
              fontSize: 20,
              transform: expandedCliente === cliente ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}>
              ▼
            </span>
          </div>
          
          {expandedCliente === cliente && (
            <div style={{ padding: 0 }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                background: 'white'
              }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{
                      padding: '16px 20px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1976d2',
                      borderBottom: '2px solid #e3f2fd'
                    }}>
                      🚛 Trailer
                    </th>
                    <th style={{
                      padding: '16px 20px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1976d2',
                      borderBottom: '2px solid #e3f2fd'
                    }}>
                      📊 Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trailasPorCliente(cliente).map(traila => {
                    // Cálculo de colores para vencidas y por vencer
                    let alertStyle: React.CSSProperties = {};
                    let alertBadge = '';
                    
                    if (traila.fechaEntrega) {
                      const hoy = dayjs();
                      const entrega = dayjs(traila.fechaEntrega);
                      const diff = entrega.diff(hoy, 'day');
                      if (diff < 0) {
                        alertStyle.background = '#ffebee';
                        alertStyle.borderLeft = '4px solid #f44336';
                        alertBadge = '⚠️ VENCIDA';
                      } else if (diff <= 3) {
                        alertStyle.background = '#fff8e1';
                        alertStyle.borderLeft = '4px solid #ff9800';
                        alertBadge = '⏰ POR VENCER';
                      }
                    }
                    
                    return (
                      <tr
                        key={traila.nombre}
                        style={{
                          ...alertStyle,
                          background: selected?.nombre === traila.nombre ? '#e3f2fd' : alertStyle.background,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                        onClick={() => setSelected(traila)}
                        onMouseEnter={(e) => {
                          if (selected?.nombre !== traila.nombre) {
                            e.currentTarget.style.background = '#f8f9fa';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selected?.nombre !== traila.nombre) {
                            e.currentTarget.style.background = (alertStyle.background as string) || 'white';
                          }
                        }}
                      >
                        <td style={{
                          padding: '16px 20px',
                          fontWeight: 600,
                          color: '#1976d2',
                          fontSize: 16
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{traila.nombre}</span>
                            {alertBadge && (
                              <span style={{
                                fontSize: 12,
                                padding: '2px 6px',
                                background: alertBadge.includes('VENCIDA') ? '#ffcdd2' : '#ffe0b2',
                                color: alertBadge.includes('VENCIDA') ? '#c62828' : '#ef6c00',
                                borderRadius: 8,
                                fontWeight: 600
                              }}>
                                {alertBadge}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            borderRadius: 16,
                            background: traila.estatus === 'RENTADA' 
                              ? 'linear-gradient(135deg, #ffebee, #ffcdd2)' 
                              : 'linear-gradient(135deg, #e8f5e8, #c8e6c9)',
                            color: traila.estatus === 'RENTADA' ? '#c62828' : '#2e7d32',
                            fontWeight: 700,
                            fontSize: 14,
                            border: `2px solid ${traila.estatus === 'RENTADA' ? '#ef5350' : '#66bb6a'}`
                          }}>
                            {traila.estatus === 'RENTADA' ? '🔴' : '🟢'}
                            {traila.estatus === 'RENTADA' ? 'RENTADO' : 'DISPONIBLE'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Modal para rentar - Diseño moderno */}
      {showRentModal && (
        <div style={modalStyle} onClick={() => setShowRentModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            {/* Header del modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: '2px solid #e3f2fd'
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1976d2, #1565c0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <span style={{ fontSize: 20, color: 'white' }}>🏃</span>
              </div>
              <div>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#1976d2',
                  margin: 0,
                  marginBottom: 4
                }}>
                  Rentar Trailer
                </h2>
                <p style={{
                  margin: 0,
                  color: '#666',
                  fontSize: 14
                }}>
                  Completa la información para rentar el trailer {selected?.nombre}
                </p>
              </div>
              <button
                onClick={() => setShowRentModal(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  color: '#999',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Formulario */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{
                  display: 'block',
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 8,
                  fontSize: 14
                }}>
                  👤 Cliente:
                </label>
                <input
                  type="text"
                  value={rentCliente}
                  onChange={e => setRentCliente(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '2px solid #e0e0e0',
                    fontSize: 16,
                    transition: 'border-color 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1976d2'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  autoFocus
                  placeholder="Nombre del cliente"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 8,
                  fontSize: 14
                }}>
                  📅 Fecha de inicio de renta:
                </label>
                <input
                  type="date"
                  value={rentFechaRenta}
                  onChange={e => setRentFechaRenta(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '2px solid #e0e0e0',
                    fontSize: 16,
                    transition: 'border-color 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1976d2'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 8,
                  fontSize: 14
                }}>
                  📆 Fecha esperada de entrega:
                </label>
                <input
                  type="date"
                  value={rentFechaEntrega}
                  onChange={e => setRentFechaEntrega(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '2px solid #e0e0e0',
                    fontSize: 16,
                    transition: 'border-color 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1976d2'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 8,
                  fontSize: 14
                }}>
                  🔐 Password de autorización:
                </label>
                <input
                  type="password"
                  value={rentPassword}
                  onChange={e => setRentPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '2px solid #e0e0e0',
                    fontSize: 16,
                    transition: 'border-color 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1976d2'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  placeholder="Password requerido"
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 16,
              marginTop: 32,
              paddingTop: 20,
              borderTop: '1px solid #f0f0f0'
            }}>
              <button
                onClick={() => setShowRentModal(false)}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #e0e0e0',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#ccc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRent}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #f44336, #d32f2f)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(244, 67, 54, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(244, 67, 54, 0.3)';
                }}
              >
                🏃 Confirmar Renta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para entrega - Diseño moderno */}
      {showEntregaModal && (
        <div style={modalStyle} onClick={() => setShowEntregaModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            {/* Header del modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: '2px solid #e3f2fd'
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4caf50, #388e3c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <span style={{ fontSize: 20, color: 'white' }}>📋</span>
              </div>
              <div>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#4caf50',
                  margin: 0,
                  marginBottom: 4
                }}>
                  Confirmar Entrega
                </h2>
                <p style={{
                  margin: 0,
                  color: '#666',
                  fontSize: 14
                }}>
                  Actualizar fecha de entrega del trailer {trailaAEntregar?.nombre}
                </p>
              </div>
              <button
                onClick={() => setShowEntregaModal(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  color: '#999',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Información del trailer */}
            <div style={{
              background: '#f8f9fa',
              padding: 16,
              borderRadius: 12,
              marginBottom: 24,
              border: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#495057' }}>🚛 Trailer:</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1976d2' }}>{trailaAEntregar?.nombre}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: '#666' }}>Estado actual:</span>
                <span style={{
                  padding: '2px 8px',
                  background: '#ffebee',
                  color: '#d32f2f',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  🔴 RENTADO
                </span>
              </div>
            </div>

            {/* Formulario */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: 600,
                color: '#333',
                marginBottom: 8,
                fontSize: 14
              }}>
                📅 Nueva fecha de entrega:
              </label>
              <input
                type="date"
                value={nuevaFechaEntrega}
                onChange={e => setNuevaFechaEntrega(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '2px solid #e0e0e0',
                  fontSize: 16,
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#4caf50'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                autoFocus
              />
              <p style={{
                margin: '8px 0 0 0',
                fontSize: 12,
                color: '#666',
                fontStyle: 'italic'
              }}>
                💡 Esta fecha registrará cuándo realmente se entregó el trailer
              </p>
            </div>

            {/* Botones de acción */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 16,
              marginTop: 32,
              paddingTop: 20,
              borderTop: '1px solid #f0f0f0'
            }}>
              <button
                onClick={() => setShowEntregaModal(false)}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #e0e0e0',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#ccc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmEntrega}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #4caf50, #388e3c)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
                }}
              >
                📋 Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial de rentas - Diseño moderno */}
      {showRentasModal && (
        <div style={modalStyle} onClick={() => setShowRentasModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            {/* Header del modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: '2px solid #e3f2fd'
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1976d2, #1565c0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <span style={{ fontSize: 20, color: 'white' }}>📊</span>
              </div>
              <div>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#1976d2',
                  margin: 0,
                  marginBottom: 4
                }}>
                  Historial de Rentas
                </h2>
                <p style={{
                  margin: 0,
                  color: '#666',
                  fontSize: 14
                }}>
                  🚛 Trailer: <strong>{selected?.nombre}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowRentasModal(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  color: '#999',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Contenido del historial */}
            {rentasHistorial.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 40,
                background: '#f8f9fa',
                borderRadius: 12,
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div style={{ 
                  color: '#666', 
                  fontSize: 16,
                  fontWeight: 600
                }}>
                  No hay historial de rentas
                </div>
                <div style={{ 
                  color: '#999', 
                  fontSize: 14,
                  marginTop: 4
                }}>
                  Este trailer no tiene rentas registradas
                </div>
              </div>
            ) : (
              <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                border: '2px solid #e3f2fd'
              }}>
                {/* Header de la tabla */}
                <div style={{
                  background: 'linear-gradient(135deg, #1976d2, #1565c0)',
                  color: 'white',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  padding: '16px 20px',
                  fontSize: 14,
                  fontWeight: 600
                }}>
                  <div>👤 Cliente</div>
                  <div>📅 Fecha de Renta</div>
                  <div>🚚 Fecha de Entrega</div>
                </div>
                
                {/* Filas de la tabla */}
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {rentasHistorial.map((renta, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        padding: '16px 20px',
                        borderBottom: index < rentasHistorial.length - 1 ? '1px solid #f0f0f0' : 'none',
                        backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white'}
                    >
                      <div style={{ 
                        fontWeight: 600, 
                        color: '#333' 
                      }}>
                        {renta.cliente || '-'}
                      </div>
                      <div style={{ 
                        color: '#666',
                        fontFamily: 'monospace'
                      }}>
                        {renta.fecha_renta ? dayjs(renta.fecha_renta).format('DD/MM/YYYY') : '-'}
                      </div>
                      <div style={{ 
                        color: '#666',
                        fontFamily: 'monospace'
                      }}>
                        {renta.fecha_entrega ? dayjs(renta.fecha_entrega).format('DD/MM/YYYY') : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer con información */}
            <div style={{
              marginTop: 20,
              padding: 16,
              background: '#f8f9fa',
              borderRadius: 12,
              fontSize: 13,
              color: '#666',
              textAlign: 'center'
            }}>
              📈 Total de rentas: <strong>{rentasHistorial.length}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial de Work Orders - Diseño moderno */}
      {showWorkOrdersModal && selected && (
        <div style={modalStyle} onClick={() => setShowWorkOrdersModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            {/* Header del modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: '2px solid #e3f2fd'
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ff9800, #f57c00)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <span style={{ fontSize: 20, color: 'white' }}>🔧</span>
              </div>
              <div>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#ff9800',
                  margin: 0,
                  marginBottom: 4
                }}>
                  Historial de Work Orders
                </h2>
                <p style={{
                  margin: 0,
                  color: '#666',
                  fontSize: 14
                }}>
                  🚛 Trailer: <strong>{selected.nombre}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowWorkOrdersModal(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  color: '#999',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Contenido del historial */}
            {loadingWO ? (
              <div style={{
                textAlign: 'center',
                padding: 40,
                background: '#f8f9fa',
                borderRadius: 12
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #ff9800',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }}></div>
                <div style={{ 
                  color: '#ff9800', 
                  fontWeight: 600,
                  fontSize: 16
                }}>
                  Cargando work orders...
                </div>
              </div>
            ) : workOrders.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 40,
                background: '#f8f9fa',
                borderRadius: 12,
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
                <div style={{ 
                  color: '#666', 
                  fontSize: 16,
                  fontWeight: 600
                }}>
                  No hay work orders
                </div>
                <div style={{ 
                  color: '#999', 
                  fontSize: 14,
                  marginTop: 4
                }}>
                  Este trailer no tiene work orders registradas
                </div>
              </div>
            ) : (
              <div style={{
                background: 'white',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                border: '2px solid #e3f2fd'
              }}>
                {/* Header de la tabla */}
                <div style={{
                  background: 'linear-gradient(135deg, #ff9800, #f57c00)',
                  color: 'white',
                  display: 'grid',
                  gridTemplateColumns: '80px 100px 120px 100px 1fr 100px',
                  padding: '16px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  gap: 16
                }}>
                  <div>🆔 ID</div>
                  <div>📋 ID CLASSIC</div>
                  <div>📅 Fecha</div>
                  <div>📊 Estado</div>
                  <div>👨‍🔧 Mecánico(s)</div>
                  <div>📄 PDF</div>
                </div>
                
                {/* Filas de la tabla */}
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {workOrders.map((wo, index) => (
                    <div
                      key={wo.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 100px 120px 100px 1fr 100px',
                        padding: '16px 20px',
                        borderBottom: index < workOrders.length - 1 ? '1px solid #f0f0f0' : 'none',
                        backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                        transition: 'background-color 0.2s ease',
                        gap: 16,
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff3e0'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white'}
                    >
                      <div style={{ 
                        fontWeight: 600, 
                        color: '#333',
                        fontFamily: 'monospace'
                      }}>
                        {wo.id}
                      </div>
                      <div style={{ 
                        color: '#666',
                        fontFamily: 'monospace'
                      }}>
                        {wo.idClassic || '-'}
                      </div>
                      <div style={{ 
                        color: '#666',
                        fontFamily: 'monospace'
                      }}>
                        {wo.date ? dayjs(wo.date).format('DD/MM/YYYY') : '-'}
                      </div>
                      <div>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          background: wo.status === 'COMPLETED' ? '#e8f5e8' : 
                                    wo.status === 'PENDING' ? '#fff3e0' : '#f5f5f5',
                          color: wo.status === 'COMPLETED' ? '#2e7d32' : 
                                wo.status === 'PENDING' ? '#f57c00' : '#666'
                        }}>
                          {wo.status}
                        </span>
                      </div>
                      <div style={{ 
                        color: '#333',
                        fontWeight: 500
                      }}>
                        {wo.mechanic || '-'}
                      </div>
                      <div>
                        <a
                          href={`${API_URL}/work-orders/${wo.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ 
                            color: '#d32f2f', 
                            textDecoration: 'none', 
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: '#ffebee',
                            border: '1px solid #ffcdd2',
                            fontSize: 12,
                            transition: 'all 0.2s ease'
                          }}
                          onClick={e => handlePdfClick(wo.id, e)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ffcdd2';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ffebee';
                            e.currentTarget.style.transform = 'translateY(0px)';
                          }}
                        >
                          📄 Ver
                        </a>
                        {pdfError === wo.id && (
                          <div style={{ 
                            color: '#d32f2f', 
                            fontSize: 11,
                            marginTop: 4,
                            textAlign: 'center'
                          }}>
                            PDF no encontrado
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer con información */}
            <div style={{
              marginTop: 20,
              padding: 16,
              background: '#f8f9fa',
              borderRadius: 12,
              fontSize: 13,
              color: '#666',
              textAlign: 'center'
            }}>
              🔧 Total de work orders: <strong>{workOrders.length}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrailasTable;
