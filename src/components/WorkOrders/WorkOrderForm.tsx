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
    // Debug: verificar inventario
  React.useEffect(() => {
    console.log('📋 WorkOrderForm - Inventario recibido:', {
      inventoryLength: inventory?.length || 0,
      firstItems: inventory?.slice(0, 2) || [],
      isArray: Array.isArray(inventory),
      sampleFields: inventory?.[0] ? Object.keys(inventory[0]) : []
    });
  }, [inventory]);
  
  // Buscar parte en inventario por SKU
  const findPartBySku = (sku: string) => {
    if (!sku || !inventory || inventory.length === 0) {
      console.log('❌ findPartBySku: SKU vacío o inventario no disponible');
      return null;
    }
    
    console.log('🔍 Buscando SKU:', sku, 'en inventario de', inventory.length, 'items');
    
    // Buscar por SKU exacto (case insensitive)
    const exactMatch = inventory.find((item: any) => 
      String(item.sku).toLowerCase() === String(sku).toLowerCase()
    );
    
    if (exactMatch) {      console.log('✅ Parte encontrada por SKU exacto:', {
        sku: exactMatch.sku,
        name: exactMatch.part || exactMatch.description || exactMatch.name,
        precio: exactMatch.precio, // Campo correcto de inventario
        cost: exactMatch.cost || exactMatch.price || exactMatch.unitCost || exactMatch.unit_cost,
        allFields: exactMatch
      });
      return exactMatch;
    }
    
    // Si no encuentra coincidencia exacta, buscar que contenga el SKU
    const partialMatch = inventory.find((item: any) => 
      String(item.sku).toLowerCase().includes(String(sku).toLowerCase())
    );
    
    if (partialMatch) {      console.log('⚠️ Parte encontrada por coincidencia parcial:', {
        sku: partialMatch.sku,
        name: partialMatch.part || partialMatch.description || partialMatch.name,
        precio: partialMatch.precio, // Campo correcto de inventario
        cost: partialMatch.cost || partialMatch.price || partialMatch.unitCost || partialMatch.unit_cost,
        allFields: partialMatch
      });
      return partialMatch;
    }
    
    console.log('❌ No se encontró parte para SKU:', sku);
    return null;
  };// Manejar cambios en las partes con auto-completado
  const handlePartChange = (index: number, field: string, value: string) => {
    console.log('🔧 handlePartChange llamado:', { 
      index, 
      field, 
      value, 
      inventoryLength: inventory.length,
      sampleInventoryItem: inventory[0] // Para debug
    });
    
    const newParts = [...(workOrder.parts || [])];
    newParts[index] = { ...newParts[index], [field]: value };

    // Auto-completado cuando se cambia el SKU
    if (field === 'sku' && value && value.trim() !== '') {
      const foundPart = findPartBySku(value);
      console.log('🔍 Buscando parte con SKU:', value);
      console.log('📦 Parte encontrada:', foundPart);
      
      if (foundPart) {
        // Autocompletar nombre de la parte
        newParts[index].part = foundPart.part || foundPart.description || foundPart.name || '';        // Autocompletar costo - PRIORIDAD AL CAMPO 'precio' de la tabla inventory
        let cost = 0;
        console.log('🔍 Campos de precio disponibles:', {
          precio: foundPart.precio,
          cost: foundPart.cost,
          price: foundPart.price,
          allKeys: Object.keys(foundPart)
        });
        
        if (foundPart.precio) {
          cost = parseFloat(String(foundPart.precio)) || 0;
          console.log('💰 Usando campo "precio":', foundPart.precio, '→', cost);
        } else if (foundPart.cost) {
          cost = foundPart.cost;
          console.log('💰 Usando campo "cost":', foundPart.cost, '→', cost);
        } else if (foundPart.price) {
          cost = foundPart.price;
          console.log('💰 Usando campo "price":', foundPart.price, '→', cost);
        } else if (foundPart.unitCost) {
          cost = foundPart.unitCost;
          console.log('💰 Usando campo "unitCost":', foundPart.unitCost, '→', cost);
        } else if (foundPart.unit_cost) {
          cost = foundPart.unit_cost;
          console.log('💰 Usando campo "unit_cost":', foundPart.unit_cost, '→', cost);
        } else {
          console.log('❌ No se encontró ningún campo de precio válido');
        }        // Formatear el costo
        newParts[index].cost = typeof cost === 'number' ? cost.toFixed(2) : parseFloat(String(cost)).toFixed(2);
        
        console.log('✅ Auto-completando parte:', {
          sku: value,
          part: newParts[index].part,
          cost: newParts[index].cost,
          originalCostField: cost,
          foundPartKeys: Object.keys(foundPart)
        });
      } else {
        console.log('❌ No se encontró parte para SKU:', value);
      }
    }

    // Calcular costo total para esta parte (qty × costo unitario)
    if (field === 'qty' || field === 'cost') {
      const qty = parseFloat(field === 'qty' ? value : newParts[index].qty) || 0;
      const unitCost = parseFloat(String(field === 'cost' ? value : newParts[index].cost).replace(/[^0-9.]/g, '')) || 0;
      newParts[index].totalCost = qty * unitCost;
      console.log('💰 Calculando total parte:', { qty, unitCost, total: newParts[index].totalCost });
    }

    // Siempre actualizar el estado usando onChange
    onChange({ target: { name: 'parts', value: newParts } } as any);

    // Llamar a onPartChange si está disponible (para compatibilidad)
    if (onPartChange) {
      onPartChange(index, field, value);
    }

    // Auto-calcular total después de cambiar partes
    setTimeout(() => {
      const calculatedTotal = calculateTotalLabAndParts();
      onChange({ target: { name: 'totalLabAndParts', value: `$${calculatedTotal.toFixed(2)}` } } as any);
    }, 100);
  };

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
      }

      const dataToSend = {
        ...workOrder,
        parts: cleanParts,
        extraOptions, // Sin agregar el 5% manualmente, el backend lo hará automáticamente
        totalHrs: calculateTotalHours(),
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

    // Auto-calcular total después de cambiar horas
    if (field === 'hrs') {
      setTimeout(() => {
        const calculatedTotal = calculateTotalLabAndParts();
        onChange({ target: { name: 'totalLabAndParts', value: `$${calculatedTotal.toFixed(2)}` } } as any);
      }, 100);
    }
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

    // Auto-calcular total después de cambiar extras
    setTimeout(() => {
      const calculatedTotal = calculateTotalLabAndParts();
      onChange({ target: { name: 'totalLabAndParts', value: `$${calculatedTotal.toFixed(2)}` } } as any);
    }, 100);
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
            </select>
          </label>
        </div>

        {/* Segunda fila - Status, ID Classic (solo en edición) */}
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
          {/* ID CLASSIC aparece al editar o cuando el status es FINISHED */}
          {(workOrder.id || workOrder.status === 'FINISHED') && (
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
              }}>                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  SKU
                  <input
                    list={`inventory-${index}`}
                    type="text"
                    value={part.sku || ''}
                    onChange={e => handlePartChange(index, 'sku', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4 }}
                    placeholder="SKU"
                  />                  <datalist id={`inventory-${index}`}>
                    {inventory.map((item: any) => {
                      // PRIORIDAD AL CAMPO 'precio' de la tabla inventory
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
                  Parte
                  <input
                    type="text"
                    value={part.part || ''}
                    onChange={e => handlePartChange(index, 'part', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4, backgroundColor: '#f0f8ff' }}
                    placeholder="Nombre de la parte"
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  Qty
                  <input
                    type="number"
                    value={part.qty || ''}
                    onChange={e => handlePartChange(index, 'qty', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4 }}
                    placeholder="Cantidad"
                  />
                </label>                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  Costo Unit.
                  <input
                    type="text"
                    value={part.cost || ''}
                    onChange={e => handlePartChange(index, 'cost', e.target.value)}
                    style={{ 
                      width: '100%', 
                      marginTop: 2, 
                      padding: 4, 
                      backgroundColor: part.cost && parseFloat(String(part.cost)) > 0 ? '#e8f5e8' : '#ffffff',
                      border: part.cost && parseFloat(String(part.cost)) > 0 ? '2px solid #4caf50' : '1px solid #ccc'
                    }}
                    placeholder="$0.00"
                  />
                </label>
                <div style={{ fontSize: 11, color: '#1976d2', fontWeight: 'bold', marginTop: 4 }}>
                  Total: ${((parseFloat(String(part.qty || '0'))) * (parseFloat(String(part.cost).replace(/[^0-9.]/g, '')) || 0)).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
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
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label style={{ flex: 1 }}>
              Total LAB & PARTS
              <input
                type="text"
                name="totalLabAndParts"
                value={workOrder.totalLabAndParts || ''}
                onChange={onChange}
                style={{ 
                  width: '100%', 
                  marginTop: 4, 
                  padding: 8, 
                  fontWeight: 'bold',
                  backgroundColor: '#ffffff',
                  border: '2px solid #1976d2',
                  color: '#1976d2',
                  fontSize: '16px'
                }}
                placeholder="$0.00"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const calculatedTotal = calculateTotalLabAndParts();
                onChange({ target: { name: 'totalLabAndParts', value: `$${calculatedTotal.toFixed(2)}` } } as any);
              }}
              style={{
                padding: '8px 12px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: 20
              }}
            >
              Calcular Auto
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            Cálculo sugerido: Labor (${(calculateTotalHours() * 60).toFixed(2)}) + Partes (${calculatePartsTotal().toFixed(2)}) + 5% automático + Extras = ${calculateTotalLabAndParts().toFixed(2)}
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