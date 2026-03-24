import React from 'react';

interface WorkOrdersActionButtonsProps {
  selectedRow: number | null;
  primaryBtn: React.CSSProperties;
  secondaryBtn: React.CSSProperties;
  dangerBtn: React.CSSProperties;
  onNewWorkOrder: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onHourmeter: () => void;
}

const WorkOrdersActionButtons: React.FC<WorkOrdersActionButtonsProps> = ({
  selectedRow,
  primaryBtn,
  secondaryBtn,
  dangerBtn,
  onNewWorkOrder,
  onEdit,
  onDelete,
  onHourmeter,
}) => {
  return (
    <div style={{ margin: '8px 0 8px 0' }}>
      <button className="wo-btn" style={primaryBtn} onClick={onNewWorkOrder}>
        New Work Order
      </button>

      <button
        className="wo-btn"
        style={secondaryBtn}
        onClick={onEdit}
        disabled={selectedRow === null}
      >
        Edit
      </button>

      <button
        className="wo-btn"
        style={dangerBtn}
        onClick={onDelete}
        disabled={selectedRow === null}
      >
        Delete
      </button>

      <button className="wo-btn" style={secondaryBtn} onClick={onHourmeter}>
        Hourmeter
      </button>
    </div>
  );
};

export default WorkOrdersActionButtons;
