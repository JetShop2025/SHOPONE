import React from 'react';

interface WorkOrderBasicInfoSectionProps {
  workOrder: any;
  onChange: (e: React.ChangeEvent<any>) => void;
  idClassicError?: string;
  billToCoOptions: string[];
  getTrailerOptionsForBill: (billToCo: string) => string[];
  showBell: (trailerOption: string) => boolean;
  handleDateFieldChange: (field: 'startDate' | 'endDate') => (e: React.ChangeEvent<HTMLInputElement>) => void;
  DateInputWithCalendar: React.ComponentType<any>;
}

const WorkOrderBasicInfoSection: React.FC<WorkOrderBasicInfoSectionProps> = ({
  workOrder,
  onChange,
  idClassicError,
  billToCoOptions,
  getTrailerOptionsForBill,
  showBell,
  handleDateFieldChange,
  DateInputWithCalendar,
}) => {
  return (
    <>
      <label style={{ gridColumn: 'span 2' }}>
        Bill To Company<span style={{ color: 'red' }}>*</span>
        <select
          name="billToCo"
          value={workOrder.billToCo || ''}
          onChange={onChange}
          style={{ width: '100%', marginTop: 4, padding: '6px 8px', boxSizing: 'border-box', fontSize: '14px' }}
          required
        >
          <option value="">Select...</option>
          {billToCoOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>

      <label style={{ gridColumn: 'span 1' }}>
        Start Date<span style={{ color: 'red' }}>*</span>
        <DateInputWithCalendar
          value={workOrder.startDate || workOrder.date || ''}
          onTextChange={handleDateFieldChange('startDate')}
          onCalendarChange={(value: string) => {
            onChange({ target: { name: 'startDate', value } } as any);
            onChange({ target: { name: 'date', value } } as any);
          }}
          placeholder="MM/DD/YYYY"
          required
          inputName="startDate"
          inputStyle={{ marginTop: '4px' }}
        />
      </label>

      <label style={{ gridColumn: 'span 1' }}>
        End Date
        <DateInputWithCalendar
          value={workOrder.endDate || ''}
          onTextChange={handleDateFieldChange('endDate')}
          onCalendarChange={(value: string) => onChange({ target: { name: 'endDate', value } } as any)}
          placeholder="MM/DD/YYYY"
          inputName="endDate"
          inputStyle={{ marginTop: '4px' }}
        />
      </label>

      <label style={{ gridColumn: 'span 2' }}>
        Trailer
        <input
          name="trailer"
          value={workOrder.trailer || ''}
          onChange={(e) => {
            const cleanValue = e.target.value.replace(' 🔔', '');
            onChange({ target: { name: 'trailer', value: cleanValue } } as any);
          }}
          style={{ width: '100%', marginTop: 4, padding: '6px 8px', boxSizing: 'border-box', fontSize: '14px' }}
          placeholder="Select or type trailer..."
          autoComplete="off"
          list="trailer-options"
        />
        <datalist id="trailer-options">
          {getTrailerOptionsForBill(workOrder.billToCo).map((opt) => (
            <option key={opt} value={opt}>
              {opt}{showBell(opt) ? ' 🔔' : ''}
            </option>
          ))}
        </datalist>
      </label>

      <label style={{ gridColumn: 'span 1' }}>
        Status
        <select
          name="status"
          value={workOrder.status || 'PROCESSING'}
          onChange={onChange}
          style={{ width: '100%', marginTop: 4, padding: '6px 8px', boxSizing: 'border-box', fontSize: '14px' }}
        >
          <option value="PROCESSING">PROCESSING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="FINISHED">FINISHED</option>
          <option value="MISSING_PARTS">MISSING PARTS</option>
        </select>
      </label>

      <label style={{ gridColumn: 'span 1' }}>
        ID CLASSIC {workOrder.status === 'FINISHED' && <span style={{ color: 'red' }}>*</span>}
        <input
          type="text"
          name="idClassic"
          placeholder={workOrder.status === 'FINISHED' ? 'Required' : 'When FINISHED'}
          value={workOrder.idClassic || ''}
          onChange={onChange}
          disabled={workOrder.status !== 'FINISHED'}
          required={workOrder.status === 'FINISHED'}
          style={{
            width: '100%',
            marginTop: 4,
            padding: '6px 8px',
            boxSizing: 'border-box',
            fontSize: '14px',
            borderColor: idClassicError ? '#f44336' : undefined,
            backgroundColor: workOrder.status !== 'FINISHED' ? '#f5f5f5' : '#fff',
            cursor: workOrder.status !== 'FINISHED' ? 'not-allowed' : 'text',
          }}
        />
        {idClassicError && workOrder.status === 'FINISHED' && (
          <div
            style={{
              color: '#f44336',
              fontSize: '10px',
              marginTop: '2px',
              fontWeight: '500',
            }}
          >
            {idClassicError}
          </div>
        )}
      </label>

      <label style={{ gridColumn: '1 / -1' }}>
        Pre W.O Link (manual mechanic sheet)
        <input
          type="url"
          name="preWoLink"
          value={workOrder.preWoLink || ''}
          onChange={onChange}
          placeholder="https://..."
          style={{ width: '100%', marginTop: 4, padding: '6px 8px', boxSizing: 'border-box', fontSize: '14px' }}
        />
      </label>
    </>
  );
};

export default WorkOrderBasicInfoSection;
