import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shipone-onrender.com/api';

// Different clients for trailer rental vs regular clients
const rentalClients = ['AMAZON', 'WALMART', 'HOME DEPOT', 'FEDEX', 'UPS', 'TARGET'];
const regularClients = ['GALGRE', 'JETGRE', 'PRIGRE', 'RAN100', 'GABGRE'];

// Client-specific trailer ranges
const clientTrailerRanges: { [key: string]: { min: number; max: number } } = {
  'GALGRE': { min: 1, max: 99 },
  'JETGRE': { min: 100, max: 199 },
  'PRIGRE': { min: 200, max: 299 },
  'RAN100': { min: 300, max: 399 },
  'GABGRE': { min: 400, max: 499 }
};

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
  const [showRentalModal, setShowRentalModal] = useState<boolean>(false);  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState<boolean>(false);
  const [rentalHistory, setRentalHistory] = useState<any[]>([]);
  const [workOrderHistory, setWorkOrderHistory] = useState<any[]>([]);  // Client-based filtering
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filter, setFilter] = useState<string>('ALL');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Rental form state
  const [rentalForm, setRentalForm] = useState({
    cliente: '', // No preselected client
    fecha_renta: '',
    fecha_devolucion: '',
    observaciones: ''
  });

  // Return form state
  const [returnForm, setReturnForm] = useState({
    fecha_devolucion: '',
    observaciones: '',
    condicion: ''
  });  // Fetch data
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
        console.log(`✅ Loaded ${trailasData.length} trailers and ${workOrdersData.length} work orders`);
      } catch (error) {
        console.error('Error fetching data:', error);
        setTrailas([]);
        setWorkOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  // Get unique clients from trailers
  const getUniqueClients = () => {
    if (!Array.isArray(trailas)) return [];
    const clients = trailas
      .map(traila => traila.cliente)
      .filter(cliente => cliente && cliente.trim() !== '')
      .filter((cliente, index, self) => self.indexOf(cliente) === index)
      .sort();
    return clients;
  };

  // Get trailers for a specific client within their range
  const getClientTrailersInRange = (clientName: string) => {
    if (!Array.isArray(trailas)) return [];
    
    const range = clientTrailerRanges[clientName];
    if (!range) return [];
    
    return trailas.filter(traila => {
      // Check if trailer belongs to this client
      if (traila.cliente !== clientName) return false;
      
      // Extract number from trailer name (e.g., "T-150" -> 150)
      const trailerNumber = extractTrailerNumber(traila.nombre);
      if (trailerNumber === null) return false;
      
      // Check if number is in range
      return trailerNumber >= range.min && trailerNumber <= range.max;
    });
  };

  // Extract trailer number from name
  const extractTrailerNumber = (trailerName: string): number | null => {
    if (!trailerName) return null;
    
    // Try to extract number from various formats: "T-150", "150", "3-150", etc.
    const match = trailerName.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Toggle client expansion
  const toggleClientExpansion = (clientName: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientName)) {
        newSet.delete(clientName);
      } else {
        newSet.add(clientName);
      }
      return newSet;
    });
  };
  // Filter trailers by selected client, status filter and search term
  const filteredTrailas = Array.isArray(trailas) ? trailas.filter(traila => {
    const matchesClient = selectedClient === 'ALL' || traila.cliente === selectedClient;
    const matchesStatus = filter === 'ALL' || traila.estatus === filter;
    const matchesSearch = traila.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (traila.cliente || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClient && matchesStatus && matchesSearch;
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
      </div>      {/* Filters */}
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
              Filtrar por Cliente:
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                minWidth: '150px'
              }}
            >
              <option value="ALL">Todos los Clientes</option>
              {getUniqueClients().map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>
          
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
      </div>      {/* Trailers by Client Groups */}
      {selectedClient === 'ALL' ? (        // Show grouped by client with collapsible functionality
        regularClients.map(client => {
          const clientTrailersInRange = getClientTrailersInRange(client);
          const filteredClientTrailers = clientTrailersInRange.filter(traila => {
            const matchesFilter = filter === 'ALL' || traila.estatus === filter;
            const matchesSearch = searchTerm === '' || 
              traila.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (traila.cliente && traila.cliente.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesFilter && matchesSearch;
          });
          
          const isExpanded = expandedClients.has(client);
          const range = clientTrailerRanges[client];
          
          return (
            <div key={client} style={{ marginBottom: '24px' }}>
              <div
                onClick={() => toggleClientExpansion(client)}
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#1976d2',
                  marginBottom: '16px',
                  padding: '16px',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f8f9fa';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                <div>
                  <span style={{ marginRight: '12px' }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  {client}
                  <span style={{ 
                    fontSize: '14px', 
                    color: '#666', 
                    fontWeight: '400',
                    marginLeft: '8px'
                  }}>
                    ({filteredClientTrailers.length} trailers • Rango: {range.min}-{range.max})
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {filteredClientTrailers.filter(t => t.estatus === 'DISPONIBLE').length} disponibles
                </div>
              </div>
              
              {isExpanded && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '20px',
                  marginTop: '16px'
                }}>
                  {filteredClientTrailers.map((traila) => (
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
                          onClick={async () => {
                            setSelectedTraila(traila);
                            try {
                              const response = await axios.get(`${API_URL}/trailas/${traila.nombre}/rental-history`);
                              setRentalHistory(Array.isArray(response.data) ? response.data : []);
                              setShowHistoryModal(true);
                            } catch (error) {
                              console.error('Error fetching rental history:', error);
                              setRentalHistory([]);
                              setShowHistoryModal(true);
                            }
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
                          onClick={async () => {
                            setSelectedTraila(traila);
                            try {
                              const response = await axios.get(`${API_URL}/work-orders/trailer/${traila.nombre}`);
                              setWorkOrderHistory(Array.isArray(response.data) ? response.data : []);
                              setShowWorkOrderModal(true);
                            } catch (error) {
                              console.error('Error fetching work order history:', error);
                              setWorkOrderHistory([]);
                              setShowWorkOrderModal(true);
                            }
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
                          🔧 W.O
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {filteredClientTrailers.length === 0 && (
                    <div style={{
                      gridColumn: '1 / -1',
                      textAlign: 'center',
                      padding: '40px',
                      color: '#666',
                      fontSize: '16px'
                    }}>
                      No se encontraron trailers para {client} en el rango {range.min}-{range.max}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      ) : (
        // Show single client trailers
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
                  onClick={async () => {
                    setSelectedTraila(traila);
                    try {
                      const response = await axios.get(`${API_URL}/trailas/${traila.nombre}/rental-history`);
                      setRentalHistory(Array.isArray(response.data) ? response.data : []);
                      setShowHistoryModal(true);
                    } catch (error) {
                      console.error('Error fetching rental history:', error);
                      setRentalHistory([]);
                      setShowHistoryModal(true);
                    }
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
                  onClick={async () => {
                    setSelectedTraila(traila);
                    try {
                      const response = await axios.get(`${API_URL}/work-orders/trailer/${traila.nombre}`);
                      setWorkOrderHistory(Array.isArray(response.data) ? response.data : []);
                      setShowWorkOrderModal(true);
                    } catch (error) {
                      console.error('Error fetching work order history:', error);
                      setWorkOrderHistory([]);
                      setShowWorkOrderModal(true);
                    }
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
                  🔧 W.O
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
              <input
                type="text"
                value={rentalForm.cliente}
                onChange={(e) => setRentalForm({...rentalForm, cliente: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                placeholder="Ingrese el nombre del cliente..."
                required
              />
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
          }}>            <h2 style={{ color: '#1976d2', marginBottom: '24px' }}>
              Historial de Rentas: {selectedTraila.nombre}
            </h2>
            
            {rentalHistory.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Cliente</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Fecha Renta</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Fecha Devolución</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentalHistory.map((rental, index) => (
                      <tr key={index}>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{rental.cliente}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{rental.fecha_renta}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{rental.fecha_devolucion || 'No devuelto'}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{rental.observaciones || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No hay historial de rentas para este trailer</p>
              </div>
            )}

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
          }}>            <h2 style={{ color: '#1976d2', marginBottom: '24px' }}>
              Historial de Work Orders: {selectedTraila.nombre}
            </h2>
              {workOrderHistory.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>ID</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>ID Classic</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Fecha</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Mecánico</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Descripción</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Total</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrderHistory.map((wo, index) => (
                      <tr key={index}>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{wo.id}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{wo.idClassic || '-'}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{wo.date ? wo.date.slice(0, 10) : '-'}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                          {Array.isArray(wo.mechanics) && wo.mechanics.length > 0
                            ? wo.mechanics.map((m: any) => m.name).join(', ')
                            : wo.mechanic || '-'}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #ddd', maxWidth: '200px' }}>{wo.description || '-'}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                          {wo.totalLabAndParts ? `$${Number(wo.totalLabAndParts).toFixed(2)}` : '$0.00'}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{wo.status}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>
                          <button
                            onClick={() => window.open(`${API_URL}/work-orders/${wo.id}/pdf`, '_blank', 'noopener,noreferrer')}
                            style={{
                              padding: '4px 8px',
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                            title="Ver PDF de la Work Order"
                          >
                            📄 PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No hay work orders para este trailer</p>
              </div>
            )}

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
