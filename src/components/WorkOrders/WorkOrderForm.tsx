import React from 'react';

export {}; // Force module

// Lista de mecánicos predefinidos
const MECHANICS_LIST = [
  'ADAN R',
  'WILMER M', 
  'LUIS E',
  'ULISES M',
  'ALEX M',
  'MIGUEL R',
  'GUSTAVO M',
  'DAVID C'
];

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
  idClassicError?: string;
  // Optional props that may be passed from WorkOrdersTable
  trailersWithPendingParts?: any[];
  pendingParts?: any[];
  pendingPartsQty?: any;
  setPendingPartsQty?: React.Dispatch<React.SetStateAction<any>>;
  onAddPendingPart?: (part: any, qty: any) => void;
  onAddEmptyPart?: () => void;
  onDeletePart?: (index: number) => void;
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
  idClassicError,
  trailersWithPendingParts,
  pendingParts,
  pendingPartsQty,
  setPendingPartsQty,
  onAddPendingPart,
  onAddEmptyPart,
  onDeletePart
}) => {const [successMsg, setSuccessMsg] = React.useState('');
  const [tooltip, setTooltip] = React.useState<{ visible: boolean, x: number, y: number, info: any }>({ visible: false, x: 0, y: 0, info: null });
  
  // Function to hide tooltip
  const hideTooltip = () => setTooltip({ visible: false, x: 0, y: 0, info: null });
  // Function to show tooltip with part info
  const showTooltipForPart = (event: React.MouseEvent | React.FocusEvent, sku: string) => {
    const partInfo = findPartBySku(sku);
    if (partInfo) {
      // For MouseEvent, use clientX/clientY. For FocusEvent, use element position
      let x = 0;
      let y = 0;
      
      if ('clientX' in event && 'clientY' in event) {
        // MouseEvent
        x = event.clientX;
        y = event.clientY;
      } else {
        // FocusEvent - get element position
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top;
      }
      
      setTooltip({
        visible: true,
        x: x,
        y: y,
        info: {
          part: partInfo.part || partInfo.description || partInfo.name || 'Sin nombre',
          precio: partInfo.precio || partInfo.cost || partInfo.price || 0,
          onHand: partInfo.onHand || partInfo.quantity || partInfo.qty || 0,
          um: partInfo.um || partInfo.unit || 'UN'
        }
      });
    }
  };
    // Debug: verificar inventario
  React.useEffect(() => {
    console.log('📋 WorkOrderForm - Inventario recibido:', {
      inventoryLength: inventory?.length || 0,
      firstItems: inventory?.slice(0, 2) || [],
      isArray: Array.isArray(inventory),
      sampleFields: inventory?.[0] ? Object.keys(inventory[0]) : []
    });
  }, [inventory]);
  // Auto-calcular total automáticamente cuando cambian partes, mecánicos o extras
  // SOLO para nuevas órdenes (no para edición)
  React.useEffect(() => {
    // Si no hay ID, es una nueva orden, entonces auto-calcular
    if (!workOrder.id) {
      const calculatedTotal = calculateTotalLabAndParts();
      const formattedTotal = `$${calculatedTotal.toFixed(2)}`;
      
      // Solo actualizar si el valor calculado es diferente al actual
      if (workOrder.totalLabAndParts !== formattedTotal) {
        onChange({ target: { name: 'totalLabAndParts', value: formattedTotal } } as any);
      }
    }
  }, [workOrder.parts, workOrder.mechanics, extraOptions, workOrder.id]);
  
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
        }        // Formatear el costo correctamente
        if (cost > 0) {
          newParts[index].cost = cost.toFixed(2);
        } else {
          newParts[index].cost = '0.00';
        }
        
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
    onChange({ target: { name: 'parts', value: newParts } } as any);    // Llamar a onPartChange si está disponible (para compatibilidad)
    if (onPartChange) {
      onPartChange(index, field, value);
    }
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
      }      const dataToSend = {
        ...workOrder,
        parts: cleanParts,
        extraOptions, // Sin agregar el 5% manualmente, el backend lo hará automáticamente
        totalHrs: calculateTotalHours(), // Asegurar que se envíen las horas actuales
        usuario: localStorage.getItem('username') || '',
        forceUpdate: true // Flag para forzar actualización del PDF en edición
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


  // Solo muestra la campana si el trailer está en trailersWithPendingParts
  const showBell = (trailerNumber: string) => {
    return Array.isArray(trailersWithPendingParts) && trailersWithPendingParts.includes(trailerNumber);
  };

  // Si trailersWithPendingParts cambia y el trailer seleccionado YA NO tiene partes pendientes,
  // limpia la campana visual y fuerza refresco del input si es necesario
  React.useEffect(() => {
    if (
      workOrder.trailer &&
      Array.isArray(trailersWithPendingParts) &&
      !trailersWithPendingParts.includes(workOrder.trailer)
    ) {
      // Si el trailer seleccionado ya no tiene partes pendientes, forzar refresco visual
      // Opcional: podrías limpiar el valor, o solo forzar un re-render
      // Aquí solo forzamos un cambio para que el datalist se actualice
      onChange({ target: { name: 'trailer', value: workOrder.trailer } } as any);
    }
  }, [trailersWithPendingParts, workOrder.trailer, onChange]);

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
          </label>            <label style={{ flex: '1 1 120px' }}>
            Trailer
            <input
              list="trailer-options"
              name="trailer"
              value={workOrder.trailer || ''}
              onChange={(e) => {
                // Remover el indicador 🔔 del valor antes de guardarlo
                const cleanValue = e.target.value.replace(' 🔔', '');
                onChange({ target: { name: 'trailer', value: cleanValue } } as any);
              }}
              style={{ width: '100%', marginTop: 4, padding: 8 }}
              placeholder="Selecciona o escribe el trailer..."
            />
            <datalist id="trailer-options">
              {getTrailerOptionsForBill(workOrder.billToCo).map(opt => (
                <option key={opt} value={opt}>
                  {opt}{showBell(opt) ? ' 🔔' : ''}
                </option>
              ))}
            </datalist>          </label>
        </div>

        {/* Previsualizador de Partes Pendientes */}
        {pendingParts && pendingParts.length > 0 && (
          <div style={{
            marginBottom: 16,
            padding: 16,
            border: '2px solid #4caf50',
            borderRadius: 8,
            backgroundColor: '#f1f8e9'
          }}>
            <h3 style={{ 
              color: '#388e3c', 
              marginBottom: 12, 
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              🚛 Partes Pendientes para {workOrder.trailer}
              <span style={{ 
                fontSize: 12, 
                background: '#4caf50', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: 12 
              }}>
                {pendingParts.length} disponible{pendingParts.length !== 1 ? 's' : ''}
              </span>
            </h3>            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: 12 
            }}>
              {pendingParts.map((part: any) => {
                // Calcular cantidad disponible real SOLO con qty de receives (no mezclar con master)
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
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: hasQtyAvailable ? '#2e7d32' : '#666' 
                  }}>
                    {part.sku} - {part.item}
                  </div>
                  <div style={{ fontSize: 14, color: '#666' }}>
                    Cantidad disponible: <strong style={{ 
                      color: hasQtyAvailable ? '#2e7d32' : '#f44336' 
                    }}>
                      {availableQty} {hasQtyAvailable ? '' : '(Agotado)'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, availableQty)}
                      value={pendingPartsQty?.[part.id] || '1'}
                      onChange={(e) => {                        if (setPendingPartsQty) {
                          setPendingPartsQty((prev: any) => ({
                            ...prev,
                            [part.id]: e.target.value
                          }));
                        }
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
                        if (onAddPendingPart && hasQtyAvailable) {
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
                      }}                    >
                      {hasQtyAvailable ? '➕ Agregar a WO' : '❌ Agotado'}
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
              💡 <strong>Tip:</strong> Estas partes ya están asignadas para este trailer. 
              Al agregarlas, se descontarán automáticamente del inventario.
            </div>
          </div>
        )}

        {/* Segunda fila - Status, ID Classic (solo en edición) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <label style={{ flex: '1 1 150px' }}>
            Status
            <select
              name="status"              value={workOrder.status || 'PROCESSING'}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4, padding: 8 }}
            >
              <option value="PROCESSING">PROCESSING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="FINISHED">FINISHED</option>
            </select>
          </label>          {/* ID CLASSIC - Solo habilitado cuando status es FINISHED */}
          <label style={{ flex: '1 1 150px' }}>
            ID CLASSIC {workOrder.status === 'FINISHED' && <span style={{ color: 'red' }}>*</span>}
            <input
              type="text"
              name="idClassic"
              placeholder={workOrder.status === 'FINISHED' ? "ID Classic (requerido)" : "ID Classic (solo disponible cuando status es FINISHED)"}
              value={workOrder.idClassic || ''}
              onChange={onChange}
              disabled={workOrder.status !== 'FINISHED'}
              required={workOrder.status === 'FINISHED'}
              style={{ 
                width: '100%', 
                marginTop: 4, 
                padding: 8,
                borderColor: idClassicError ? '#f44336' : undefined,
                backgroundColor: workOrder.status !== 'FINISHED' ? '#f5f5f5' : '#fff',
                cursor: workOrder.status !== 'FINISHED' ? 'not-allowed' : 'text'
              }}
            />
            {workOrder.status !== 'FINISHED' && (
              <div style={{
                color: '#666',
                fontSize: '11px',
                marginTop: '2px',
                fontStyle: 'italic'
              }}>
                Campo habilitado solo cuando status es FINISHED
              </div>
            )}
            {idClassicError && workOrder.status === 'FINISHED' && (
              <div style={{
                color: '#f44336',
                fontSize: '12px',
                marginTop: '4px',
                fontWeight: '500'
              }}>
                {idClassicError}
              </div>
            )}
          </label>
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
          </div>          {(workOrder.mechanics || []).map((mechanic: any, index: number) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select
                value={mechanic.name || ''}
                onChange={e => handleMechanicChange(index, 'name', e.target.value)}
                style={{ 
                  flex: 1, 
                  padding: 8, 
                  borderRadius: 4, 
                  border: '1px solid #ccc',
                  fontSize: 14,
                  backgroundColor: '#fff'
                }}
              >
                <option value="">Seleccionar mecánico...</option>
                {MECHANICS_LIST.map(mechanicName => (
                  <option key={mechanicName} value={mechanicName}>
                    {mechanicName}
                  </option>
                ))}
              </select>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>            {workOrder.parts && workOrder.parts.map((part: Part, index: number) => (
              <div key={index} style={{
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                position: 'relative'
              }}>
                {/* Botón para eliminar parte */}
                {onDeletePart && (
                  <button
                    type="button"
                    onClick={() => onDeletePart(index)}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      fontSize: 12,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1
                    }}
                    title="Eliminar parte"
                  >
                    ×
                  </button>
                )}<label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  SKU
                  <input
                    list={`inventory-${index}`}
                    type="text"
                    value={part.sku || ''}
                    onChange={e => handlePartChange(index, 'sku', e.target.value)}                    onFocus={(e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.value) {
                        showTooltipForPart(e, target.value);
                      }
                    }}
                    onMouseEnter={(e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.value) {
                        showTooltipForPart(e, target.value);
                      }
                    }}
                    onMouseLeave={hideTooltip}
                    onBlur={hideTooltip}
                    style={{ width: '100%', marginTop: 2, padding: 4 }}
                    placeholder="SKU"
                  /><datalist id={`inventory-${index}`}>
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
                </label>                <div style={{ fontSize: 11, color: '#1976d2', fontWeight: 'bold', marginTop: 4 }}>
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
          </button>        </div>
      </form>
      
      {/* Tooltip para mostrar información de la parte */}
      {tooltip.visible && tooltip.info && (
        <div
          style={{
            position: 'fixed',
            top: tooltip.y + 10,
            left: tooltip.x + 10,
            background: '#fff',
            border: '1px solid #1976d2',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(25,118,210,0.15)',
            padding: 16,
            zIndex: 9999,
            minWidth: 220
          }}
          onClick={hideTooltip}
        >
          <div style={{ fontWeight: 700, color: '#1976d2', marginBottom: 6 }}>Part Info</div>
          <div><b>Part Name:</b> {tooltip.info.part}</div>
          <div><b>Price:</b> {tooltip.info.precio ? Number(tooltip.info.precio).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00'}</div>
          <div><b>On Hand:</b> {tooltip.info.onHand}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>(Click para cerrar)</div>
        </div>
      )}
    </div>
  );
};

export default WorkOrderForm;