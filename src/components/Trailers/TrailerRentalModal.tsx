import React from 'react';

interface RentalForm {
  cliente: string;
  fecha_renta: string;
  fecha_devolucion: string;
  observaciones: string;
}

interface TrailerRentalModalProps {
  trailerName: string;
  rentalForm: RentalForm;
  setRentalForm: React.Dispatch<React.SetStateAction<RentalForm>>;
  onClose: () => void;
  onConfirm: () => void;
}

const TrailerRentalModal: React.FC<TrailerRentalModalProps> = ({
  trailerName,
  rentalForm,
  setRentalForm,
  onClose,
  onConfirm,
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
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h2 style={{ color: '#1976d2', marginBottom: '24px' }}>
          Rentar Trailer: {trailerName}
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            Cliente *
          </label>
          <input
            type="text"
            value={rentalForm.cliente}
            onChange={(e) => setRentalForm({ ...rentalForm, cliente: e.target.value })}
            style={{
              width: '100%', padding: '12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px', fontSize: '14px'
            }}
            placeholder="Enter customer name..."
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
            onChange={(e) => setRentalForm({ ...rentalForm, fecha_renta: e.target.value })}
            style={{
              width: '100%', padding: '12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px', fontSize: '14px'
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
            onChange={(e) => setRentalForm({ ...rentalForm, fecha_devolucion: e.target.value })}
            style={{
              width: '100%', padding: '12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px', fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            Observaciones
          </label>
          <textarea
            value={rentalForm.observaciones}
            onChange={(e) => setRentalForm({ ...rentalForm, observaciones: e.target.value })}
            placeholder="Additional observations..."
            style={{
              width: '100%', padding: '12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px', fontSize: '14px',
              minHeight: '80px', resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: '#f5f5f5', color: '#666',
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontWeight: '600'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '12px 24px',
              background: '#4caf50', color: 'white',
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontWeight: '600'
            }}
          >
            Confirmar Renta
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrailerRentalModal;
