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
}

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  workOrder, onChange, onPartChange, onSubmit, onCancel, title, billToCoOptions, getTrailerOptions, inventory
}) => (
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
            <option value="">Select...</option>
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
                  <option value="">Select...</option>
                  {trailerOpts.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
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
          Description<span style={{ color: 'red' }}>*</span>
          <textarea
            name="description"
            placeholder="Description*"
            value={workOrder.description}
            onChange={onChange}
            rows={3}
            style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
          />
        </label>
      </div>
      <div style={{ marginTop: 16 }}>
        <strong>Parts</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {workOrder.parts.map((part: any, index: number) => (
            <div key={index} style={{ border: '1px solid #ccc', borderRadius: 4, padding: 8, minWidth: 180 }}>
              <label>
                PRT{index + 1}
                <input
                  list="inventory-parts"
                  value={part.part}
                  onChange={e => onPartChange(index, 'part', e.target.value)}
                  placeholder="Part (SKU or name)"
                />
                <datalist id="inventory-parts">
                  {inventory.map(item => (
                    <option key={item.sku} value={item.sku}>
                      {item.part} ({item.sku}) - {item.onHand} available
                    </option>
                  ))}
                </datalist>
              </label>
              <label>
                Qty
                <input
                  type="text"
                  placeholder="Qty"
                  value={part.qty}
                  onChange={e => onPartChange(index, 'qty', e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
              <label>
                Cost
                <input
                  type="text"
                  placeholder="Cost"
                  value={part.cost}
                  onChange={e => onPartChange(index, 'cost', e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
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

export default WorkOrderForm;