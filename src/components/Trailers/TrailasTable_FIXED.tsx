import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shipone-onrender.com/api';

// Different clients for trailer rental vs regular clients
const rentalClients = ['AMAZON', 'WALMART', 'HOME DEPOT', 'FEDEX', 'UPS', 'TARGET'];
const regularClients = ['GALGRE', 'JETGRE', 'PRIGRE', 'RAN100', 'GABGRE'];

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
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState<boolean>(false);
  
  // Client-based filtering
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

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

  // Filter trailers by selected client and search term
  const filteredTrailas = Array.isArray(trailas) ? trailas.filter(traila => {
    const matchesClient = selectedClient === 'ALL' || traila.cliente === selectedClient;
    const matchesSearch = traila.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (traila.cliente || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClient && matchesSearch;
  }) : [];

  // Handle rental
  const handleRental = async () => {
    if (!selectedTraila || !rentalForm.cliente || !rentalForm.fecha_renta) {
      alert('Please complete all required fields');
      return;
    }

    try {
      await axios.put(`${API_URL}/trailas/${selectedTraila.id}`, {
        ...selectedTraila,
        estatus: 'RENTADO',
        cliente: rentalForm.cliente,
        fecha_renta: rentalForm.fecha_renta,
        fecha_devolucion: rentalForm.fecha_devolucion
      });
      
      setShowRentalModal(false);
      setRentalForm({ cliente: '', fecha_renta: '', fecha_devolucion: '', observaciones: '' });
      
      // Refresh data
      const response = await axios.get<Traila[]>(`${API_URL}/trailas`);
      setTrailas(response.data || []);
    } catch (error) {
      console.error('Error renting trailer:', error);
      alert('Error renting trailer');
    }
  };

  // Handle return
  const handleReturn = async () => {
    if (!selectedTraila || !returnForm.fecha_devolucion) {
      alert('Please complete all required fields');
      return;
    }

    try {
      await axios.put(`${API_URL}/trailas/${selectedTraila.id}`, {
        ...selectedTraila,
        estatus: 'DISPONIBLE',
        cliente: '',
        fecha_renta: '',
        fecha_devolucion: returnForm.fecha_devolucion
      });
      
      setShowReturnModal(false);
      setReturnForm({ fecha_devolucion: '', observaciones: '', condicion: '' });
      
      // Refresh data
      const response = await axios.get<Traila[]>(`${API_URL}/trailas`);
      setTrailas(response.data || []);
    } catch (error) {
      console.error('Error returning trailer:', error);
      alert('Error returning trailer');
    }
  };

  const getStatusColor = (estatus: string) => {
    switch (estatus) {
      case 'DISPONIBLE': return '#4caf50';
      case 'RENTADO': return '#ff9800';
      case 'MANTENIMIENTO': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getStatusText = (estatus: string) => {
    switch (estatus) {
      case 'DISPONIBLE': return 'Available';
      case 'RENTADO': return 'Rented';
      case 'MANTENIMIENTO': return 'Maintenance';
      default: return estatus;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '6px solid #f3f3f3',
          borderTop: '6px solid #1976d2',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '20px auto'
        }}></div>
        <p style={{ color: '#666', fontSize: '16px' }}>Loading trailers...</p>
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
  }

  const uniqueClients = getUniqueClients();

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
            borderRadius: '12px',
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
              Trailer Management System - {filteredTrailas.length} trailers
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
            🔄 Refresh
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
              Filter by Client:
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
              <option value="ALL">All Clients</option>
              {uniqueClients.map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>
          
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '4px', display: 'block' }}>
              Search:
            </label>
            <input
              type="text"
              placeholder="Search by name or client..."
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
              border: '1px solid #e0e0e0',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#333' }}>
                  {traila.nombre}
                </h3>
                <span
                  style={{
                    background: getStatusColor(traila.estatus),
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  {getStatusText(traila.estatus)}
                </span>
              </div>
              <div style={{ fontSize: '24px' }}>🚛</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              {traila.cliente && (
                <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                  <strong>Client:</strong> {traila.cliente}
                </p>
              )}
              {traila.fecha_renta && (
                <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                  <strong>Rental Date:</strong> {dayjs(traila.fecha_renta).format('MM/DD/YYYY')}
                </p>
              )}
              {traila.fecha_devolucion && (
                <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                  <strong>Return Date:</strong> {dayjs(traila.fecha_devolucion).format('MM/DD/YYYY')}
                </p>
              )}
              {traila.tipo && (
                <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                  <strong>Type:</strong> {traila.tipo}
                </p>
              )}
              {traila.ubicacion && (
                <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                  <strong>Location:</strong> {traila.ubicacion}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {traila.estatus === 'DISPONIBLE' && (
                <button
                  onClick={() => {
                    setSelectedTraila(traila);
                    setRentalForm({ cliente: '', fecha_renta: '', fecha_devolucion: '', observaciones: '' });
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
                  🏠 Rent
                </button>
              )}

              {traila.estatus === 'RENTADO' && (
                <button
                  onClick={() => {
                    setSelectedTraila(traila);
                    setReturnForm({ fecha_devolucion: dayjs().format('YYYY-MM-DD'), observaciones: '', condicion: '' });
                    setShowReturnModal(true);
                  }}
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
                  ↩️ Return
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
                📊 History
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
                🔧 W.O.
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
            No trailers found with the selected filters
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
              Rent Trailer: {selectedTraila.nombre}
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Client *
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
              >
                <option value="">Select a client...</option>
                {rentalClients.map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Rental Date *
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
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Expected Return Date
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
                Notes
              </label>
              <textarea
                value={rentalForm.observaciones}
                onChange={(e) => setRentalForm({...rentalForm, observaciones: e.target.value})}
                placeholder="Additional notes..."
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
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
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
                Rent Trailer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedTraila && (
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
              Return Trailer: {selectedTraila.nombre}
            </h2>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
              <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                <strong>Current Client:</strong> {selectedTraila.cliente}
              </p>
              {selectedTraila.fecha_renta && (
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
                  <strong>Rented on:</strong> {dayjs(selectedTraila.fecha_renta).format('MM/DD/YYYY')}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Return Date *
              </label>
              <input
                type="date"
                value={returnForm.fecha_devolucion}
                onChange={(e) => setReturnForm({...returnForm, fecha_devolucion: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Condition
              </label>
              <select
                value={returnForm.condicion}
                onChange={(e) => setReturnForm({...returnForm, condicion: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="">Select condition...</option>
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor - Needs Maintenance</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Return Notes
              </label>
              <textarea
                value={returnForm.observaciones}
                onChange={(e) => setReturnForm({...returnForm, observaciones: e.target.value})}
                placeholder="Condition notes, damages, maintenance needed..."
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
                onClick={() => setShowReturnModal(false)}
                style={{
                  padding: '12px 24px',
                  background: '#f5f5f5',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReturn}
                style={{
                  padding: '12px 24px',
                  background: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Return Trailer
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
              Rental History: {selectedTraila.nombre}
            </h2>
            
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>Rental history will be available soon</p>
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
                Close
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
              Work Orders: {selectedTraila.nombre}
            </h2>
            
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>Work order history will be available soon</p>
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrailasTable;
