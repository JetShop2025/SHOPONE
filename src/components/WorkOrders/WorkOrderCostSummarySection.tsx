import React from 'react';

interface WorkOrderCostSummarySectionProps {
  workOrder: any;
  onChange: (e: React.ChangeEvent<any>) => void;
  onCancel: () => void;
  loading: boolean;
  setManualTotalOverride: React.Dispatch<React.SetStateAction<boolean>>;
  calculateTotalHours: () => number;
  calculatePartsTotal: () => number;
  getMiscAmount: (subtotal: number) => number;
  getWeldAmount: (subtotal: number) => number;
  calculateTotalLabAndParts: () => number;
}

const WorkOrderCostSummarySection: React.FC<WorkOrderCostSummarySectionProps> = ({
  workOrder,
  onChange,
  onCancel,
  loading,
  setManualTotalOverride,
  calculateTotalHours,
  calculatePartsTotal,
  getMiscAmount,
  getWeldAmount,
  calculateTotalLabAndParts,
}) => {
  const totalHours = calculateTotalHours();
  const laborTotal = totalHours * 60;
  const partsTotal = calculatePartsTotal();
  const subtotal = laborTotal + partsTotal;
  const miscAmount = getMiscAmount(subtotal);
  const weldAmount = getWeldAmount(subtotal);

  return (
    <>
      <div style={{ marginBottom: 0, gridColumn: 'span 4', minWidth: 0 }}>
        <strong>Miscellaneous</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 500, color: '#0A3854', marginRight: 4, display: 'inline-flex', alignItems: 'center' }}>
            % Miscellaneous:
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              name="miscellaneous"
              value={workOrder.miscellaneous ?? ''}
              onChange={(e) => {
                onChange({ target: { name: 'miscellaneous', value: e.target.value } } as any);
              }}
              style={{ width: 76, marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
              placeholder="%"
            />
          </label>
          <label style={{ fontWeight: 500, color: '#0A3854', marginRight: 4, display: 'inline-flex', alignItems: 'center' }}>
            $ Closed:
            <input
              type="number"
              min="0"
              step="0.01"
              name="miscellaneousFixed"
              value={workOrder.miscellaneousFixed ?? ''}
              onChange={(e) => {
                onChange({ target: { name: 'miscellaneousFixed', value: e.target.value } } as any);
              }}
              style={{ width: 92, marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
              placeholder="$"
            />
          </label>
          <span style={{ color: '#0A3854', fontWeight: 700, whiteSpace: 'nowrap', background: '#f0f4f8', border: '1px solid #b0c4de', borderRadius: 6, padding: '6px 10px' }}>
            Extra charge: ${miscAmount.toFixed(2)}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 0, gridColumn: 'span 4', minWidth: 0 }}>
        <strong>Welding Supplies</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 500, color: '#0A3854', marginRight: 4, display: 'inline-flex', alignItems: 'center' }}>
            % Welding Supplies:
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              name="weldPercent"
              value={workOrder.weldPercent ?? ''}
              onChange={(e) => {
                onChange({ target: { name: 'weldPercent', value: e.target.value } } as any);
              }}
              style={{ width: 76, marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
              placeholder="%"
            />
          </label>
          <label style={{ fontWeight: 500, color: '#0A3854', marginRight: 4, display: 'inline-flex', alignItems: 'center' }}>
            $ Closed:
            <input
              type="number"
              min="0"
              step="0.01"
              name="weldFixed"
              value={workOrder.weldFixed ?? ''}
              onChange={(e) => {
                onChange({ target: { name: 'weldFixed', value: e.target.value } } as any);
              }}
              style={{ width: 92, marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
              placeholder="$"
            />
          </label>
          <span style={{ color: '#0A3854', fontWeight: 700, whiteSpace: 'nowrap', background: '#f0f4f8', border: '1px solid #b0c4de', borderRadius: 6, padding: '6px 10px' }}>
            Extra charge: ${weldAmount.toFixed(2)}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 16, gridColumn: 'span 4', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', flexDirection: 'column' }}>
            Total LAB & PARTS
            <input
              type="text"
              name="totalLabAndParts"
              value={
                (workOrder.totalLabAndParts === 0 || workOrder.totalLabAndParts === '0' ||
                  (workOrder.totalLabAndParts !== undefined && workOrder.totalLabAndParts !== null && String(workOrder.totalLabAndParts).trim() !== ''))
                  ? (typeof workOrder.totalLabAndParts === 'number' ? `$${workOrder.totalLabAndParts.toFixed(2)}` : String(workOrder.totalLabAndParts))
                  : `$${calculateTotalLabAndParts().toFixed(2)}`
              }
              onChange={(e) => {
                setManualTotalOverride(true);
                onChange(e as any);
              }}
              style={{
                width: 220,
                marginTop: 4,
                padding: '8px 10px',
                fontWeight: 'bold',
                backgroundColor: '#ffffff',
                border: '2px solid #0A3854',
                color: '#0A3854',
                fontSize: '16px',
                borderRadius: 6,
              }}
              placeholder="$0.00"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setManualTotalOverride(false);
              const calculatedTotal = calculateTotalLabAndParts();
              onChange({ target: { name: 'totalLabAndParts', value: `$${calculatedTotal.toFixed(2)}` } } as any);
            }}
            style={{
              padding: '8px 12px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: '12px',
              marginTop: 0,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Auto Calculate
          </button>
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: 4, maxWidth: 620 }}>
          Suggested calculation: Labor (${laborTotal.toFixed(2)}) + Parts (${partsTotal.toFixed(2)}) + Miscellaneous (${miscAmount.toFixed(2)}) + Welding Supplies (${weldAmount.toFixed(2)}) = ${(subtotal + miscAmount + weldAmount).toFixed(2)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 8, gridColumn: '1 / -1', position: 'sticky', bottom: 0, background: '#fff', paddingTop: 12, borderTop: '1px solid #d9e2ec', zIndex: 3 }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: loading ? '#ccc' : '#0A3854',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 16,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Processing...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '12px 24px',
            background: '#fff',
            color: '#0A3854',
            border: '1px solid #0A3854',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
};

export default WorkOrderCostSummarySection;
