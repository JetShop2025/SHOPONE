import React from 'react';

interface AvailableForm {
  fecha_disponible: string;
  observaciones: string;
  motivo: string;
}

interface TrailerAvailableModalProps {
  trailerName: string;
  availableForm: AvailableForm;
  setAvailableForm: React.Dispatch<React.SetStateAction<AvailableForm>>;
  onClose: () => void;
  onConfirm: () => void;
}

const TrailerAvailableModal: React.FC<TrailerAvailableModalProps> = ({
  trailerName,
  availableForm,
  setAvailableForm,
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
        <h2 style={{ color: '#2e7d32', marginBottom: '24px' }}>
          ✅ Marcar como Disponible: {trailerName}
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            Fecha de Disponibilidad *
          </label>
          <input
            type="date"
            value={availableForm.fecha_disponible}
            onChange={(e) => setAvailableForm({ ...availableForm, fecha_disponible: e.target.value })}
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
            Motivo
          </label>
          <select
            value={availableForm.motivo}
            onChange={(e) => setAvailableForm({ ...availableForm, motivo: e.target.value })}
            style={{
              width: '100%', padding: '12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px', fontSize: '14px'
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
            onChange={(e) => setAvailableForm({ ...availableForm, observaciones: e.target.value })}
            style={{
              width: '100%', padding: '12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px', fontSize: '14px',
              minHeight: '80px', resize: 'vertical'
            }}
            placeholder="Additional status change details..."
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: '#9e9e9e', color: 'white',
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontWeight: '600'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!availableForm.fecha_disponible}
            style={{
              padding: '12px 24px',
              background: availableForm.fecha_disponible ? '#2e7d32' : '#cccccc',
              color: 'white',
              border: 'none', borderRadius: '8px',
              cursor: availableForm.fecha_disponible ? 'pointer' : 'not-allowed',
              fontWeight: '600'
            }}
          >
            ✅ Marcar Disponible
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrailerAvailableModal;
