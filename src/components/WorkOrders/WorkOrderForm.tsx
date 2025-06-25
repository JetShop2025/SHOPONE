import React from 'react';

export {}; // Force module

interface WorkOrderFormProps {
  workOrder: any;
  onChange: (e: React.ChangeEvent<any>, index?: number, field?: string) => void;
  onPartChange: (index: number, field: string, value: string) => void;
  onSubmit: (data?: any) => Promise<void> | void;
  onCancel: () => void;
  title: string;
  billToCoOptions: string[];
  getTrailerOptions: (billToCo: string) => string[];
  inventory: any[];
  extraOptions: string[];
  setExtraOptions: React.Dispatch<React.SetStateAction<string[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  // Optional props that may be passed from WorkOrdersTable
  trailersWithPendingParts?: any[];
  pendingParts?: any[];
  pendingPartsQty?: any;
  setPendingPartsQty?: React.Dispatch<React.SetStateAction<any>>;
  onAddPendingPart?: (part: any, qty: any) => void;
  onAddEmptyPart?: () => void;
}

interface Part {
  sku: string;
  part: string;
  qty: number;
  cost: number;
  [key: string]: any;
}

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  workOrder, 
  onChange, 
  onPartChange, 
  onSubmit, 
  onCancel, 
  title, 
  billToCoOptions, 
  getTrailerOptions, 
  inventory, 
  extraOptions, 
  setExtraOptions, 
  loading, 
  setLoading,
  trailersWithPendingParts,
  pendingParts,
  pendingPartsQty,
  setPendingPartsQty,
  onAddPendingPart,
  onAddEmptyPart
}) => {
  const [successMsg, setSuccessMsg] = React.useState('');

  // Calcular horas totales automáticamente
  const calculateTotalHours = () => {
    if (!workOrder.mechanics || workOrder.mechanics.length === 0) return 0;
    return workOrder.mechanics.reduce((total: number, mechanic: any) => {
      return total + (parseFloat(mechanic.hrs) || 0);
    }, 0);
  };

  // Calcular total de partes automáticamente
  const calculatePartsTotal = () => {
    if (!workOrder.parts || workOrder.parts.length === 0) return 0;
    return workOrder.parts.reduce((total: number, part: any) => {
      const qty = parseFloat(part.qty) || 0;
      const cost = parseFloat(String(part.cost).replace(/[^0-9.]/g, '')) || 0;
      return total + (qty * cost);
    }, 0);
  };

  // Calcular total LAB & PARTS automáticamente
  const calculateTotalLabAndParts = () => {
    const totalHours = calculateTotalHours();
    const laborTotal = totalHours * 60; // $60 por hora
    const partsTotal = calculatePartsTotal();
    const subtotal = laborTotal + partsTotal;
    
    // Siempre agregar 5% automático
    let extraTotal = subtotal * 0.05;
    
    // Agregar extras seleccionados
    extraOptions.forEach(option => {
      if (option === '15shop') extraTotal += subtotal * 0.15;
      if (option === '15weld') extraTotal += subtotal * 0.15;
    });
    
    return subtotal + extraTotal;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanParts = workOrder.parts
        .filter((p: Part) => p.sku && String(p.sku).trim() !== '')
        .map((p: Part) => ({
          ...p,
          cost: Number(String(p.cost).replace(/[^0-9.]/g, ''))
        }));

      const hasInvalidQty = cleanParts.some((p: Part) => !p.qty || Number(p.qty) <= 0);
      if (hasInvalidQty) {
        window.alert('Hay partes con cantidad inválida.');
        setLoading(false);
        return;
      }      // Agregar automáticamente el 5% extra si no está ya incluido
      const autoExtraOptions = [...extraOptions];
      if (!autoExtraOptions.includes('5')) {
        autoExtraOptions.push('5');
      }      const dataToSend = {
        ...workOrder,
        parts: cleanParts,
        extraOptions: autoExtraOptions,
        totalHrs: calculateTotalHours(),
        totalLabAndParts: calculateTotalLabAndParts(),
        usuario: localStorage.getItem('username') || ''
      };

      await onSubmit(dataToSend);
      setSuccessMsg('¡Orden creada exitosamente!');
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setSuccessMsg('');
      if (err.response && err.response.data) {
        window.alert(`Error: ${err.response.data.error || err.response.data}`);
      } else {
        window.alert(`Error: ${err.message}`);
      }
    }
  };

  const handleMechanicChange = (index: number, field: string, value: string) => {
    const newMechanics = [...(workOrder.mechanics || [])];
    newMechanics[index] = { ...newMechanics[index], [field]: value };
    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
  };

  const addMechanic = () => {
    const newMechanics = [...(workOrder.mechanics || []), { name: '', hrs: '' }];
    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
  };

  const removeMechanic = (index: number) => {
    const newMechanics = (workOrder.mechanics || []).filter((_: any, i: number) => i !== index);
    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
  };

  const handleExtraChange = (optionValue: string, checked: boolean) => {
    if (checked) {
      setExtraOptions([...extraOptions, optionValue]);
    } else {
      setExtraOptions(extraOptions.filter(opt => opt !== optionValue));
    }
  };

  const getTrailerOptionsForBill = (billToCo: string) => {
    return getTrailerOptions ? getTrailerOptions(billToCo) : [];
  };

  return (
    <div style={{
      marginTop: '20px',
      border: '1px solid #1976d2',
      borderRadius: 8,
      padding: '24px',
      background: '#f5faff',
      maxWidth: 900,
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 2px 8px rgba(25, 118, 210, 0.08)'
    }}>
      <h2 style={{ color: '#1976d2', marginBottom: 16 }}>{title}</h2>
      {loading && (
        <div style={{ color: '#1976d2', fontWeight: 700, marginBottom: 12 }}>
          Procesando, por favor espera...
        </div>
      )}
      {successMsg && (
        <div style={{ color: 'green', fontWeight: 700, marginBottom: 12 }}>
          {successMsg}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <label style={{ flex: '1 1 200px' }}>
            Bill To Co<span style={{ color: 'red' }}>*</span>
            <select
              name="billToCo"
              value={workOrder.billToCo || ''}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4, padding: 8 }}
              required
            >
              <option value="">Selecciona...</option>
              {billToCoOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          
          <label style={{ flex: '1 1 120px' }}>
            Fecha<span style={{ color: 'red' }}>*</span>
            <input
              type="date"
              name="date"
              value={workOrder.date || ''}
              onChange={onChange}
              required
              style={{ width: '100%', marginTop: 4, padding: 8 }}
            />
          </label>
          
          <label style={{ flex: '1 1 120px' }}>
            Trailer
            <select
              name="trailer"
              value={workOrder.trailer || ''}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4, padding: 8 }}
            >
              <option value="">Selecciona...</option>
              {getTrailerOptionsForBill(workOrder.billToCo).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>          </label>
        </div>        {/* Segunda fila - Status, ID Classic (solo en edición) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <label style={{ flex: '1 1 150px' }}>
            Status
            <select
              name="status"
              value={workOrder.status || 'PRE W.O'}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4, padding: 8 }}
            >
              <option value="PRE W.O">PRE W.O</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="FINISHED">FINISHED</option>
            </select>
          </label>
          
          {/* ID CLASSIC solo aparece al editar (cuando workOrder.id existe) */}
          {workOrder.id && (
            <label style={{ flex: '1 1 150px' }}>
              ID CLASSIC
              <input
                type="text"
                name="idClassic"
                placeholder="ID Classic (opcional)"
                value={workOrder.idClassic || ''}
                onChange={onChange}
                style={{ width: '100%', marginTop: 4, padding: 8 }}
              />
            </label>
          )}
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ width: '100%' }}>
            Descripción<span style={{ color: 'red' }}>*</span>
            <textarea
              name="description"
              placeholder="Descripción*"
              value={workOrder.description || ''}
              onChange={onChange}
              rows={3}
              style={{ width: '100%', marginTop: 4, resize: 'vertical', padding: 8 }}
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong>Mecánicos</strong>
            <button
              type="button"
              onClick={addMechanic}
              style={{
                padding: '4px 8px',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              + Agregar
            </button>
          </div>
          {(workOrder.mechanics || []).map((mechanic: any, index: number) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Nombre del mecánico"
                value={mechanic.name || ''}
                onChange={e => handleMechanicChange(index, 'name', e.target.value)}
                style={{ flex: 1, padding: 8 }}
              />
              <input
                type="number"
                placeholder="Horas"
                value={mechanic.hrs || ''}
                onChange={e => handleMechanicChange(index, 'hrs', e.target.value)}
                style={{ width: 80, padding: 8 }}
                step="0.25"
              />
              <button
                type="button"
                onClick={() => removeMechanic(index)}
                style={{
                  padding: '4px 8px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
          ))}
          {(!workOrder.mechanics || workOrder.mechanics.length === 0) && (
            <div style={{ color: '#666', fontStyle: 'italic' }}>
              No hay mecánicos agregados. Haz clic en "Agregar" para añadir uno.
            </div>
          )}
        </div>        <div style={{ marginBottom: 16 }}>
          <label>
            Total HRS (calculado automáticamente)
            <input
              type="number"
              name="totalHrs"
              value={calculateTotalHours().toFixed(2)}
              readOnly
              style={{ 
                width: '100%', 
                marginTop: 4, 
                padding: 8, 
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                color: '#666'
              }}
              step="0.25"
              placeholder="Total de horas"
            />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong>Partes</strong>
            {onAddEmptyPart && (
              <button
                type="button"
                onClick={onAddEmptyPart}
                style={{
                  padding: '4px 8px',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                + Agregar Parte
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {workOrder.parts && workOrder.parts.map((part: Part, index: number) => (
              <div key={index} style={{
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  SKU
                  <input
                    list={`inventory-${index}`}
                    type="text"
                    value={part.sku || ''}
                    onChange={e => onPartChange(index, 'sku', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4 }}
                    placeholder="SKU"
                  />
                  <datalist id={`inventory-${index}`}>
                    {inventory.map((item: any) => (
                      <option key={item.sku} value={item.sku}>
                        {item.part} - {item.sku}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  Parte
                  <input
                    type="text"
                    value={part.part || ''}
                    onChange={e => onPartChange(index, 'part', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4 }}
                    placeholder="Nombre de la parte"
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  Qty
                  <input
                    type="number"
                    value={part.qty || ''}
                    onChange={e => onPartChange(index, 'qty', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4 }}
                    placeholder="Cantidad"
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  Costo
                  <input
                    type="text"
                    value={part.cost || ''}
                    onChange={e => onPartChange(index, 'cost', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4 }}
                    placeholder="$0.00"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>        <div style={{ marginBottom: 16 }}>
          <strong>Extras</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
            <div style={{ color: '#666', fontStyle: 'italic', marginBottom: 8 }}>
              * Se aplica automáticamente un 5% extra a todas las órdenes
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={extraOptions.includes('15shop')}
                onChange={e => handleExtraChange('15shop', e.target.checked)}
              />
              Shop 15%
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={extraOptions.includes('15weld')}
                onChange={e => handleExtraChange('15weld', e.target.checked)}
              />
              Weld 15%
            </label>
          </div>
        </div>        <div style={{ marginBottom: 16 }}>
          <label>
            Total LAB & PARTS (calculado automáticamente)
            <input
              type="text"
              name="totalLabAndParts"
              value={`$${calculateTotalLabAndParts().toFixed(2)}`}
              readOnly
              style={{ 
                width: '100%', 
                marginTop: 4, 
                padding: 8, 
                fontWeight: 'bold',
                backgroundColor: '#f0f8ff',
                border: '2px solid #1976d2',
                color: '#1976d2',
                fontSize: '16px'
              }}
              placeholder="$0.00"
            />
          </label>
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            Incluye: Labor (${(calculateTotalHours() * 60).toFixed(2)}) + Partes (${calculatePartsTotal().toFixed(2)}) + 5% automático + Extras seleccionados
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? '#ccc' : '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Procesando...' : 'Save'}
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '12px 24px',
              background: '#fff',
              color: '#1976d2',
              border: '1px solid #1976d2',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkOrderForm;