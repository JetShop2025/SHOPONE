import React from 'react';

interface PendingPart {
  id: string | number;
  sku: string;
  item: string;
  qty?: number;
  qty_remaining?: number;
  [key: string]: any;
}

interface WorkOrderPendingPartsPreviewProps {
  trailerName: string;
  pendingParts: PendingPart[];
  pendingPartsQty: any;
  setPendingPartsQty: React.Dispatch<React.SetStateAction<any>>;
  onAddPendingPart: (part: PendingPart, qty: number) => void;
}

const WorkOrderPendingPartsPreview: React.FC<WorkOrderPendingPartsPreviewProps> = ({
  trailerName,
  pendingParts,
  pendingPartsQty,
  setPendingPartsQty,
  onAddPendingPart,
}) => {
  return (
    <div style={{
      marginBottom: 0,
      padding: 16,
      border: '2px solid #4caf50',
      borderRadius: 8,
      backgroundColor: '#f1f8e9',
      gridColumn: '1 / -1'
    }}>
      <h3 style={{
        color: '#388e3c',
        marginBottom: 12,
        fontSize: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        🚛 Pending Parts for {trailerName}
        <span style={{
          fontSize: 12,
          background: '#4caf50',
          color: 'white',
          padding: '2px 8px',
          borderRadius: 12
        }}>
          {pendingParts.length} available
        </span>
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 12
      }}>
        {pendingParts.map((part) => {
          const availableQty = part.qty !== undefined ? Number(part.qty) : (part.qty_remaining !== undefined ? Number(part.qty_remaining) : 0);
          const hasQtyAvailable = availableQty > 0;
          return (
            <div key={part.id} style={{
              background: hasQtyAvailable ? 'white' : '#f5f5f5',
              border: hasQtyAvailable ? '1px solid #c8e6c9' : '1px solid #e0e0e0',
              borderRadius: 6,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              opacity: hasQtyAvailable ? 1 : 0.7
            }}>
              <div style={{ fontWeight: 'bold', color: hasQtyAvailable ? '#2e7d32' : '#666' }}>
                {part.sku} - {part.item}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>
                Available Qty: <strong style={{ color: hasQtyAvailable ? '#2e7d32' : '#f44336' }}>
                  {availableQty} {hasQtyAvailable ? '' : '(Out of Stock)'}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, availableQty)}
                  value={pendingPartsQty?.[part.id] || '1'}
                  onChange={(e) => {
                    setPendingPartsQty((prev: any) => ({
                      ...prev,
                      [part.id]: e.target.value
                    }));
                  }}
                  disabled={!hasQtyAvailable}
                  style={{
                    width: '80px',
                    padding: '4px 8px',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    backgroundColor: hasQtyAvailable ? 'white' : '#f5f5f5'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (hasQtyAvailable) {
                      const qty = parseInt(pendingPartsQty?.[part.id] || '1');
                      onAddPendingPart(part, qty);
                    }
                  }}
                  disabled={!hasQtyAvailable}
                  style={{
                    padding: '6px 12px',
                    background: hasQtyAvailable ? '#4caf50' : '#bdbdbd',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: hasQtyAvailable ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}
                >
                  {hasQtyAvailable ? '➕ Add to WO' : '❌ Out of Stock'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 12,
        padding: 8,
        background: '#e8f5e8',
        borderRadius: 4,
        fontSize: 12,
        color: '#2e7d32'
      }}>
        💡 <strong>Tip:</strong> These parts are already assigned to this trailer.
        When added, they will be automatically deducted from inventory.
      </div>
    </div>
  );
};

export default WorkOrderPendingPartsPreview;
