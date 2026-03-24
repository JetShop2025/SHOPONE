import React from 'react';

interface TrailerWorkOrderModalProps {
  trailerName: string;
  workOrderHistory: any[];
  workOrderMonthFilter: string;
  setWorkOrderMonthFilter: React.Dispatch<React.SetStateAction<string>>;
  onClose: () => void;
  onViewPDF: (workOrder: any) => void;
}

const TrailerWorkOrderModal: React.FC<TrailerWorkOrderModalProps> = ({
  trailerName,
  workOrderHistory,
  workOrderMonthFilter,
  setWorkOrderMonthFilter,
  onClose,
  onViewPDF,
}) => {
  const filteredWorkOrders = workOrderMonthFilter === 'ALL'
    ? workOrderHistory
    : workOrderHistory.filter(wo => {
        if (!wo.date) return false;
        return wo.date.slice(0, 7) === workOrderMonthFilter;
      });

  return (
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
        padding: '32px',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h2 style={{ color: '#1976d2', marginBottom: '24px' }}>
          Historial de Work Orders: {trailerName}
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
              ({filteredWorkOrders.length} de {workOrderHistory.length} work orders)
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
                {filteredWorkOrders.length > 0 ? (
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
                          onClick={() => onViewPDF(wo)}
                          style={{
                            padding: '4px 8px',
                            background: '#f44336', color: 'white',
                            border: 'none', borderRadius: '4px',
                            cursor: 'pointer', fontSize: '12px', fontWeight: '600'
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
                )}
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
            onClick={() => {
              setWorkOrderMonthFilter('ALL');
              onClose();
            }}
            style={{
              padding: '12px 24px',
              background: '#1976d2', color: 'white',
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontWeight: '600'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrailerWorkOrderModal;
