import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { generateWorkOrderPDF, openInvoiceLinks, openPDFInNewTab } from '../../utils/pdfGenerator';
import TrailerRentalModal from './TrailerRentalModal';
import TrailerHistoryModal from './TrailerHistoryModal';
import TrailerWorkOrderModal from './TrailerWorkOrderModal';
import TrailerAvailableModal from './TrailerAvailableModal';
import TrailerCard from './TrailerCard';
import TrailersHeaderBar from './TrailersHeaderBar';
import TrailersFiltersBar from './TrailersFiltersBar';

const API_URL = process.env.REACT_APP_API_URL || 'https://shipone-onrender.com/api';

const regularClients = ['GALGRE', 'JETGRE', 'PRIGRE', 'RAN100', 'GABGRE'];

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

const TrailasTable: React.FC = () => {
  const [trailas, setTrailas] = useState<Traila[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTraila, setSelectedTraila] = useState<Traila | null>(null);
  const [showRentalModal, setShowRentalModal] = useState<boolean>(false);
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

  // Available form state  
  const [availableForm, setAvailableForm] = useState({
    fecha_disponible: new Date().toISOString().split('T')[0],
    observaciones: '',
    motivo: ''
  });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const trailasRes = await axios.get<Traila[]>(`${API_URL}/trailas`);
        
        const trailasData = Array.isArray(trailasRes.data) ? trailasRes.data : [];
        
        setTrailas(trailasData);
        console.log(`✅ Loaded ${trailasData.length} trailers`);
      } catch (error) {
        console.error('Error fetching data:', error);
        setTrailas([]);
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

  const refreshTrailas = async () => {
    console.log('🔄 Refrescando datos de trailers...');
    const trailersResponse = await axios.get<Traila[]>(`${API_URL}/trailas`);
    console.log('📦 Datos refrescados:', trailersResponse.data);
    setTrailas(Array.isArray(trailersResponse.data) ? trailersResponse.data : []);
  };

  const handleOpenRentalModal = (traila: Traila) => {
    setSelectedTraila(traila);
    setShowRentalModal(true);
  };

  const handleOpenAvailableModal = (traila: Traila) => {
    setSelectedTraila(traila);
    setShowAvailableModal(true);
  };

  const handleShowHistory = (traila: Traila, history: any[]) => {
    setSelectedTraila(traila);
    setRentalHistory(history);
    setShowHistoryModal(true);
  };

  const handleShowWorkOrders = (traila: Traila, workOrders: any[]) => {
    setSelectedTraila(traila);
    setWorkOrderHistory(workOrders);
    setShowWorkOrderModal(true);
  };

  // Handle rental
  const handleRental = async () => {
    if (!selectedTraila || !rentalForm.cliente || !rentalForm.fecha_renta) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    try {
      console.log('🔄 Rentando trailer:', selectedTraila.id, rentalForm);
      const rentalData = {
        ...rentalForm,
        usuario: getCurrentUser(),
        trailer_id: selectedTraila.id,
        trailer_nombre: selectedTraila.nombre
      };

      // Rent trailer and save rental history
      const response = await axios.put(`${API_URL}/trailas/${selectedTraila.id}/rent`, rentalData);
      console.log('✅ Trailer rentado exitosamente:', response.data);

      // Registrar historial de renta
      try {
        await axios.post(`${API_URL}/trailas/${selectedTraila.nombre}/rental-history`, {
          ...rentalData,
          fecha_renta: rentalForm.fecha_renta,
          fecha_devolucion: rentalForm.fecha_devolucion,
          observaciones: rentalForm.observaciones
        });
        console.log('📝 Historial de renta registrado');
      } catch (historyError) {
        console.error('❌ Error registrando historial de renta:', historyError);
      }

      setShowRentalModal(false);
      setRentalForm({ cliente: '', fecha_renta: '', fecha_devolucion: '', observaciones: '' });

      await refreshTrailas();

      alert('Trailer rentado exitosamente');
    } catch (error: any) {
      console.error('❌ Error renting trailer:', error);
      alert(`Error al rentar el trailer: ${error.response?.data?.error || error.message}`);
    }
  };
  const handleReturn = async (traila: Traila) => {
    if (window.confirm('¿Está seguro que desea devolver este trailer?')) {
      try {
        console.log('🔄 Devolviendo trailer:', traila.id);
        const returnData = {
          usuario: getCurrentUser(),
          fecha_devolucion: new Date().toISOString().split('T')[0],
          observaciones: '',
          trailer_id: traila.id,
          trailer_nombre: traila.nombre,
          cliente: traila.cliente
        };

        const response = await axios.put(`${API_URL}/trailas/${traila.id}/return`, returnData);
        console.log('✅ Trailer devuelto exitosamente:', response.data);

        // Registrar historial de devolución
        try {
          await axios.post(`${API_URL}/trailas/${traila.nombre}/rental-history`, {
            ...returnData,
            fecha_renta: traila.fecha_renta,
            fecha_devolucion: returnData.fecha_devolucion,
            observaciones: returnData.observaciones
          });
          console.log('📝 Historial de devolución registrado');
        } catch (historyError) {
          console.error('❌ Error registrando historial de devolución:', historyError);
        }

        await refreshTrailas();

        alert('Trailer devuelto exitosamente');
      } catch (error: any) {
        console.error('❌ Error returning trailer:', error);
        alert(`Error al devolver el trailer: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  // Handle mark as available
  const handleMarkAsAvailable = async () => {
    if (!selectedTraila) return;
    
    try {
      console.log('🔄 Marcando trailer como disponible:', selectedTraila.id, availableForm);
      
      const availableData = {
        fecha_devolucion_real: availableForm.fecha_disponible,
        observaciones_devolucion: `${availableForm.motivo ? availableForm.motivo + ' - ' : ''}${availableForm.observaciones}`,
        usuario: getCurrentUser()
      };
      
      const response = await axios.put(`${API_URL}/trailas/${selectedTraila.id}/return`, availableData);
      console.log('✅ Trailer marcado como disponible exitosamente:', response.data);

      await refreshTrailas();
      
      // Close modal and reset form
      setShowAvailableModal(false);
      setAvailableForm({
        fecha_disponible: new Date().toISOString().split('T')[0],
        observaciones: '',
        motivo: ''
      });
      
      alert('Trailer marcado como disponible exitosamente');
    } catch (error: any) {
      console.error('❌ Error marking trailer as available:', error);
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
          um: part.um || part.uom || part.unit || 'EA',
          qty: Number(part.qty_used) || 0,
          unitCost: Number(part.cost) || 0,
          total: (Number(part.qty_used) || 0) * (Number(part.cost) || 0),
          invoice: part.invoice_number || 'N/A',
          invoiceLink: part.invoiceLink
        })),
        laborCost: laborCost,
        subtotalParts: subtotalParts,
        totalCost: totalCost,
        miscellaneousPercent: Number(workOrder.miscellaneous || 0),
        weldPercent: Number(workOrder.weldPercent || 0),
        miscellaneousFixed: Number(workOrder.miscellaneousFixed || 0),
        weldFixed: Number(workOrder.weldFixed || 0)
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
          <p style={{ color: '#1976d2', fontSize: '18px', margin: 0 }}>Loading trailers...</p>
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
      <TrailersHeaderBar trailerCount={filteredTrailas.length} />

      {/* Filters */}
      <TrailersFiltersBar
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        filter={filter}
        setFilter={setFilter}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        uniqueClients={getUniqueClients()}
      />

      {/* Trailers by Client Groups */}
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
                      <TrailerCard
                        key={traila.id}
                        traila={traila}
                        showCliente={false}
                        getStatusColor={getStatusColor}
                        onRent={handleOpenRentalModal}
                        onReturn={handleReturn}
                        onMarkAvailable={handleOpenAvailableModal}
                        onShowHistory={handleShowHistory}
                        onShowWorkOrders={handleShowWorkOrders}
                      />
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
            <TrailerCard
              key={traila.id}
              traila={traila}
              showCliente={true}
              getStatusColor={getStatusColor}
              onRent={handleOpenRentalModal}
              onReturn={handleReturn}
              onMarkAvailable={handleOpenAvailableModal}
              onShowHistory={handleShowHistory}
              onShowWorkOrders={handleShowWorkOrders}
            />
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
        <TrailerRentalModal
          trailerName={selectedTraila.nombre}
          rentalForm={rentalForm}
          setRentalForm={setRentalForm}
          onClose={() => setShowRentalModal(false)}
          onConfirm={handleRental}
        />
      )}

      {/* History Modal */}
      {showHistoryModal && selectedTraila && (
        <TrailerHistoryModal
          trailerName={selectedTraila.nombre}
          rentalHistory={rentalHistory}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* Work Order Modal */}
      {showWorkOrderModal && selectedTraila && (
        <TrailerWorkOrderModal
          trailerName={selectedTraila.nombre}
          workOrderHistory={workOrderHistory}
          workOrderMonthFilter={workOrderMonthFilter}
          setWorkOrderMonthFilter={setWorkOrderMonthFilter}
          onClose={() => setShowWorkOrderModal(false)}
          onViewPDF={handleViewWorkOrderPDF}
        />
      )}

      {/* Mark as Available Modal */}
      {showAvailableModal && selectedTraila && (
        <TrailerAvailableModal
          trailerName={selectedTraila.nombre}
          availableForm={availableForm}
          setAvailableForm={setAvailableForm}
          onClose={() => {
            setShowAvailableModal(false);
            setAvailableForm({
              fecha_disponible: new Date().toISOString().split('T')[0],
              observaciones: '',
              motivo: ''
            });
          }}
          onConfirm={handleMarkAsAvailable}
        />
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
