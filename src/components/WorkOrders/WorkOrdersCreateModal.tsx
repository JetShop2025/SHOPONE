import React from 'react';
import WorkOrderForm from './WorkOrderForm';

interface WorkOrdersCreateModalProps {
  showForm: boolean;
  modalStyle: React.CSSProperties;
  modalContentStyle: React.CSSProperties;
  newWorkOrder: any;
  nextWorkOrderNumber: number;
  handleWorkOrderChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any) => void;
  handlePartChange: (index: number, field: string, value: string) => void;
  handleAddWorkOrder: (data: any) => Promise<void>;
  resetNewWorkOrder: () => void;
  setExtraOptions: React.Dispatch<React.SetStateAction<string[]>>;
  setPendingPartsQty: React.Dispatch<React.SetStateAction<{ [id: number]: string }>>;
  setSelectedPendingParts: React.Dispatch<React.SetStateAction<number[]>>;
  setIdClassicError: React.Dispatch<React.SetStateAction<string>>;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  billToCoOptions: string[];
  getTrailerOptionsWithPendingIndicator: (billToCo: string) => string[];
  inventory: any[];
  trailersWithPendingParts: string[];
  pendingParts: any[];
  pendingPartsQty: { [id: number]: string };
  setPendingPartsQtyState: React.Dispatch<React.SetStateAction<{ [id: number]: string }>>;
  addPendingPart: (part: any, qty: number) => void;
  addEmptyPart: () => void;
  deletePart: (index: number) => void;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  idClassicError: string;
}

const WorkOrdersCreateModal: React.FC<WorkOrdersCreateModalProps> = ({
  showForm,
  modalStyle,
  modalContentStyle,
  newWorkOrder,
  nextWorkOrderNumber,
  handleWorkOrderChange,
  handlePartChange,
  handleAddWorkOrder,
  resetNewWorkOrder,
  setExtraOptions,
  setPendingPartsQty,
  setSelectedPendingParts,
  setIdClassicError,
  setShowForm,
  billToCoOptions,
  getTrailerOptionsWithPendingIndicator,
  inventory,
  trailersWithPendingParts,
  pendingParts,
  pendingPartsQty,
  setPendingPartsQtyState,
  addPendingPart,
  addEmptyPart,
  deletePart,
  loading,
  setLoading,
  idClassicError,
}) => {
  if (!showForm) return null;

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <WorkOrderForm
          workOrder={newWorkOrder}
          workOrderNumber={nextWorkOrderNumber}
          onChange={handleWorkOrderChange}
          onPartChange={handlePartChange}
          onSubmit={(data) => handleAddWorkOrder(data || newWorkOrder)}
          onCancel={() => {
            resetNewWorkOrder();
            setExtraOptions([]);
            setPendingPartsQty({});
            setSelectedPendingParts([]);
            setIdClassicError('');
            setShowForm(false);
          }}
          title="New Work Order"
          billToCoOptions={billToCoOptions}
          getTrailerOptions={getTrailerOptionsWithPendingIndicator}
          inventory={inventory}
          trailersWithPendingParts={trailersWithPendingParts}
          pendingParts={pendingParts}
          pendingPartsQty={pendingPartsQty}
          setPendingPartsQty={setPendingPartsQtyState}
          onAddPendingPart={(part, qty) => addPendingPart(part, qty || part.qty || 1)}
          onAddEmptyPart={addEmptyPart}
          onDeletePart={deletePart}
          loading={loading}
          setLoading={setLoading}
          idClassicError={idClassicError}
        />
      </div>
    </div>
  );
};

export default WorkOrdersCreateModal;
