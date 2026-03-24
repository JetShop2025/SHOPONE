import React from 'react';
import WorkOrderForm from './WorkOrderForm';

interface WorkOrdersEditModalProps {
  showEditForm: boolean;
  modalStyle: React.CSSProperties;
  modalContentStyle: React.CSSProperties;
  editWorkOrder: any | null;
  editId: string;
  setEditId: React.Dispatch<React.SetStateAction<string>>;
  editPassword: string;
  setEditPassword: React.Dispatch<React.SetStateAction<string>>;
  editError: string;
  setEditError: React.Dispatch<React.SetStateAction<string>>;
  workOrders: any[];
  normalizeWorkOrderForEdit: (order: any) => any;
  setEditWorkOrder: React.Dispatch<React.SetStateAction<any | null>>;
  setExtraOptions: React.Dispatch<React.SetStateAction<string[]>>;
  setShowEditForm: React.Dispatch<React.SetStateAction<boolean>>;
  setIdClassicError: React.Dispatch<React.SetStateAction<string>>;
  handleWorkOrderChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any) => void;
  handlePartChange: (index: number, field: string, value: string) => void;
  handleEditWorkOrderSubmit: (data: any) => Promise<void>;
  billToCoOptions: string[];
  getTrailerOptionsWithPendingIndicator: (billToCo: string) => string[];
  trailersWithPendingParts: string[];
  inventory: any[];
  addEmptyPart: () => void;
  addPendingPart: (part: any, qty: number) => void;
  deletePart: (index: number) => void;
  pendingParts: any[];
  pendingPartsQty: { [id: number]: string };
  setPendingPartsQty: React.Dispatch<React.SetStateAction<{ [id: number]: string }>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  idClassicError: string;
}

const WorkOrdersEditModal: React.FC<WorkOrdersEditModalProps> = ({
  showEditForm,
  modalStyle,
  modalContentStyle,
  editWorkOrder,
  editId,
  setEditId,
  editPassword,
  setEditPassword,
  editError,
  setEditError,
  workOrders,
  normalizeWorkOrderForEdit,
  setEditWorkOrder,
  setExtraOptions,
  setShowEditForm,
  setIdClassicError,
  handleWorkOrderChange,
  handlePartChange,
  handleEditWorkOrderSubmit,
  billToCoOptions,
  getTrailerOptionsWithPendingIndicator,
  inventory,
  addEmptyPart,
  addPendingPart,
  deletePart,
  trailersWithPendingParts,
  pendingParts,
  pendingPartsQty,
  setPendingPartsQty,
  loading,
  setLoading,
  idClassicError,
}) => {
  if (!showEditForm) return null;

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        {!editWorkOrder ? (
          <div
            style={{
              marginBottom: 24,
              border: '1px solid orange',
              background: '#fffbe6',
              borderRadius: 8,
              padding: 24,
              maxWidth: 700,
              marginLeft: 'auto',
              marginRight: 'auto',
              boxShadow: '0 2px 8px rgba(255,152,0,0.10)',
            }}
          >
            <h2 style={{ color: '#ff9800', marginBottom: 12 }}>Edit Work Order</h2>

            <label style={{ fontWeight: 600 }}>
              ID:
              <input
                type="number"
                placeholder="ID to edit"
                value={editId}
                onChange={(e) => setEditId(e.target.value)}
                style={{ width: 100, marginLeft: 8, marginRight: 8, borderRadius: 4, border: '1px solid #ff9800', padding: 4 }}
              />
            </label>

            <label style={{ fontWeight: 600, marginLeft: 16 }}>
              Password:
              <input
                type="password"
                placeholder="Password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                style={{ width: 100, marginLeft: 8, marginRight: 8, borderRadius: 4, border: '1px solid #ff9800', padding: 4 }}
              />
            </label>

            <button
              className="wo-btn secondary"
              style={{ marginLeft: 8 }}
              onClick={() => {
                if (editPassword !== '6214') {
                  setEditError('Incorrect password');
                  return;
                }

                const found = workOrders.find((wo) => wo.id === Number(editId));
                if (found) {
                  const normalizedOrder = normalizeWorkOrderForEdit(found);
                  setEditWorkOrder(normalizedOrder);
                  setExtraOptions(normalizedOrder.extraOptions || []);
                  setEditError('');
                } else {
                  setEditError('No order found with that ID.');
                }
              }}
            >
              Load
            </button>

            <button
              className="wo-btn secondary"
              style={{ marginLeft: 8 }}
              onClick={() => {
                setShowEditForm(false);
                setEditId('');
                setEditWorkOrder(null);
                setEditError('');
                setEditPassword('');
                setIdClassicError('');
              }}
            >
              Cancel
            </button>

            {editError && <div style={{ color: 'red', marginTop: 8 }}>{editError}</div>}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#0A3854' }}>
              Order ID: {editWorkOrder.id}
            </div>

            {showEditForm && (!editWorkOrder || !Array.isArray(editWorkOrder.parts)) && (
              <div style={{ color: 'red', padding: 32 }}>No data to edit.</div>
            )}

            <WorkOrderForm
              workOrder={editWorkOrder}
              workOrderNumber={editWorkOrder?.id}
              onChange={handleWorkOrderChange}
              onPartChange={handlePartChange}
              onSubmit={handleEditWorkOrderSubmit}
              onCancel={() => {
                setShowEditForm(false);
                setEditWorkOrder(null);
                setEditId('');
                setEditError('');
                setIdClassicError('');
              }}
              title="Edit Work Order"
              billToCoOptions={billToCoOptions}
              getTrailerOptions={getTrailerOptionsWithPendingIndicator}
              inventory={inventory}
              onAddEmptyPart={addEmptyPart}
              onAddPendingPart={addPendingPart}
              onDeletePart={deletePart}
              trailersWithPendingParts={trailersWithPendingParts}
              pendingParts={pendingParts}
              pendingPartsQty={pendingPartsQty}
              setPendingPartsQty={setPendingPartsQty}
              loading={loading}
              setLoading={setLoading}
              idClassicError={idClassicError}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default WorkOrdersEditModal;
