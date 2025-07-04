import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';
const clientes = ['GALGRE', 'JETGRE', 'PRIGRE', 'RAN100', 'GABGRE'];

interface Traila {
  id: number;
  nombre: string;
  estatus: string;
  cliente?: string;
  fecha_renta?: string;
  fecha_devolucion?: string;
  tipo?: string;
  ubicacion?: string;
}

interface WorkOrder {
  id: number;
  numero_orden: string;
  traila_id: number;
  fecha: string;
  estatus: string;
  descripcion?: string;
}

const TrailasTable: React.FC = () => {
  const [trailas, setTrailas] = useState<Traila[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTraila, setSelectedTraila] = useState<Traila | null>(null);
  const [showRentalModal, setShowRentalModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Rental form state
  const [rentalForm, setRentalForm] = useState({
    cliente: '',
    fecha_renta: '',
    fecha_devolucion: '',
    observaciones: ''
  });
  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [trailasRes, workOrdersRes] = await Promise.all([
          axios.get<Traila[]>(`${API_URL}/trailas`),
          axios.get<WorkOrder[]>(`${API_URL}/work-orders`)
        ]);
        
        // Ensure data is always an array
        const trailasData = Array.isArray(trailasRes.data) ? trailasRes.data : [];
        const workOrdersData = Array.isArray(workOrdersRes.data) ? workOrdersRes.data : [];
        
        setTrailas(trailasData);
        setWorkOrders(workOrdersData);
        console.log(`✅ Loaded ${trailasData.length} trailas and ${workOrdersData.length} work orders`);
      } catch (error) {
        console.error('Error fetching data:', error);
        setTrailas([]);
        setWorkOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);
  // Filter and search logic with safety check
  const filteredTrailas = Array.isArray(trailas) ? trailas.filter(traila => {
    const matchesFilter = filter === 'ALL' || traila.estatus === filter;
    const matchesSearch = traila.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (traila.cliente || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  }) : [];

  // Handle rental
  const handleRental = async () => {
    if (!selectedTraila || !rentalForm.cliente || !rentalForm.fecha_renta) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    try {
      await axios.put(`${API_URL}/trailas/${selectedTraila.id}/rent`, rentalForm);
      setShowRentalModal(false);
      setRentalForm({ cliente: '', fecha_renta: '', fecha_devolucion: '', observaciones: '' });
      // Refresh data
      const response = await axios.get<Traila[]>(`${API_URL}/trailas`);
      setTrailas(response.data || []);
    } catch (error) {
      console.error('Error renting trailer:', error);
      alert('Error al rentar el trailer');
    }
  };

  // Handle return
  const handleReturn = async (traila: Traila) => {
    if (window.confirm('¿Está seguro que desea devolver este trailer?')) {
      try {
        await axios.put(`${API_URL}/trailas/${traila.id}/return`);
        // Refresh data
        const response = await axios.get<Traila[]>(`${API_URL}/trailas`);
        setTrailas(response.data || []);
      } catch (error) {
        console.error('Error returning trailer:', error);
        alert('Error al devolver el trailer');
      }
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DISPONIBLE': return '#4caf50';
      case 'RENTADO': return '#ff9800';
      case 'MANTENIMIENTO': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  // Get status badge
  const StatusBadge = ({ status }: { status: string }) => (
    <span style={{
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      color: 'white',
      backgroundColor: getStatusColor(status),
      textTransform: 'uppercase'
    }}>
      {status}
    </span>
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e3f2fd',
            borderTop: '4px solid #1976d2',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#1976d2', fontSize: '18px', margin: 0 }}>Cargando trailers...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '24px',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#1976d2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px'
          }}>
            <span style={{ fontSize: '24px' }}>🚛</span>
          </div>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1976d2',
              margin: '0',
              letterSpacing: '1px'
            }}>
              TRAILER CONTROL
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
              Sistema de Control de Trailers - {filteredTrailas.length} trailers
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#1565c0'}
            onMouseOut={(e) => e.currentTarget.style.background = '#1976d2'}
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '4px', display: 'block' }}>
              Filtrar por Estado:
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                minWidth: '150px'
              }}
            >
              <option value="ALL">Todos</option>
              <option value="DISPONIBLE">Disponible</option>
              <option value="RENTADO">Rentado</option>
              <option value="MANTENIMIENTO">Mantenimiento</option>
            </select>
          </div>
          
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '4px', display: 'block' }}>
              Buscar:
            </label>
            <input
              type="text"
              placeholder="Buscar por nombre o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Trailers Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px'
      }}>
        {filteredTrailas.map((traila) => (
          <div
            key={traila.id}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: '1px solid #f0f0f0',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            }}
          >
            {/* Trailer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1976d2',
                margin: '0'
              }}>
                {traila.nombre}
              </h3>
              <StatusBadge status={traila.estatus} />
            </div>

            {/* Trailer Info */}
            <div style={{ marginBottom: '16px' }}>
              {traila.cliente && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#666' }}>Cliente: </span>
                  <span style={{ color: '#333' }}>{traila.cliente}</span>
                </div>
              )}
              {traila.fecha_renta && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#666' }}>Fecha Renta: </span>
                  <span style={{ color: '#333' }}>{dayjs(traila.fecha_renta).format('DD/MM/YYYY')}</span>
                </div>
              )}
              {traila.fecha_devolucion && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#666' }}>Fecha Devolución: </span>
                  <span style={{ color: '#333' }}>{dayjs(traila.fecha_devolucion).format('DD/MM/YYYY')}</span>
                </div>
              )}
              {traila.ubicacion && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#666' }}>Ubicación: </span>
                  <span style={{ color: '#333' }}>{traila.ubicacion}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {traila.estatus === 'DISPONIBLE' && (
                <button
                  onClick={() => {
                    setSelectedTraila(traila);
                    setShowRentalModal(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  📋 Rentar
                </button>
              )}
              
              {traila.estatus === 'RENTADO' && (
                <button
                  onClick={() => handleReturn(traila)}
                  style={{
                    padding: '8px 16px',
                    background: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  ↩️ Devolver
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedTraila(traila);
                  setShowHistoryModal(true);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                📊 Historial
              </button>

              <button
                onClick={() => {
                  setSelectedTraila(traila);
                  setShowWorkOrderModal(true);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#9c27b0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                🔧 O.T.
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTrailas.length === 0 && (
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          <p style={{ fontSize: '18px', color: '#666', margin: '0' }}>
            No se encontraron trailers con los filtros seleccionados
          </p>
        </div>
      )}

      {/* Rental Modal */}
      {showRentalModal && selectedTraila && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ color: '#1976d2', marginBottom: '24px' }}>
              Rentar Trailer: {selectedTraila.nombre}
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Cliente *
              </label>
              <select
                value={rentalForm.cliente}
                onChange={(e) => setRentalForm({...rentalForm, cliente: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                required
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map(cliente => (
                  <option key={cliente} value={cliente}>{cliente}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Fecha de Renta *
              </label>
              <input
                type="date"
                value={rentalForm.fecha_renta}
                onChange={(e) => setRentalForm({...rentalForm, fecha_renta: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Fecha de Devolución Estimada
              </label>
              <input
                type="date"
                value={rentalForm.fecha_devolucion}
                onChange={(e) => setRentalForm({...rentalForm, fecha_devolucion: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Observaciones
              </label>
              <textarea
                value={rentalForm.observaciones}
                onChange={(e) => setRentalForm({...rentalForm, observaciones: e.target.value})}
                placeholder="Observaciones adicionales..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRentalModal(false)}
                style={{
                  padding: '12px 24px',
                  background: '#f5f5f5',
                  color: '#666',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRental}
                style={{
                  padding: '12px 24px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Confirmar Renta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedTraila && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ color: '#1976d2', marginBottom: '24px' }}>
              Historial de Rentas: {selectedTraila.nombre}
            </h2>
            
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>Historial de rentas estará disponible próximamente</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  padding: '12px 24px',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Work Order Modal */}
      {showWorkOrderModal && selectedTraila && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ color: '#1976d2', marginBottom: '24px' }}>
              Órdenes de Trabajo: {selectedTraila.nombre}
            </h2>
            
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>Historial de órdenes de trabajo estará disponible próximamente</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowWorkOrderModal(false)}
                style={{
                  padding: '12px 24px',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for loading animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default TrailasTable;
