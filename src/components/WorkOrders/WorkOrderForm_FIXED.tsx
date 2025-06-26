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
  
  // Buscar parte en inventario por SKU (OPTIMIZADO PARA CAMPO PRECIO)
  const findPartBySku = (sku: string) => {
    if (!sku || !inventory || inventory.length === 0) {
      console.log('❌ findPartBySku: SKU vacío o inventario no disponible');
      return null;
    }
    
    const skuLower = String(sku).toLowerCase().trim();
    console.log('🔍 Buscando SKU:', skuLower, 'en inventario de', inventory.length, 'items');
    
    // Buscar por SKU exacto (case insensitive)
    const exactMatch = inventory.find((item: any) => 
      String(item.sku || '').toLowerCase().trim() === skuLower
    );
    
    if (exactMatch) {
      console.log('✅ Parte encontrada por SKU exacto:', {
        sku: exactMatch.sku,
        name: exactMatch.part || exactMatch.description || exactMatch.name,
        precio: exactMatch.precio, // Campo correcto de la tabla inventory
        precioTipo: typeof exactMatch.precio,
        allPriceFields: {
          precio: exactMatch.precio,
          cost: exactMatch.cost,
          price: exactMatch.price
        }
      });
      return exactMatch;
    }
    
    // Si no encuentra coincidencia exacta, buscar que contenga el SKU
    const partialMatch = inventory.find((item: any) => 
      String(item.sku || '').toLowerCase().includes(skuLower)
    );
    
    if (partialMatch) {
      console.log('⚠️ Parte encontrada por coincidencia parcial:', {
        sku: partialMatch.sku,
        name: partialMatch.part || partialMatch.description || partialMatch.name,
        precio: partialMatch.precio, // Campo correcto de la tabla inventory
        precioTipo: typeof partialMatch.precio
      });
      return partialMatch;
    }
    
    console.log('❌ No se encontró parte para SKU:', sku);
    return null;
  };

  // Manejar cambios en las partes con auto-completado (CORREGIDO PARA PRECIO)
  const handlePartChange = (index: number, field: string, value: string) => {
    console.log('🔧 handlePartChange llamado:', { 
      index, 
      field, 
      value, 
      inventoryLength: inventory.length
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
        newParts[index].part = foundPart.part || foundPart.description || foundPart.name || '';
        
        // Autocompletar costo - PRIORIDAD AL CAMPO 'precio' de la tabla inventory
        let cost = 0;
        
        // Primero buscar en el campo 'precio' que es el correcto de la tabla inventory
        if (foundPart.precio !== undefined && foundPart.precio !== null && String(foundPart.precio).trim() !== '') {
          cost = parseFloat(String(foundPart.precio)) || 0;
          console.log('💰 Costo obtenido del campo "precio":', cost);
        } else {
          // Busqueda de respaldo en otros campos posibles
          const costFields = ['cost', 'price', 'unitCost', 'unit_cost', 'unit_price', 'price_unit'];
          
          for (const costField of costFields) {
            if (foundPart[costField] !== undefined && foundPart[costField] !== null && String(foundPart[costField]).trim() !== '') {
              cost = parseFloat(String(foundPart[costField])) || 0;
              console.log(`💰 Costo obtenido del campo "${costField}":`, cost);
              break;
            }
          }
        }
        
        // Si no encuentra costo, usar 0 pero mostrar warning
        if (cost === 0) {
          console.warn('⚠️ No se encontró costo válido en ningún campo. Parte:', {
            sku: foundPart.sku,
            precio: foundPart.precio,
            allFields: Object.keys(foundPart)
          });
        }
        
        // Formatear el costo con 2 decimales
        newParts[index].cost = cost.toFixed(2);
        
        console.log('✅ Auto-completando parte:', {
          sku: value,
          part: newParts[index].part,
          cost: newParts[index].cost,
          originalCostValue: cost
        });
        
        // Trigger visual feedback - agregar clase de éxito
        setTimeout(() => {
          const skuInput = document.querySelector(`input[name="parts[${index}].sku"]`) as HTMLInputElement;
          const partInput = document.querySelector(`input[name="parts[${index}].part"]`) as HTMLInputElement;
          const costInput = document.querySelector(`input[name="parts[${index}].cost"]`) as HTMLInputElement;
          
          [skuInput, partInput, costInput].forEach(input => {
            if (input) {
              input.style.backgroundColor = '#d4edda';
              input.style.borderColor = '#c3e6cb';
              setTimeout(() => {
                input.style.backgroundColor = '';
                input.style.borderColor = '';
              }, 2000);
            }
          });
        }, 100);
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
    const laborTotal = totalHours * 60; // $60/hora
    const partsTotal = calculatePartsTotal();
    const subtotal = laborTotal + partsTotal;
    
    // Aplicar extras
    let extra = subtotal * 0.05; // 5% base
    extraOptions.forEach((option: any) => {
      if (option === '15shop') extra += subtotal * 0.15;
      if (option === '15weld') extra += subtotal * 0.15;
    });
    
    return subtotal + extra;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanParts = workOrder.parts
        ? workOrder.parts.filter((part: any) => part.sku && part.sku.trim() !== '')
        : [];
      
      const formData = {
        ...workOrder,
        parts: cleanParts,
        totalLabAndParts: calculateTotalLabAndParts()
      };
      
      setSuccessMsg('Saving...');
      await onSubmit(formData);
      setSuccessMsg('Work Order saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Error saving work order:', error);
      setSuccessMsg('Error saving work order');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const addEmptyPart = () => {
    const newParts = [...(workOrder.parts || []), { sku: '', part: '', qty: 1, cost: 0 }];
    onChange({ target: { name: 'parts', value: newParts } } as any);
  };

  const removePart = (index: number) => {
    const newParts = (workOrder.parts || []).filter((_: any, i: number) => i !== index);
    onChange({ target: { name: 'parts', value: newParts } } as any);
  };

  const addMechanic = () => {
    const newMechanics = [...(workOrder.mechanics || []), { name: '', hrs: 0 }];
    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
  };

  const removeMechanic = (index: number) => {
    const newMechanics = (workOrder.mechanics || []).filter((_: any, i: number) => i !== index);
    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
  };

  return (
    <div className="form-container">
      <h2>{title}</h2>
      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      
      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="billToCo">Customer:</label>
            <select
              id="billToCo"
              name="billToCo"
              value={workOrder.billToCo || ''}
              onChange={onChange}
              required
            >
              <option value="">Select Customer</option>
              {billToCoOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="trailer">Trailer:</label>
            <select
              id="trailer"
              name="trailer"
              value={workOrder.trailer || ''}
              onChange={onChange}
              required
            >
              <option value="">Select Trailer</option>
              {getTrailerOptions(workOrder.billToCo || '').map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="date">Date:</label>
            <input
              type="date"
              id="date"
              name="date"
              value={workOrder.date ? workOrder.date.split('T')[0] : ''}
              onChange={onChange}
              required
            />
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            name="description"
            value={workOrder.description || ''}
            onChange={onChange}
            rows={4}
            required
          />
        </div>

        {/* Mechanics */}
        <div className="form-section">
          <h3>Mechanics</h3>
          {(workOrder.mechanics || []).map((mechanic: any, index: number) => (
            <div key={index} className="form-row">
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  value={mechanic.name || ''}
                  onChange={(e) => {
                    const newMechanics = [...(workOrder.mechanics || [])];
                    newMechanics[index] = { ...newMechanics[index], name: e.target.value };
                    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Hours:</label>
                <input
                  type="number"
                  step="0.5"
                  value={mechanic.hrs || ''}
                  onChange={(e) => {
                    const newMechanics = [...(workOrder.mechanics || [])];
                    newMechanics[index] = { ...newMechanics[index], hrs: parseFloat(e.target.value) || 0 };
                    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
                  }}
                  required
                />
              </div>
              <button type="button" onClick={() => removeMechanic(index)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={addMechanic}>Add Mechanic</button>
        </div>

        {/* Parts */}
        <div className="form-section">
          <h3>Parts</h3>
          {(workOrder.parts || []).map((part: any, index: number) => (
            <div key={index} className="form-row parts-row">
              <div className="form-group">
                <label>SKU:</label>
                <input
                  type="text"
                  name={`parts[${index}].sku`}
                  value={part.sku || ''}
                  onChange={(e) => handlePartChange(index, 'sku', e.target.value)}
                  placeholder="Enter SKU"
                  list={`sku-suggestions-${index}`}
                />
                <datalist id={`sku-suggestions-${index}`}>
                  {inventory.filter(item => 
                    item.sku && String(item.sku).toLowerCase().includes(String(part.sku || '').toLowerCase())
                  ).slice(0, 10).map(item => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} - {item.part}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label>Part Name:</label>
                <input
                  type="text"
                  name={`parts[${index}].part`}
                  value={part.part || ''}
                  onChange={(e) => handlePartChange(index, 'part', e.target.value)}
                  placeholder="Part description"
                />
              </div>

              <div className="form-group">
                <label>Qty:</label>
                <input
                  type="number"
                  name={`parts[${index}].qty`}
                  value={part.qty || ''}
                  onChange={(e) => handlePartChange(index, 'qty', e.target.value)}
                  min="1"
                  step="1"
                />
              </div>

              <div className="form-group">
                <label>Unit Cost:</label>
                <input
                  type="number"
                  name={`parts[${index}].cost`}
                  value={part.cost || ''}
                  onChange={(e) => handlePartChange(index, 'cost', e.target.value)}
                  step="0.01"
                  min="0"
                  placeholder="$0.00"
                />
              </div>

              <button type="button" onClick={() => removePart(index)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={addEmptyPart}>Add Part</button>
        </div>

        {/* Extra Options */}
        <div className="form-section">
          <h3>Extra Options</h3>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={extraOptions.includes('15shop')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setExtraOptions([...extraOptions, '15shop']);
                  } else {
                    setExtraOptions(extraOptions.filter(opt => opt !== '15shop'));
                  }
                }}
              />
              15% Shop Fee
            </label>
            <label>
              <input
                type="checkbox"
                checked={extraOptions.includes('15weld')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setExtraOptions([...extraOptions, '15weld']);
                  } else {
                    setExtraOptions(extraOptions.filter(opt => opt !== '15weld'));
                  }
                }}
              />
              15% Welding Fee
            </label>
          </div>
        </div>

        {/* Totals */}
        <div className="form-section totals-section">
          <h3>Totals</h3>
          <div className="totals-display">
            <div>Total Hours: {calculateTotalHours()}</div>
            <div>Labor Total: ${(calculateTotalHours() * 60).toFixed(2)}</div>
            <div>Parts Total: ${calculatePartsTotal().toFixed(2)}</div>
            <div className="total-final">
              <strong>TOTAL LAB & PARTS: ${calculateTotalLabAndParts().toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="form-group">
          <label htmlFor="status">Status:</label>
          <select
            id="status"
            name="status"
            value={workOrder.status || 'PENDING'}
            onChange={onChange}
          >
            <option value="PENDING">PENDING</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="FINISHED">FINISHED</option>
          </select>
        </div>

        {/* ID Classic */}
        {workOrder.status === 'FINISHED' && (
          <div className="form-group">
            <label htmlFor="idClassic">ID Classic:</label>
            <input
              type="number"
              id="idClassic"
              name="idClassic"
              value={workOrder.idClassic || ''}
              onChange={onChange}
            />
          </div>
        )}

        {/* Buttons */}
        <div className="form-buttons">
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Work Order'}
          </button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default WorkOrderForm;
