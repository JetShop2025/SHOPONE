import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://graphical-system-v2.onrender.com/api';

interface TrailerLocationData {
  trailer: string;
  location: string;
  lastUpdate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface EmailRecipient {
  id: number;
  name: string;
  email: string;
  trailers: string[];
  active: boolean;
}

interface TrailerDetailData {
  assetId: string;
  trailer?: string;
  location: string;
  coordinates: { lat: number; lng: number };
  speed: number;
  direction: number;
  lastUpdate: string;
  status: string;
}

interface TrailerStatistics {
  assetId: string;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  maxSpeed: number;
  fuelConsumption: number;
  idleTime: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

interface HistoryLocation {
  timestamp: string;
  coordinates: { lat: number; lng: number };
  speed: number;
  direction: number;
  address: string;
}

const TrailerLocation: React.FC = () => {
  const [trailerLocations, setTrailerLocations] = useState<TrailerLocationData[]>([]);
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrailers, setSelectedTrailers] = useState<string[]>([]);
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    name: '',
    email: '',
    trailers: [] as string[]
  });
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [sendFrequency, setSendFrequency] = useState('daily'); // daily, weekly, manual
  // Estado para manejar datos de trailers desde la API real
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedTrailerDetail, setSelectedTrailerDetail] = useState<TrailerDetailData | null>(null);
  const [trailerStatistics, setTrailerStatistics] = useState<TrailerStatistics | null>(null);
  const [trailerHistory, setTrailerHistory] = useState<HistoryLocation[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadTrailerLocations();
    loadEmailRecipients();
  }, []);
  const loadTrailerLocations = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      console.log('🔄 Cargando ubicaciones de trailers desde API...');
      
      // Usar endpoint real del backend
      const response = await axios.get(`${API_URL}/trailer-location/gps-data`);
      
      if (response.data && Array.isArray(response.data)) {
        // Transformar datos del backend al formato del frontend
        const transformedData: TrailerLocationData[] = response.data.map((item: any) => ({
          trailer: item.trailer || item.name || 'N/A',
          location: item.location || 'Ubicación no disponible',
          lastUpdate: item.lastUpdate || new Date().toISOString(),
          status: (item.status?.toUpperCase() || 'UNKNOWN') as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE',
          coordinates: item.coordinates || { lat: 0, lng: 0 }
        }));
        
        setTrailerLocations(transformedData);
        setLastUpdateTime(new Date().toLocaleString());
        console.log(`✅ ${transformedData.length} trailers cargados`);
        
        if (response.data.some((item: any) => item.mock)) {
          setErrorMessage('⚠️ Usando datos de prueba - API de Momentum no disponible');
        }
      } else {
        throw new Error('Formato de respuesta inválido');
      }
    } catch (error) {
      console.error('❌ Error loading trailer locations:', error);
      setErrorMessage('Error cargando ubicaciones de trailers. Verifique la conexión.');
      
      // Fallback a datos básicos en caso de error total
      setTrailerLocations([
        { trailer: '3-300', location: 'Error - Sin datos', lastUpdate: new Date().toISOString(), status: 'INACTIVE' },
        { trailer: '3-301', location: 'Error - Sin datos', lastUpdate: new Date().toISOString(), status: 'INACTIVE' }
      ]);
    } finally {
      setLoading(false);
    }
  };  const loadEmailRecipients = async () => {
    try {
      console.log('📧 Cargando destinatarios de email...');
      const response = await axios.get(`${API_URL}/trailer-location/recipients`);
      
      if (response.data && Array.isArray(response.data)) {
        setEmailRecipients(response.data as EmailRecipient[]);
        console.log(`✅ ${response.data.length} destinatarios cargados`);
      } else {
        throw new Error('Formato de respuesta inválido');
      }
    } catch (error) {
      console.error('❌ Error loading email recipients:', error);
      // Datos mock por ahora
      setEmailRecipients([
        { id: 1, name: 'Manager Central', email: 'manager@company.com', trailers: ['3-300', '3-301'], active: true },
        { id: 2, name: 'Dispatcher', email: 'dispatch@company.com', trailers: ['1-100', '1-101', '2-01'], active: true },
      ]);
    }
  };
  const sendLocationReport = async (recipients?: EmailRecipient[], trailers?: string[]) => {
    setLoading(true);
    try {
      const selectedRecipients = recipients || emailRecipients.filter(r => r.active);
      const selectedTrailerData = trailers ? 
        trailerLocations.filter(t => trailers.includes(t.trailer)) : 
        trailerLocations.filter(t => selectedTrailers.includes(t.trailer));

      if (selectedRecipients.length === 0) {
        alert('No hay destinatarios seleccionados');
        return;
      }

      if (selectedTrailerData.length === 0) {
        alert('No hay trailers seleccionados');
        return;
      }

      console.log('📧 Enviando reporte de ubicación...');

      const reportData = {
        recipients: selectedRecipients,
        trailerData: selectedTrailerData,
        timestamp: new Date().toISOString(),
        reportType: 'location_update'
      };      const response = await axios.post(`${API_URL}/trailer-location/send-report`, reportData);
      
      if (response.data && (response.data as any).success) {
        alert(`✅ Reporte de ubicación enviado exitosamente a ${selectedRecipients.length} destinatarios`);
        console.log('✅ Reporte enviado:', response.data);
      } else {
        throw new Error('Respuesta del servidor inválida');
      }
      
      setSelectedTrailers([]);
    } catch (error) {
      console.error('❌ Error sending location report:', error);
      alert('⚠️ Error enviando reporte. Verifique la configuración de email.');
    } finally {
      setLoading(false);
    }
  };
  const addEmailRecipient = async () => {
    if (!newRecipient.name || !newRecipient.email) {
      alert('Por favor complete todos los campos');
      return;
    }

    try {
      console.log('👤 Agregando nuevo destinatario...');
      
      const response = await axios.post(`${API_URL}/trailer-location/recipients`, {
        ...newRecipient,
        active: true
      });
        if (response.data && (response.data as any).id) {
        setEmailRecipients([...emailRecipients, response.data as EmailRecipient]);
        setNewRecipient({ name: '', email: '', trailers: [] });
        setShowAddRecipient(false);
        alert('✅ Destinatario agregado exitosamente');
        console.log('✅ Destinatario agregado:', response.data);
      } else {
        throw new Error('Respuesta del servidor inválida');
      }
    } catch (error) {
      console.error('❌ Error adding recipient:', error);
      
      // Fallback para demo
      const newId = Math.max(...emailRecipients.map(r => r.id), 0) + 1;
      const mockNewRecipient: EmailRecipient = {
        id: newId,
        ...newRecipient,
        active: true
      };
      setEmailRecipients([...emailRecipients, mockNewRecipient]);
      setNewRecipient({ name: '', email: '', trailers: [] });
      setShowAddRecipient(false);
      alert('⚠️ Destinatario agregado en modo local (error de conexión)');
    }
  };

  const toggleTrailerSelection = (trailer: string) => {
    setSelectedTrailers(prev => 
      prev.includes(trailer) 
        ? prev.filter(t => t !== trailer)
        : [...prev, trailer]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#4caf50';
      case 'INACTIVE': return '#f44336';
      case 'MAINTENANCE': return '#ff9800';
      default: return '#666';
    }
  };

  // Función para obtener detalles específicos de un trailer
  const getTrailerDetail = async (trailerName: string) => {
    setDetailLoading(true);
    try {
      console.log(`🔍 Obteniendo detalles del trailer ${trailerName}...`);
        // Buscar el assetId basado en el nombre del trailer
      const assetsResponse = await axios.get(`${API_URL}/trailer-location/momentum/assets`);
      const asset = (assetsResponse.data as any).data?.find((a: any) => a.name === trailerName);
      
      if (!asset) {
        throw new Error(`Trailer ${trailerName} no encontrado`);
      }

      // Obtener ubicación actual
      const locationResponse = await axios.get(`${API_URL}/trailer-location/momentum/location/${asset.assetId}`);
      
      if (locationResponse.data && (locationResponse.data as any).success) {
        const detailData = (locationResponse.data as any).data;
        setSelectedTrailerDetail({
          ...detailData,
          trailer: trailerName
        });
        setShowDetailModal(true);
        console.log(`✅ Detalles obtenidos para trailer ${trailerName}`);
      } else {
        throw new Error('No se pudieron obtener los detalles');
      }
    } catch (error) {
      console.error(`❌ Error obteniendo detalles del trailer ${trailerName}:`, error);
      alert(`Error obteniendo detalles del trailer ${trailerName}`);
    } finally {
      setDetailLoading(false);
    }
  };

  // Función para obtener estadísticas de un trailer
  const getTrailerStatistics = async (trailerName: string, startDate: string, endDate: string) => {
    try {
      console.log(`📊 Obteniendo estadísticas del trailer ${trailerName}...`);
        // Buscar el assetId basado en el nombre del trailer
      const assetsResponse = await axios.get(`${API_URL}/trailer-location/momentum/assets`);
      const asset = (assetsResponse.data as any).data?.find((a: any) => a.name === trailerName);
      
      if (!asset) {
        throw new Error(`Trailer ${trailerName} no encontrado`);
      }

      // Obtener estadísticas
      const statsResponse = await axios.get(
        `${API_URL}/trailer-location/momentum/statistics/${asset.assetId}?startDate=${startDate}&endDate=${endDate}`
      );
      
      if (statsResponse.data && (statsResponse.data as any).success) {
        setTrailerStatistics((statsResponse.data as any).data);
        console.log(`✅ Estadísticas obtenidas para trailer ${trailerName}`);
      } else {
        throw new Error('No se pudieron obtener las estadísticas');
      }
    } catch (error) {
      console.error(`❌ Error obteniendo estadísticas del trailer ${trailerName}:`, error);
      alert(`Error obteniendo estadísticas del trailer ${trailerName}`);
    }
  };

  // Función para obtener historial de ubicaciones
  const getTrailerHistory = async (trailerName: string, startDate: string, endDate: string, limit: number = 100) => {
    try {
      console.log(`📅 Obteniendo historial del trailer ${trailerName}...`);
        // Buscar el assetId basado en el nombre del trailer
      const assetsResponse = await axios.get(`${API_URL}/trailer-location/momentum/assets`);
      const asset = (assetsResponse.data as any).data?.find((a: any) => a.name === trailerName);
      
      if (!asset) {
        throw new Error(`Trailer ${trailerName} no encontrado`);
      }

      // Obtener historial
      const historyResponse = await axios.get(
        `${API_URL}/trailer-location/momentum/history/${asset.assetId}?startDate=${startDate}&endDate=${endDate}&limit=${limit}`
      );
      
      if (historyResponse.data && (historyResponse.data as any).success) {
        setTrailerHistory((historyResponse.data as any).data);
        console.log(`✅ ${(historyResponse.data as any).data.length} registros de historial obtenidos para trailer ${trailerName}`);
      } else {
        throw new Error('No se pudo obtener el historial');
      }
    } catch (error) {
      console.error(`❌ Error obteniendo historial del trailer ${trailerName}:`, error);
      alert(`Error obteniendo historial del trailer ${trailerName}`);
    }
  };

  // Función para refrescar todos los datos
  const refreshAllData = async () => {
    await Promise.all([
      loadTrailerLocations(),
      loadEmailRecipients()
    ]);
  };

  return (
    <div style={{
      padding: '32px',
      background: 'linear-gradient(90deg, #fff3e0 0%, #ffffff 100%)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(255, 152, 0, 0.10)',
      maxWidth: 1400,
      margin: '32px auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#ff9800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12
        }}>
          <span style={{ fontSize: 24 }}>🛰️</span>
        </div>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#ff9800',
          margin: 0,
          letterSpacing: 2
        }}>
          TRAILER LOCATION
        </h1>
        <div style={{ marginLeft: 'auto', fontSize: 14, color: '#666' }}>
          Última actualización: {lastUpdateTime}
        </div>
      </div>

      {/* Control Panel */}
      <div style={{
        background: 'white',
        padding: 20,
        borderRadius: 12,
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={loadTrailerLocations}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Actualizando...' : '🔄 Actualizar Ubicaciones'}
          </button>
          
          <button
            onClick={() => sendLocationReport()}
            disabled={selectedTrailers.length === 0 || loading}
            style={{
              padding: '12px 24px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: selectedTrailers.length === 0 || loading ? 'not-allowed' : 'pointer',
              opacity: selectedTrailers.length === 0 || loading ? 0.6 : 1
            }}
          >
            📧 Enviar Ubicaciones ({selectedTrailers.length})
          </button>

          <button
            onClick={() => setShowAddRecipient(true)}
            style={{
              padding: '12px 24px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ➕ Agregar Destinatario
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={autoSendEnabled}
                onChange={(e) => setAutoSendEnabled(e.target.checked)}
              />
              Envío automático
            </label>
            {autoSendEnabled && (
              <select
                value={sendFrequency}
                onChange={(e) => setSendFrequency(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="manual">Manual</option>
              </select>
            )}
          </div>        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          color: '#856404',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Trailer Locations Table */}
        <div style={{ flex: 2 }}>
          <h3 style={{ color: '#ff9800', marginBottom: 16 }}>Ubicaciones de Trailers</h3>
          <div style={{
            background: 'white',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>              <thead>
                <tr style={{ background: '#ff9800', color: 'white' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Select</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Trailer</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Ubicación</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Estado</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Última Actualización</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {trailerLocations.map((trailer, index) => (
                  <tr 
                    key={trailer.trailer}
                    style={{ 
                      borderBottom: '1px solid #eee',
                      background: selectedTrailers.includes(trailer.trailer) ? '#fff3e0' : 'white'
                    }}
                  >
                    <td style={{ padding: '12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedTrailers.includes(trailer.trailer)}
                        onChange={() => toggleTrailerSelection(trailer.trailer)}
                        style={{ transform: 'scale(1.2)' }}
                      />
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#1976d2' }}>
                      {trailer.trailer}
                    </td>
                    <td style={{ padding: '12px' }}>
                      📍 {trailer.location}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: getStatusColor(trailer.status),
                        color: 'white'
                      }}>
                        {trailer.status}
                      </span>
                    </td>                    <td style={{ padding: '12px', fontSize: 14, color: '#666' }}>
                      {new Date(trailer.lastUpdate).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => getTrailerDetail(trailer.trailer)}
                        disabled={detailLoading}
                        style={{
                          padding: '6px 12px',
                          background: '#1976d2',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 12,
                          cursor: detailLoading ? 'not-allowed' : 'pointer',
                          opacity: detailLoading ? 0.6 : 1
                        }}
                      >
                        {detailLoading ? '...' : '🔍 Detalles'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Email Recipients Panel */}
        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#ff9800', marginBottom: 16 }}>Destinatarios de Email</h3>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {emailRecipients.map(recipient => (
              <div key={recipient.id} style={{
                padding: '12px',
                border: '1px solid #eee',
                borderRadius: 8,
                marginBottom: 12,
                background: recipient.active ? '#f8f9fa' : '#f5f5f5'
              }}>
                <div style={{ fontWeight: 600, color: '#333' }}>{recipient.name}</div>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>{recipient.email}</div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  Trailers: {recipient.trailers.join(', ') || 'Todos'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    background: recipient.active ? '#4caf50' : '#999',
                    color: 'white'
                  }}>
                    {recipient.active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Recipient Modal */}
      {showAddRecipient && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: 32,
            borderRadius: 16,
            minWidth: 400,
            maxWidth: 500
          }}>
            <h3 style={{ color: '#ff9800', marginBottom: 24 }}>Agregar Destinatario</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Nombre:</label>
              <input
                type="text"
                value={newRecipient.name}
                onChange={(e) => setNewRecipient({...newRecipient, name: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 16
                }}
                placeholder="Nombre del destinatario"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Email:</label>
              <input
                type="email"
                value={newRecipient.email}
                onChange={(e) => setNewRecipient({...newRecipient, email: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 16
                }}
                placeholder="email@ejemplo.com"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Trailers asignados:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {trailerLocations.map(trailer => (
                  <label key={trailer.trailer} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={newRecipient.trailers.includes(trailer.trailer)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewRecipient({
                            ...newRecipient,
                            trailers: [...newRecipient.trailers, trailer.trailer]
                          });
                        } else {
                          setNewRecipient({
                            ...newRecipient,
                            trailers: newRecipient.trailers.filter(t => t !== trailer.trailer)
                          });
                        }
                      }}
                    />
                    {trailer.trailer}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddRecipient(false)}
                style={{
                  padding: '12px 24px',
                  background: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={addEmailRecipient}
                style={{
                  padding: '12px 24px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛰️</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#ff9800' }}>
              Procesando ubicaciones GPS...
            </div>
          </div>
        </div>
      )}

      {/* Trailer Detail Modal */}
      {showDetailModal && selectedTrailerDetail && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: 32,
            borderRadius: 16,
            minWidth: 400,
            maxWidth: 600,
            position: 'relative'
          }}>
            <h3 style={{ color: '#ff9800', marginBottom: 24 }}>Detalles del Trailer</h3>
            
            <div style={{ marginBottom: 16 }}>
              <strong>Trailer:</strong> {selectedTrailerDetail.trailer}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>Ubicación Actual:</strong> {selectedTrailerDetail.location}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>Estado:</strong> 
              <span style={{
                padding: '4px 8px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                background: getStatusColor(selectedTrailerDetail.status),
                color: 'white',
                marginLeft: 8
              }}>
                {selectedTrailerDetail.status}
              </span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>Última Actualización:</strong> {new Date(selectedTrailerDetail.lastUpdate).toLocaleString()}
            </div>
            <div style={{ marginBottom: 24 }}>
              <strong>Coordenadas:</strong> 
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{
                  padding: '8px 16px',
                  borderRadius: 12,
                  background: '#f0f0f0',
                  fontSize: 14,
                  fontWeight: 500
                }}>
                  Lat: {selectedTrailerDetail.coordinates.lat}
                </div>
                <div style={{
                  padding: '8px 16px',
                  borderRadius: 12,
                  background: '#f0f0f0',
                  fontSize: 14,
                  fontWeight: 500
                }}>
                  Lng: {selectedTrailerDetail.coordinates.lng}
                </div>
              </div>
            </div>

            {/* Statistics and History Buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => {
                  if (selectedTrailerDetail) {
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 7);
                    getTrailerStatistics(selectedTrailerDetail.trailer || selectedTrailerDetail.assetId, startDate.toISOString(), new Date().toISOString());
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📊 Ver Estadísticas
              </button>              <button
                onClick={() => {
                  const endDate = new Date();
                  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                  getTrailerHistory(selectedTrailerDetail.trailer || selectedTrailerDetail.assetId, startDate.toISOString(), endDate.toISOString());
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📅 Ver Historial
              </button>
            </div>

            {/* Detail Loading Spinner */}
            {detailLoading && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🛰️</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#ff9800' }}>
                    Cargando detalles del trailer...
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowDetailModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 24,
                color: '#666'
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Trailer Statistics Panel */}
      {trailerStatistics && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid #ddd',
          padding: 16,
          zIndex: 1000
        }}>
          <div style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <h3 style={{ color: '#ff9800', margin: 0 }}>Estadísticas del Trailer</h3>
            
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Distancia Total (km)</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#333' }}>
                    {trailerStatistics.totalDistance.toFixed(2)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Tiempo Total (horas)</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#333' }}>
                    {trailerStatistics.totalTime.toFixed(2)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Velocidad Promedio (km/h)</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#333' }}>
                    {trailerStatistics.averageSpeed.toFixed(2)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Velocidad Máxima (km/h)</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#333' }}>
                    {trailerStatistics.maxSpeed.toFixed(2)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Consumo de Combustible (litros)</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#333' }}>
                    {trailerStatistics.fuelConsumption.toFixed(2)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Tiempo en Idle (horas)</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#333' }}>
                    {trailerStatistics.idleTime.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trailer History Panel */}
      {trailerHistory.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid #ddd',
          padding: 16,
          zIndex: 1000
        }}>
          <div style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <h3 style={{ color: '#ff9800', margin: 0 }}>Historial del Trailer</h3>
            
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#ff9800', color: 'white' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Fecha y Hora</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Ubicación</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Velocidad (km/h)</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Dirección</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Dirección</th>
                  </tr>
                </thead>
                <tbody>
                  {trailerHistory.map((entry, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px', fontSize: 14, color: '#333' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', fontSize: 14, color: '#333' }}>
                        📍 {entry.coordinates.lat}, {entry.coordinates.lng}
                      </td>
                      <td style={{ padding: '12px', fontSize: 14, color: '#333' }}>
                        {entry.speed.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', fontSize: 14, color: '#333' }}>
                        {entry.direction.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', fontSize: 14, color: '#333' }}>
                        {entry.address}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>          </div>
        </div>
      )}

      {/* Trailer Detail Modal */}
      {showDetailModal && selectedTrailerDetail && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: 'white',
            padding: 32,
            borderRadius: 16,
            minWidth: 500,
            maxWidth: 700,
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ color: '#ff9800', margin: 0 }}>
                🚛 Detalles del Trailer {selectedTrailerDetail.trailer || selectedTrailerDetail.assetId}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>

            {/* Basic Info */}
            <div style={{
              background: '#f8f9fa',
              padding: 16,
              borderRadius: 8,
              marginBottom: 16
            }}>
              <h4 style={{ color: '#333', marginBottom: 12 }}>📍 Ubicación Actual</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <strong>ID del Asset:</strong> {selectedTrailerDetail.assetId}
                </div>
                <div>
                  <strong>Estado:</strong> 
                  <span style={{
                    marginLeft: 8,
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: getStatusColor(selectedTrailerDetail.status),
                    color: 'white'
                  }}>
                    {selectedTrailerDetail.status}
                  </span>
                </div>
                <div>
                  <strong>Ubicación:</strong> {selectedTrailerDetail.location}
                </div>
                <div>
                  <strong>Velocidad:</strong> {selectedTrailerDetail.speed} km/h
                </div>
                <div>
                  <strong>Dirección:</strong> {selectedTrailerDetail.direction}°
                </div>
                <div>
                  <strong>Última Actualización:</strong> {new Date(selectedTrailerDetail.lastUpdate).toLocaleString()}
                </div>
              </div>

              {/* Coordinates */}
              <div style={{ marginTop: 12, padding: 12, background: '#e3f2fd', borderRadius: 6 }}>
                <strong>🌐 Coordenadas:</strong><br/>
                Latitud: {selectedTrailerDetail.coordinates.lat}<br/>
                Longitud: {selectedTrailerDetail.coordinates.lng}
              </div>
            </div>

            {/* Statistics Section */}
            <div style={{
              background: '#f0f7ff',
              padding: 16,
              borderRadius: 8,
              marginBottom: 16
            }}>
              <h4 style={{ color: '#333', marginBottom: 12 }}>📊 Estadísticas (Últimos 7 días)</h4>
              
              {trailerStatistics && trailerStatistics.assetId === selectedTrailerDetail.assetId ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><strong>Distancia Total:</strong> {trailerStatistics.totalDistance} km</div>
                  <div><strong>Tiempo Total:</strong> {trailerStatistics.totalTime} hrs</div>
                  <div><strong>Velocidad Promedio:</strong> {trailerStatistics.averageSpeed} km/h</div>
                  <div><strong>Velocidad Máxima:</strong> {trailerStatistics.maxSpeed} km/h</div>
                  <div><strong>Consumo de Combustible:</strong> {trailerStatistics.fuelConsumption} L</div>
                  <div><strong>Tiempo Inactivo:</strong> {trailerStatistics.idleTime} hrs</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => {
                      const endDate = new Date();
                      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                      getTrailerStatistics(selectedTrailerDetail.trailer || selectedTrailerDetail.assetId, startDate.toISOString(), endDate.toISOString());
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#2196f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    📊 Cargar Estadísticas
                  </button>
                </div>
              )}
            </div>

            {/* History Section */}
            <div style={{
              background: '#fff3e0',
              padding: 16,
              borderRadius: 8,
              marginBottom: 16
            }}>
              <h4 style={{ color: '#333', marginBottom: 12 }}>📅 Historial de Ubicaciones</h4>
              
              {trailerHistory.length > 0 ? (
                <div>
                  <div style={{ marginBottom: 12, fontWeight: 600 }}>
                    {trailerHistory.length} registros cargados
                  </div>
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {trailerHistory.slice(0, 5).map((entry, index) => (
                      <div key={index} style={{
                        padding: '8px 12px',
                        border: '1px solid #eee',
                        borderRadius: 4,
                        marginBottom: 8,
                        background: 'white'
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          📍 {entry.address} | 🏃 {entry.speed} km/h | 🧭 {entry.direction}°
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const endDate = new Date();
                    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                    getTrailerHistory(selectedTrailerDetail.trailer || selectedTrailerDetail.assetId, startDate.toISOString(), endDate.toISOString());
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  📅 Cargar Historial
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setTrailerStatistics(null);
                  setTrailerHistory([]);
                  setShowDetailModal(false);
                }}
                style={{
                  padding: '12px 24px',
                  background: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>      )}

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛰️</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#ff9800' }}>
              Procesando ubicaciones GPS...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrailerLocation;
