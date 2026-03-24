import React from 'react';

interface TrailerHistoryModalProps {
  trailerName: string;
  rentalHistory: any[];
  onClose: () => void;
}

const TrailerHistoryModal: React.FC<TrailerHistoryModalProps> = ({
  trailerName,
  rentalHistory,
  onClose,
}) => {
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
          Historial de Rentas: {trailerName}
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
            onClick={onClose}
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

export default TrailerHistoryModal;
