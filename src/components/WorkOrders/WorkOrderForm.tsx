import React from 'react';

interface WorkOrderFormProps {
  workOrder: any;
  onChange: (e: React.ChangeEvent<any>, index?: number, field?: string) => void;
  onPartChange: (index: number, field: string, value: string) => void;
  onSubmit: (data?: any) => Promise<void> | void;
  onCancel: () => void;
  title: string;
  billToCoOptions: string[];
  getTrailerOptions: (billToCo: string) => string[];
  inventory: any[];
  extraOptions: string[];
  setExtraOptions: React.Dispatch<React.SetStateAction<string[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  // Optional props that may be passed from WorkOrdersTable
  trailersWithPendingParts?: any[];
  pendingParts?: any[];
  pendingPartsQty?: any;
  setPendingPartsQty?: React.Dispatch<React.SetStateAction<any>>;
  onAddPendingPart?: (part: any, qty: any) => void;
  onAddEmptyPart?: () => void;
}

interface Part {
  sku: string;
  part: string;
  qty: number;
  cost: number;
  [key: string]: any;
}

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  workOrder, 
  onChange, 
  onPartChange, 
  onSubmit, 
  onCancel, 
  title, 
  billToCoOptions, 
  getTrailerOptions, 
  inventory, 
  extraOptions, 
  setExtraOptions, 
  loading, 
  setLoading,
  trailersWithPendingParts,
  pendingParts,
  pendingPartsQty,
  setPendingPartsQty,
  onAddPendingPart,
  onAddEmptyPart
}) => {
  const [successMsg, setSuccessMsg] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanParts = workOrder.parts
        .filter((p: Part) => p.sku && String(p.sku).trim() !== '')
        .map((p: Part) => ({
          ...p,
          cost: Number(String(p.cost).replace(/[^0-9.]/g, ''))
        }));

      const hasInvalidQty = cleanParts.some((p: Part) => !p.qty || Number(p.qty) <= 0);
      if (hasInvalidQty) {
        window.alert('Hay partes con cantidad inválida.');
        setLoading(false);
        return;
      }

      // Preparar datos para enviar
      const dataToSend = {
        ...workOrder,
        parts: cleanParts,
        extraOptions,
        usuario: localStorage.getItem('username') || ''
      };

      await onSubmit(dataToSend);
      setSuccessMsg('¡Orden creada exitosamente!');
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setSuccessMsg('');
      if (err.response && err.response.data) {
        window.alert(`Error: ${err.response.data.error || err.response.data}`);
      } else {
        window.alert(`Error: ${err.message}`);
      }
    }
  };

  return (
    <div
      style={{
        marginTop: '20px',
        border: '1px solid #1976d2',
        borderRadius: 8,
        padding: '24px',
        background: '#f5faff',
        maxWidth: 700,
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.08)'
      }}
    >
      <h2 style={{ color: '#1976d2', marginBottom: 16 }}>{title}</h2>
      {loading && (
        <div style={{ color: '#1976d2', fontWeight: 700, marginBottom: 12 }}>
          Procesando, por favor espera...
        </div>
      )}
      {successMsg && (
        <div style={{ color: 'green', fontWeight: 700, marginBottom: 12 }}>
          {successMsg}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <label style={{ flex: '1 1 200px' }}>
            Bill To Co<span style={{ color: 'red' }}>*</span>
            <input
              list="clientes"
              name="billToCo"
              value={workOrder.billToCo || ''}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
              required
              autoComplete="off"
              placeholder="Escribe o selecciona..."
            />
            <datalist id="clientes">
              {billToCoOptions.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </label>
          
          <label style={{ flex: '1 1 120px' }}>
            Fecha<span style={{ color: 'red' }}>*</span>
            <input
              type="date"
              name="date"
              value={workOrder.date || ''}
              onChange={onChange}
              required
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          
          <label style={{ flex: '1 1 120px' }}>
            Trailer
            <input
              type="text"
              name="trailer"
              placeholder="Trailer"
              value={workOrder.trailer || ''}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
        </div>
        
        <div style={{ marginTop: 16 }}>
          <label style={{ width: '100%' }}>
            Descripción<span style={{ color: 'red' }}>*</span>
            <textarea
              name="description"
              placeholder="Descripción*"
              value={workOrder.description || ''}
              onChange={onChange}
              rows={3}
              style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
              required
            />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Partes</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {workOrder.parts && workOrder.parts.map((part: Part, index: number) => (
              <div key={index} style={{
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: 8,
                minWidth: 180,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <label>
                  PRT
                  <input
                    type="text"
                    value={part.part || ''}
                    onChange={e => onPartChange(index, 'part', e.target.value)}
                    style={{ width: '100%', marginTop: 2 }}
                    placeholder="Parte"
                  />
                </label>
                <label>
                  Qty
                  <input
                    type="number"
                    value={part.qty || ''}
                    onChange={e => onPartChange(index, 'qty', e.target.value)}
                    style={{ width: '100%', marginTop: 2 }}
                    placeholder="Cantidad"
                  />
                </label>
                <label>
                  Costo
                  <input
                    type="text"
                    value={part.cost || ''}
                    onChange={e => onPartChange(index, 'cost', e.target.value)}
                    style={{ width: '100%', marginTop: 2 }}
                    placeholder="$0.00"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <label style={{ flex: 1 }}>
            Status<span style={{ color: 'red' }}>*</span>
            <select
              name="status"
              value={workOrder.status || ''}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
              required
            >
              <option value="">Select...</option>
              <option value="PRE W.O">PRE W.O</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="FINISHED">FINISHED</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ width: '100%' }}>
            ID CLASSIC:
            <input
              type="text"
              name="idClassic"
              value={workOrder.idClassic || ''}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
              placeholder="ID Classic (opcional)"
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? '#ccc' : '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
            }}
          >
            {loading ? 'Procesando...' : 'Save'}
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '12px 24px',
              background: '#fff',
              color: '#1976d2',
              border: '1px solid #1976d2',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkOrderForm;
