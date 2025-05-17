import React from 'react';

interface WorkOrderFormProps {
  workOrder: any;
  onChange: (e: React.ChangeEvent<any>, index?: number, field?: string) => void;
  onPartChange: (index: number, field: string, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  title: string;
  billToCoOptions: string[];
  getTrailerOptions: (billToCo: string) => string[];
  inventory: any[];
  trailersWithPendingParts?: string[];
  pendingParts?: any[];
  pendingPartsQty?: { [id: number]: string };
  setPendingPartsQty?: React.Dispatch<React.SetStateAction<{ [id: number]: string }>>;
  onAddPendingPart?: (part: any, qty: string) => void;
}

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  workOrder, onChange, onPartChange, onSubmit, onCancel, title, billToCoOptions, getTrailerOptions, inventory, trailersWithPendingParts, pendingParts, pendingPartsQty, setPendingPartsQty, onAddPendingPart
}) => {
  const handlePartChange = (index: number, field: string, value: string) => {
    if (field === 'part') {
      // Busca el costo en el inventario
      const found = inventory.find(item => item.sku === value);
      const cost = found ? (found.price || found.costTax || '') : '';
      onPartChange(index, 'part', value);
      onPartChange(index, 'cost', cost.toString());
    } else {
      onPartChange(index, field, value);
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
      <form
        onSubmit={e => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <label style={{ flex: '1 1 200px' }}>
            Bill To Co<span style={{ color: 'red' }}>*</span>
            <select
              name="billToCo"
              value={workOrder.billToCo}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
            >
              <option value="">Selecciona...</option>
              {billToCoOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: '1 1 120px' }}>
            Trailer<span style={{ color: 'red' }}>*</span>
            {(() => {
              const trailerOpts = getTrailerOptions(workOrder.billToCo);
              if (trailerOpts.length > 0) {
                return (
                  <select
                    name="trailer"
                    value={workOrder.trailer}
                    onChange={onChange}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <option value="">Selecciona...</option>
                    {trailerOpts.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                        {trailersWithPendingParts && trailersWithPendingParts.includes(opt) ? '  • Pending Parts' : ''}
                      </option>
                    ))}
                  </select>
                );
              } else {
                return (
                  <input
                    type="text"
                    name="trailer"
                    placeholder="Trailer*"
                    value={workOrder.trailer}
                    onChange={onChange}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                );
              }
            })()}
          </label>
          <label style={{ flex: '1 1 150px' }}>
            Mechanic<span style={{ color: 'red' }}>*</span>
            <input
              type="text"
              name="mechanic"
              placeholder="Mechanic*"
              value={workOrder.mechanic}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ flex: '1 1 150px' }}>
            Date<span style={{ color: 'red' }}>*</span>
            <input
              type="date"
              name="date"
              value={workOrder.date || ''}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
              required
            />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ width: '100%' }}>
            Descripción<span style={{ color: 'red' }}>*</span>
            <textarea
              name="description"
              placeholder="Descripción*"
              value={workOrder.description}
              onChange={onChange}
              rows={3}
              style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
            />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <strong>Partes</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {workOrder.parts.map((part: any, index: number) => (
              <div key={index} style={{ border: '1px solid #ccc', borderRadius: 4, padding: 8, minWidth: 180 }}>
                <label>
                  PRT{index + 1}
                  <select
                    name="part"
                    value={part.part}
                    onChange={e => handlePartChange(index, 'part', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <option value="">Selecciona...</option>
                    {inventory.map(item => (
                      <option key={item.sku} value={item.sku}>
                        {item.sku} - {item.part}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Qty
                  <input
                    type="number"
                    placeholder="Cantidad"
                    value={part.qty}
                    onChange={e => handlePartChange(index, 'qty', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
                <label>
                  Costo
                  <input
                    type="text"
                    placeholder="Costo"
                    value={part.cost}
                    onChange={e => handlePartChange(index, 'cost', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
        {pendingParts && pendingParts.length > 0 && (
          <div style={{ margin: '12px 0', background: '#fffbe6', border: '1px solid #ffd600', borderRadius: 6, padding: 12 }}>
            <strong>Pending Parts for this trailer:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {pendingParts.map((part, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #1976d2',
                    borderRadius: 4,
                    padding: '6px 12px',
                    background: '#e3f2fd',
                    cursor: 'pointer'
                  }}
                  title="Click to add to WO"
                  onClick={() => onAddPendingPart && onAddPendingPart(part, part.qty)}
                >
                  {part.sku} - {part.item} ({part.qty} pcs)
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#1976d2', marginTop: 4 }}>
              Click a part to add it to the WO parts list.
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <label style={{ flex: 1 }}>
            Total HRS<span style={{ color: 'red' }}>*</span>
            <input
              type="text"
              name="totalHrs"
              placeholder="Total HRS*"
              value={workOrder.totalHrs}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ flex: 1 }}>
            Total LAB & PRTS<span style={{ color: 'red' }}>*</span>
            <input
              type="text"
              name="totalLabAndParts"
              placeholder="Total LAB & PRTS*"
              value={workOrder.totalLabAndParts}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ flex: 1 }}>
            Status<span style={{ color: 'red' }}>*</span>
            <select
              name="status"
              value={workOrder.status}
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
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button type="submit" style={{ background: '#1976d2', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: 4 }}>Save</button>
          <button type="button" onClick={onCancel} style={{ background: '#fff', color: '#1976d2', border: '1px solid #1976d2', padding: '8px 20px', borderRadius: 4 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default WorkOrderForm;