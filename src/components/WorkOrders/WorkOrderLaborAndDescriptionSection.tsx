import React from 'react';

interface WorkOrderLaborAndDescriptionSectionProps {
  workOrder: any;
  mechanicsList: string[];
  DateInputWithCalendar: React.ComponentType<any>;
  addMechanic: () => void;
  removeMechanic: (index: number) => void;
  handleMechanicChange: (index: number, field: string, value: any) => void;
  getDefaultLaborDate: () => string;
  normalizeDateForSubmit: (value: string) => string;
  getMechanicHoursSummary: (mechanics: any[]) => string;
  autoDescription: boolean;
  setAutoDescription: React.Dispatch<React.SetStateAction<boolean>>;
  onChange: (e: React.ChangeEvent<any>) => void;
}

const WorkOrderLaborAndDescriptionSection: React.FC<WorkOrderLaborAndDescriptionSectionProps> = ({
  workOrder,
  mechanicsList,
  DateInputWithCalendar,
  addMechanic,
  removeMechanic,
  handleMechanicChange,
  getDefaultLaborDate,
  normalizeDateForSubmit,
  getMechanicHoursSummary,
  autoDescription,
  setAutoDescription,
  onChange,
}) => {
  return (
    <>
      <div style={{ marginBottom: 0, gridColumn: '1 / -1', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <strong style={{ fontSize: '14px' }}>Labor Log (Date, Mechanic, Hours, Work Done)</strong>
          <button
            type="button"
            onClick={addMechanic}
            style={{
              padding: '3px 6px',
              background: '#0A3854',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            + Add Row
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {(workOrder.mechanics || []).map((mechanic: any, index: number) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '165px 155px 60px 1fr 32px', gap: 8, marginBottom: 6, alignItems: 'center', minWidth: 600 }}>
              <DateInputWithCalendar
                value={mechanic.date || (index === 0 ? getDefaultLaborDate() : '')}
                onTextChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleMechanicChange(index, 'date', normalizeDateForSubmit(e.target.value))
                }
                onCalendarChange={(value: string) => handleMechanicChange(index, 'date', value)}
                placeholder="MM/DD/YYYY"
              />
              <select
                value={mechanic.name || ''}
                onChange={(e) => handleMechanicChange(index, 'name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: 4,
                  border: '1px solid #ccc',
                  fontSize: 13,
                  backgroundColor: '#fff',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Mechanic...</option>
                {mechanicsList.map((mechanicName) => (
                  <option key={mechanicName} value={mechanicName}>
                    {mechanicName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Hrs"
                value={mechanic.hrs || ''}
                onChange={(e) => handleMechanicChange(index, 'hrs', e.target.value)}
                style={{ width: '100%', padding: '6px', boxSizing: 'border-box', fontSize: '13px' }}
                step="0.01"
                min="0"
              />
              <input
                type="text"
                placeholder="Work done..."
                value={mechanic.task || ''}
                onChange={(e) => handleMechanicChange(index, 'task', e.target.value)}
                style={{ width: '100%', padding: '6px', boxSizing: 'border-box', fontSize: '13px' }}
              />
              <button
                type="button"
                onClick={() => removeMechanic(index)}
                style={{
                  padding: '4px 6px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 6, padding: '6px 8px', background: '#eef5ff', borderRadius: 4, border: '1px solid #d6e6ff', fontSize: 11 }}>
          <strong>Hours by mechanic:</strong> {getMechanicHoursSummary(workOrder.mechanics || []) || 'No hours logged yet'}
        </div>

        {(!workOrder.mechanics || workOrder.mechanics.length === 0) && (
          <div style={{ color: '#666', fontStyle: 'italic', fontSize: '12px' }}>
            No labor rows yet. Click "Add Row" to start logging by date.
          </div>
        )}
      </div>

      <div style={{ marginBottom: 0, gridColumn: '1 / -1', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ width: '100%', fontSize: '14px', fontWeight: '600' }}>
            Description / Invoice Notes<span style={{ color: 'red' }}>*</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={autoDescription}
              onChange={(e) => setAutoDescription(e.target.checked)}
            />
            Auto build
          </label>
        </div>
        <textarea
          name="description"
          placeholder="Description*"
          value={workOrder.description || ''}
          onChange={(e) => {
            if (autoDescription) setAutoDescription(false);
            onChange(e);
          }}
          rows={6}
          style={{ width: '100%', marginTop: 4, resize: 'vertical', padding: 8, minHeight: 120, fontSize: 13, lineHeight: 1.4, boxSizing: 'border-box' }}
          required
        />
        <div style={{ marginTop: 4, fontSize: 10, color: '#546e7a' }}>
          Tip: Use labor rows to generate clear lines by date/mechanic/hours automatically.
        </div>
      </div>
    </>
  );
};

export default WorkOrderLaborAndDescriptionSection;
