import React from 'react';

interface WorkOrderPartsSectionProps {
  workOrder: any;
  inventory: any[];
  onAddEmptyPart?: () => void;
  onDeletePart?: (index: number) => void;
  handlePartChange: (index: number, field: string, value: string) => void;
  showTooltipForPart: (event: React.MouseEvent | React.FocusEvent, sku: string, partIndex?: number) => void;
  hideTooltip: () => void;
}

const WorkOrderPartsSection: React.FC<WorkOrderPartsSectionProps> = ({
  workOrder,
  inventory,
  onAddEmptyPart,
  onDeletePart,
  handlePartChange,
  showTooltipForPart,
  hideTooltip,
}) => {
  return (
    <div style={{ marginBottom: 0, gridColumn: '1 / -1', minWidth: 0, maxHeight: 430, overflowY: 'auto', overflowX: 'hidden', padding: 12, border: '1px solid #d9e2ec', borderRadius: 8, background: '#f8fbff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'space-between' }}>
        <strong>Parts ({(workOrder.parts || []).length})</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onAddEmptyPart && (
            <button
              type="button"
              onClick={onAddEmptyPart}
              style={{
                padding: '4px 8px',
                background: '#0A3854',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              + Agregar Parte
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#5f7387', marginBottom: 10 }}>
        Vista en lista por tarjetas con 2+ columnas y scroll interno para evitar desbordes.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, alignItems: 'start' }}>
        {workOrder.parts && workOrder.parts.map((part: any, index: number) => (
          <div
            key={index}
            style={{
              border: '1px solid #cdd9e5',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              position: 'relative',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(10,56,84,0.08)',
            }}
          >
            {onDeletePart && (
              <button
                type="button"
                onClick={() => onDeletePart(index)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  fontSize: 12,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
                title="Delete part"
              >
                ×
              </button>
            )}

            <label style={{ fontSize: 12, fontWeight: 'bold' }}>
              SKU
              <input
                list={`inventory-${index}`}
                type="text"
                value={part.sku || ''}
                onChange={(e) => handlePartChange(index, 'sku', e.target.value)}
                onFocus={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.value) {
                    showTooltipForPart(e, target.value, index);
                  }
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.value) {
                    showTooltipForPart(e, target.value, index);
                  }
                }}
                onMouseLeave={hideTooltip}
                onBlur={hideTooltip}
                style={{ width: '100%', marginTop: 2, padding: 4 }}
                placeholder="SKU"
              />
              <datalist id={`inventory-${index}`}>
                {inventory.map((item: any) => {
                  const cost = item.precio || item.cost || item.price || item.unitCost || item.unit_cost || 0;
                  const name = item.part || item.description || item.name || 'Sin nombre';
                  return (
                    <option key={item.sku} value={item.sku}>
                      {name} - ${typeof cost === 'number' ? cost.toFixed(2) : parseFloat(String(cost)).toFixed(2)}
                    </option>
                  );
                })}
              </datalist>
            </label>

            <label style={{ fontSize: 12, fontWeight: 'bold' }}>
              Part Name
              <input
                type="text"
                value={part.part || ''}
                onChange={(e) => handlePartChange(index, 'part', e.target.value)}
                style={{ width: '100%', marginTop: 2, padding: 4, backgroundColor: '#f0f8ff' }}
                placeholder="Part description"
              />
            </label>

            <label style={{ fontSize: 12, fontWeight: 'bold' }}>
              Quantity
              <input
                type="number"
                value={part.qty || ''}
                onChange={(e) => handlePartChange(index, 'qty', e.target.value)}
                style={{ width: '100%', marginTop: 2, padding: 4 }}
                placeholder="Quantity"
              />
            </label>

            <label style={{ fontSize: 12, fontWeight: 'bold' }}>
              Unit Cost
              <input
                type="text"
                value={part.cost || ''}
                onChange={(e) => handlePartChange(index, 'cost', e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 2,
                  padding: 4,
                  backgroundColor: part.cost && parseFloat(String(part.cost)) > 0 ? '#e8f5e8' : '#ffffff',
                  border: part.cost && parseFloat(String(part.cost)) > 0 ? '2px solid #4caf50' : '1px solid #ccc',
                }}
                placeholder="$0.00"
              />
            </label>

            <div style={{ fontSize: 11, color: '#0A3854', fontWeight: 'bold', marginTop: 4 }}>
              Total: ${((parseFloat(String(part.qty || '0'))) * (parseFloat(String(part.cost).replace(/[^0-9.]/g, '')) || 0)).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {workOrder.parts && workOrder.parts.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: '#0A3854',
            color: 'white',
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          <span>PARTS TOTAL:</span>
          <span style={{ fontSize: 16 }}>
            ${workOrder.parts
              .reduce((total: number, part: any) => {
                const qty = parseFloat(String(part?.qty || '0'));
                const cost = parseFloat(String(part?.cost ?? '0').replace(/[^0-9.]/g, ''));
                return total + ((!isNaN(qty) && qty > 0 ? qty : 0) * (!isNaN(cost) && cost >= 0 ? cost : 0));
              }, 0)
              .toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default WorkOrderPartsSection;
