import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { generateWorkOrderPDF, openInvoiceLinks, openPDFInNewTab } from '../../utils/pdfGenerator';

const API_URL = process.env.REACT_APP_API_URL || 'https://shipone-onrender.com/api';

// Different clients for trailer rental vs regular clients
const rentalClients = ['AMAZON', 'WALMART', 'HOME DEPOT', 'FEDEX', 'UPS', 'TARGET'];
const regularClients = ['GALGRE', 'JETGRE', 'PRIGRE', 'RAN100', 'GABGRE'];

// Client-specific trailer ranges (based on first digit of trailer number)
const clientTrailerRanges: { [key: string]: { min: number; max: number } } = {
  'GALGRE': { min: 1, max: 199 },      // All trailers starting with 1 (1-199)
  'JETGRE': { min: 200, max: 299 },    // All trailers starting with 2 (200-299)
  'PRIGRE': { min: 300, max: 399 },    // All trailers starting with 3 (300-399)
  'RAN100': { min: 400, max: 499 },    // All trailers starting with 4 (400-499)
  'GABGRE': { min: 500, max: 599 }     // All trailers starting with 5 (500-599)
};

// Function to get client based on first digit of trailer number
const getClientByFirstDigit = (trailerNumber: number): string | null => {
  const firstDigit = Math.floor(trailerNumber / Math.pow(10, Math.floor(Math.log10(trailerNumber))));
  
  switch (firstDigit) {
    case 1: return 'GALGRE';
    case 2: return 'JETGRE';
    case 3: return 'PRIGRE';
    case 4: return 'RAN100';
    case 5: return 'GABGRE';
    default: return null;
  }
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
  const [showAvailableModal, setShowAvailableModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState<boolean>(false);
  const [rentalHistory, setRentalHistory] = useState<any[]>([]);
  const [workOrderHistory, setWorkOrderHistory] = useState<any[]>([]);
  // Filtro por mes para Work Orders
  const [workOrderMonthFilter, setWorkOrderMonthFilter] = useState<string>('ALL');

  // Client-based filtering
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

  // Función para formatear fecha sin problemas de zona horaria
  const formatDateSafely = (dateString: string) => {
    if (!dateString) return '';
    try {
      // Si la fecha está en formato YYYY-MM-DD, parsearlo manualmente
      if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${month}/${day}/${year}`;
      }
      // Para otros formatos, usar Date pero con cuidado
      const date = new Date(dateString + 'T00:00:00'); // Forzar hora local
      return date.toLocaleDateString('en-US');
    } catch (error) {
      console.error('Error formateando fecha:', dateString, error);
      return dateString;
    }
  };
  // Return form state
  const [returnForm, setReturnForm] = useState({
    fecha_devolucion: '',
    observaciones: '',
    condicion: ''
  });

  // Available form state  
  const [availableForm, setAvailableForm] = useState({
    fecha_disponible: new Date().toISOString().split('T')[0],
    observaciones: '',
    motivo: ''
  });// Fetch data
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
  };  // Get trailers for a specific client based on first digit of trailer number
  const getClientTrailersInRange = (clientName: string) => {
    if (!Array.isArray(trailas)) return [];
    
    console.log(`🔍 Agrupando trailers para ${clientName} por primer dígito del número de trailer`);
    
    // Group ONLY by first digit of trailer number, ignoring the cliente field completely
    const rangeTrailers = trailas.filter(traila => {
      // Extract number from trailer name (e.g., "T-150" -> 150, "1-123" -> 123)
      const trailerNumber = extractTrailerNumber(traila.nombre);
      if (trailerNumber === null) return false;
      
      // Get the client that should own this trailer based on first digit
      const expectedClient = getClientByFirstDigit(trailerNumber);
      const belongsToClient = expectedClient === clientName;
      
      if (belongsToClient) {
        console.log(`  ✅ ${traila.nombre} (${trailerNumber}) -> ${clientName} (primer dígito: ${Math.floor(trailerNumber / Math.pow(10, Math.floor(Math.log10(trailerNumber))))})`);
      }
      return belongsToClient;
    });
    
    return rangeTrailers;
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
  }) : [];  // Helper function to get current user
  const getCurrentUser = () => {
    return localStorage.getItem('username') || 'USER';
  };

  // Handle rental
  const handleRental = async () => {
    if (!selectedTraila || !rentalForm.cliente || !rentalForm.fecha_renta) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    try {
      const rentalData = {
        ...rentalForm,
        usuario: getCurrentUser()
      };
      
      await axios.put(`${API_URL}/trailas/${selectedTraila.id}/rent`, rentalData);
      setShowRentalModal(false);
      setRentalForm({ cliente: '', fecha_renta: '', fecha_devolucion: '', observaciones: '' });
      // Refresh data
      const response = await axios.get<Traila[]>(`${API_URL}/trailas`);
      setTrailas(response.data || []);
    } catch (error) {
      console.error('Error renting trailer:', error);
      alert('Error al rentar el trailer');
    }
  };  // Handle return
  const handleReturn = async (traila: Traila) => {
    if (window.confirm('¿Está seguro que desea devolver este trailer?')) {
      try {
        const returnData = {
          usuario: getCurrentUser()
        };
        
        await axios.put(`${API_URL}/trailas/${traila.id}/return`, returnData);
        // Refresh data
        const response = await axios.get<Traila[]>(`${API_URL}/trailas`);
        setTrailas(response.data || []);
      } catch (error) {
        console.error('Error returning trailer:', error);
        alert('Error al devolver el trailer');
      }
    }
  };

  // Handle mark as available
  const handleMarkAsAvailable = async () => {
    if (!selectedTraila) return;
    
    try {
      const availableData = {
        fecha_devolucion_real: availableForm.fecha_disponible,
        observaciones_devolucion: `${availableForm.motivo ? availableForm.motivo + ' - ' : ''}${availableForm.observaciones}`,
        usuario: getCurrentUser()
      };
      
      await axios.put(`${API_URL}/trailas/${selectedTraila.id}/return`, availableData);
      
      // Refresh data
      const response = await axios.get<Traila[]>(`${API_URL}/trailas`);
      setTrailas(response.data || []);
      
      // Close modal and reset form
      setShowAvailableModal(false);
      setAvailableForm({
        fecha_disponible: new Date().toISOString().split('T')[0],
        observaciones: '',
        motivo: ''
      });
      
      alert('Trailer marcado como disponible exitosamente');
    } catch (error: any) {
      console.error('Error marking trailer as available:', error);
      alert(`Error al marcar trailer como disponible: ${error.response?.data?.error || error.message}`);
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

  // Función para manejar la generación y visualización de PDF
  const handleViewWorkOrderPDF = async (workOrder: any) => {
    try {
      console.log('🔄 Generando PDF para Work Order desde Trailer Control:', workOrder.id);
      
      // 1. Obtener partes de la Work Order
      let workOrderParts: any[] = [];
      try {
        const partsResponse = await axios.get(`${API_URL}/work-order-parts/${workOrder.id}`);
        workOrderParts = Array.isArray(partsResponse.data) ? partsResponse.data : [];
      } catch (partsError) {
        console.warn('⚠️ No se pudieron obtener partes del API:', partsError);
        // Si no hay partes en API, usar las del work order si las tiene
        if (workOrder.parts && Array.isArray(workOrder.parts)) {
          workOrderParts = workOrder.parts.map((part: any, index: number) => ({
            id: `fallback_${index}`,
            sku: part.sku || '',
            part_name: part.part || part.description || '',
            qty_used: Number(part.qty) || 0,
            cost: Number(String(part.cost).replace(/[^0-9.]/g, '')) || 0,
            invoiceLink: null,
            invoice_number: 'N/A'
          }));
        }
      }
      
      // 2. Procesar mecánicos
      let mechanicsString = '';
      let totalHrs = 0;
      
      if (workOrder.mechanic && workOrder.mechanic.trim() !== '') {
        mechanicsString = workOrder.mechanic;
        totalHrs = Number(workOrder.totalHrs) || 0;
      } else if (workOrder.mechanics) {
        try {
          let mechanicsArray = workOrder.mechanics;
          if (typeof mechanicsArray === 'string') {
            mechanicsArray = JSON.parse(mechanicsArray);
          }
          if (Array.isArray(mechanicsArray) && mechanicsArray.length > 0) {
            mechanicsString = mechanicsArray.map((m: any) => `${m.name} (${m.hrs}h)`).join(', ');
            totalHrs = mechanicsArray.reduce((sum: number, m: any) => sum + (Number(m.hrs) || 0), 0);
          }
        } catch (error) {
          mechanicsString = String(workOrder.mechanics || '');
        }
      }
      
      if (totalHrs === 0) {
        totalHrs = Number(workOrder.totalHrs) || 0;
      }
      
      // 3. Preparar datos para el PDF
      const subtotalParts = workOrderParts.reduce((sum: number, part: any) => 
        sum + ((Number(part.qty_used) || 0) * (Number(part.cost) || 0)), 0);
      
      const laborCost = totalHrs * 60;
      const totalCost = Number(workOrder.totalLabAndParts) || (laborCost + subtotalParts);
      
      const pdfData = {
        id: workOrder.id,
        idClassic: workOrder.idClassic || workOrder.id.toString(),
        customer: workOrder.billToCo || workOrder.customer || 'N/A',
        trailer: workOrder.trailer || '',
        date: formatDateSafely(workOrder.date || ''),
        mechanics: mechanicsString || '',
        description: workOrder.description || '',
        status: workOrder.status || 'PROCESSING',
        parts: workOrderParts.map((part: any) => ({
          sku: part.sku || '',
          description: part.part_name || part.sku || 'N/A',
          um: 'EA',
          qty: Number(part.qty_used) || 0,
          unitCost: Number(part.cost) || 0,
          total: (Number(part.qty_used) || 0) * (Number(part.cost) || 0),
          invoice: part.invoice_number || 'N/A',
          invoiceLink: part.invoiceLink
        })),
        laborCost: laborCost,
        subtotalParts: subtotalParts,
        totalCost: totalCost
      };
      
      console.log('📄 Datos preparados para PDF desde Trailer Control:', pdfData);
      
      // 4. Generar y abrir PDF
      const pdf = await generateWorkOrderPDF(pdfData);
      openPDFInNewTab(pdf, `work_order_${pdfData.idClassic}_trailer.pdf`);
      
      // 5. Abrir enlaces de facturas automáticamente
      openInvoiceLinks(pdfData.parts);
      
      console.log('✅ PDF generado exitosamente desde Trailer Control');
      
    } catch (error: any) {
      console.error('❌ Error al generar PDF desde Trailer Control:', error);
      alert(`Error al generar PDF: ${error.message}`);
    }
  };

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
            // Show client group even if no trailers match the filter
          const isExpanded = expandedClients.has(client);
          const allClientTrailers = clientTrailersInRange; // Show total count regardless of filters
          
          // Get the first digit that corresponds to this client
          const getFirstDigitForClient = (clientName: string) => {
            switch (clientName) {
              case 'GALGRE': return '1';
              case 'JETGRE': return '2';
              case 'PRIGRE': return '3';
              case 'RAN100': return '4';
              case 'GABGRE': return '5';
              default: return '';
            }
          };
          
          const firstDigit = getFirstDigitForClient(client);
          
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
                  {client}                  <span style={{ 
                    fontSize: '14px', 
                    color: '#666', 
                    fontWeight: '400',
                    marginLeft: '8px'
                  }}>
                    ({allClientTrailers.length} trailers • Primer dígito: {firstDigit})
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
                  {filteredClientTrailers.length === 0 ? (
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#666',
                      background: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                    }}>                      {allClientTrailers.length === 0 
                        ? `No hay trailers para ${client} (primer dígito ${firstDigit})`
                        : 'No hay trailers que coincidan con los filtros aplicados'
                      }
                    </div>
                  ) : (
                    filteredClientTrailers.map((traila) => (
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

                        {traila.estatus !== 'DISPONIBLE' && traila.estatus !== 'RENTADO' && (
                          <button
                            onClick={() => {
                              setSelectedTraila(traila);
                              setShowAvailableModal(true);
                            }}
                            style={{
                              padding: '8px 16px',
                              background: '#2e7d32',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            ✅ Marcar Disponible
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
                          🔧 W.O                        </button>
                      </div>
                    </div>
                  ))
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

                {traila.estatus !== 'DISPONIBLE' && traila.estatus !== 'RENTADO' && (
                  <button
                    onClick={() => {
                      setSelectedTraila(traila);
                      setShowAvailableModal(true);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#2e7d32',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    ✅ Marcar Disponible
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
          <p style={{ fontSize: '18px', color: '#666', margin: 0 }}>
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

            {/* Filtro por mes */}
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label htmlFor="monthFilter" style={{ fontWeight: '600', color: '#333' }}>
                Filtrar por mes:
              </label>
              <select
                id="monthFilter"
                value={workOrderMonthFilter}
                onChange={(e) => setWorkOrderMonthFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '2px solid #1976d2',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: '#fff'
                }}
              >
                <option value="ALL">Todos los meses</option>
                <option value="2025-01">Enero 2025</option>
                <option value="2025-02">Febrero 2025</option>
                <option value="2025-03">Marzo 2025</option>
                <option value="2025-04">Abril 2025</option>
                <option value="2025-05">Mayo 2025</option>
                <option value="2025-06">Junio 2025</option>
                <option value="2025-07">Julio 2025</option>
                <option value="2025-08">Agosto 2025</option>
                <option value="2025-09">Septiembre 2025</option>
                <option value="2025-10">Octubre 2025</option>
                <option value="2025-11">Noviembre 2025</option>
                <option value="2025-12">Diciembre 2025</option>
                <option value="2024-12">Diciembre 2024</option>
                <option value="2024-11">Noviembre 2024</option>
                <option value="2024-10">Octubre 2024</option>
              </select>
              {workOrderMonthFilter !== 'ALL' && (
                <span style={{ color: '#666', fontSize: '14px' }}>
                  ({(() => {
                    const filtered = workOrderHistory.filter(wo => {
                      if (!wo.date) return false;
                      const woMonth = wo.date.slice(0, 7); // YYYY-MM
                      return woMonth === workOrderMonthFilter;
                    });
                    return filtered.length;
                  })()} de {workOrderHistory.length} work orders)
                </span>
              )}
            </div>

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
                    {(() => {
                      // Filtrar work orders por mes
                      const filteredWorkOrders = workOrderMonthFilter === 'ALL' 
                        ? workOrderHistory 
                        : workOrderHistory.filter(wo => {
                            if (!wo.date) return false;
                            const woMonth = wo.date.slice(0, 7); // YYYY-MM
                            return woMonth === workOrderMonthFilter;
                          });
                      
                      return filteredWorkOrders.length > 0 ? (
                        filteredWorkOrders.map((wo, index) => (
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
                                onClick={() => handleViewWorkOrderPDF(wo)}
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
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                            {workOrderMonthFilter === 'ALL' 
                              ? 'No hay work orders para este trailer'
                              : `No hay work orders para ${workOrderMonthFilter.split('-')[1]}/${workOrderMonthFilter.split('-')[0]}`
                            }
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No hay work orders para este trailer</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>              <button
                onClick={() => {
                  setShowWorkOrderModal(false);
                  setWorkOrderMonthFilter('ALL'); // Reset filter when closing modal
                }}
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
        </div>      )}

      {/* Mark as Available Modal */}
      {showAvailableModal && selectedTraila && (
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
            <h2 style={{ color: '#2e7d32', marginBottom: '24px' }}>
              ✅ Marcar como Disponible: {selectedTraila.nombre}
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Fecha de Disponibilidad *
              </label>
              <input
                type="date"
                value={availableForm.fecha_disponible}
                onChange={(e) => setAvailableForm({...availableForm, fecha_disponible: e.target.value})}
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
                Motivo
              </label>
              <select
                value={availableForm.motivo}
                onChange={(e) => setAvailableForm({...availableForm, motivo: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="">Seleccione un motivo</option>
                <option value="MANTENIMIENTO_COMPLETADO">Mantenimiento Completado</option>
                <option value="REPARACION_COMPLETADA">Reparación Completada</option>
                <option value="INSPECCION_COMPLETADA">Inspección Completada</option>
                <option value="DEVOLUCION_CLIENTE">Devolución de Cliente</option>
                <option value="OTROS">Otros</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Observaciones
              </label>
              <textarea
                value={availableForm.observaciones}
                onChange={(e) => setAvailableForm({...availableForm, observaciones: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                placeholder="Detalles adicionales sobre el cambio de estado..."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAvailableModal(false);
                  setAvailableForm({
                    fecha_disponible: new Date().toISOString().split('T')[0],
                    observaciones: '',
                    motivo: ''
                  });
                }}
                style={{
                  padding: '12px 24px',
                  background: '#9e9e9e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleMarkAsAvailable}
                disabled={!availableForm.fecha_disponible}
                style={{
                  padding: '12px 24px',
                  background: availableForm.fecha_disponible ? '#2e7d32' : '#cccccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: availableForm.fecha_disponible ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                ✅ Marcar Disponible
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
