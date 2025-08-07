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
  // Remove excessive inventory debug logging
  React.useEffect(() => {}, [inventory]);


  // Estado local para saber si el usuario editó manualmente el total
  const [manualTotalLabAndParts, setManualTotalLabAndParts] = React.useState<string | null>(null);
  const [isManualTotalLabAndParts, setIsManualTotalLabAndParts] = React.useState(false);

  // Solo auto-calcula si el usuario NO ha editado manualmente
  React.useEffect(() => {
    if (isManualTotalLabAndParts) return; // Si el usuario editó, no sobrescribir JAMÁS
    const calculatedTotal = calculateTotalLabAndParts();
    const formattedTotal = calculatedTotal.toFixed(2);
    const currentValue = workOrder.totalLabAndParts;
    // Solo actualiza si el campo está vacío (no si coincide con el cálculo)
    if (
      currentValue === undefined ||
      currentValue === null ||
      currentValue === ''
    ) {
      onChange({ target: { name: 'totalLabAndParts', value: formattedTotal } } as any);
    }
    // Nunca resetees el flag ni el valor manual aquí
  }, [workOrder.parts, workOrder.mechanics, workOrder.id]);
  
  // Buscar parte en inventario por SKU
  const findPartBySku = (sku: string) => {
    if (!sku || !inventory || inventory.length === 0) {
      return null;
    }
    // Buscar por SKU exacto (case insensitive)
    const exactMatch = inventory.find((item: any) => 
      String(item.sku).toLowerCase() === String(sku).toLowerCase()
    );
    if (exactMatch) {
      return exactMatch;
    }
    // Si no encuentra coincidencia exacta, buscar que contenga el SKU
    const partialMatch = inventory.find((item: any) => 
      String(item.sku).toLowerCase().includes(String(sku).toLowerCase())
    );
    if (partialMatch) {
      return partialMatch;
    }
    return null;
  };// Manejar cambios en las partes con auto-completado
  const handlePartChange = (index: number, field: string, value: string) => {
    // Remove excessive logging
    const newParts = [...(workOrder.parts || [])];
    newParts[index] = { ...newParts[index], [field]: value };

    // Auto-completado cuando se cambia el SKU
    if (field === 'sku' && value && value.trim() !== '') {
      const foundPart = findPartBySku(value);
      if (foundPart) {
        // Autocompletar nombre de la parte
        newParts[index].part = foundPart.part || foundPart.description || foundPart.name || '';
        // Autocompletar costo - PRIORIDAD AL CAMPO 'precio' de la tabla inventory
        let cost = 0;
        if (foundPart.precio) {
          cost = parseFloat(String(foundPart.precio)) || 0;
        } else if (foundPart.cost) {
          cost = foundPart.cost;
        } else if (foundPart.price) {
          cost = foundPart.price;
        } else if (foundPart.unitCost) {
          cost = foundPart.unitCost;
        } else if (foundPart.unit_cost) {
          cost = foundPart.unit_cost;
        }
        // Formatear el costo correctamente
        if (cost > 0) {
          newParts[index].cost = cost.toFixed(2);
        } else {
          newParts[index].cost = '0.00';
        }
      }
    }

    // Calcular costo total para esta parte (qty × costo unitario)
    if (field === 'qty' || field === 'cost') {
      const qty = parseFloat(field === 'qty' ? value : newParts[index].qty) || 0;
      const unitCost = parseFloat(String(field === 'cost' ? value : newParts[index].cost).replace(/[^0-9.]/g, '')) || 0;
      newParts[index].totalCost = qty * unitCost;
    }

    // Siempre actualizar el estado usando onChange
    onChange({ target: { name: 'parts', value: newParts } } as any);
    // Llamar a onPartChange si está disponible (para compatibilidad)
    if (onPartChange) {
      onPartChange(index, field, value);
    }
  };

  // Calcular horas totales automáticamente
  // Labor depende de las horas ingresadas
  const calculateTotalHours = () => {
    if (!workOrder.mechanics || workOrder.mechanics.length === 0) return 0;
    return workOrder.mechanics.reduce((total: number, mechanic: any) => {
      const hrs = Number(mechanic.hrs);
      return total + (!isNaN(hrs) && hrs > 0 ? hrs : 0);
    }, 0);
  };

  // Calcular total de partes automáticamente
  const calculatePartsTotal = () => {
    // Si no hay partes, retorna 0
    if (!workOrder.parts || !Array.isArray(workOrder.parts) || workOrder.parts.length === 0) return 0;
    return workOrder.parts.reduce((total: number, part: any) => {
      // Si la parte está vacía, ignórala
      if (!part || (!part.sku && !part.part && !part.qty && !part.cost)) return total;
      // Solo sumar si qty y cost son números válidos y mayores o iguales a 0
      const qty = Number(part && part.qty);
      const cost = Number(part && String(part.cost).replace(/[^0-9.]/g, ''));
      const validQty = !isNaN(qty) && qty > 0 ? qty : 0;
      const validCost = !isNaN(cost) && cost >= 0 ? cost : 0;
      return total + (validQty * validCost);
    }, 0);
  };

  // Calcular total LAB & PARTS
  const calculateTotalLabAndParts = () => {
    const laborTotal = calculateTotalHours() * 60;
    const partsTotal = calculatePartsTotal();
    const total = laborTotal + partsTotal;
    return !isNaN(total) && total >= 0 ? total : 0;
  };


  // Nueva función para forzar el recálculo del total manualmente
  const handleRecalculateTotal = () => {
    setManualTotalLabAndParts(null); // Permite que el cálculo automático vuelva a tomar control
    setIsManualTotalLabAndParts(false);
    const calculatedTotal = calculateTotalLabAndParts();
    onChange({ target: { name: 'totalLabAndParts', value: calculatedTotal.toFixed(2) } } as any);
  };


  // Comparación shallow por campos clave para partes y mecánicos
  function shallowArrayEqual(arr1: any[], arr2: any[], keys: string[]) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      for (const key of keys) {
        if ((arr1[i]?.[key] ?? '') !== (arr2[i]?.[key] ?? '')) return false;
      }
    }
    return true;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Detectar si el usuario modificó partes, mecánicos o las horas (shallow)
      const originalParts = workOrder.originalParts || [];
      const originalMechanics = workOrder.originalMechanics || [];
      const currentParts = Array.isArray(workOrder.parts) ? workOrder.parts : [];
      const currentMechanics = Array.isArray(workOrder.mechanics) ? workOrder.mechanics : [];
      const partsChanged = !shallowArrayEqual(currentParts, originalParts, ['sku', 'part', 'qty', 'cost']);
      const mechanicsChanged = !shallowArrayEqual(currentMechanics, originalMechanics, ['name', 'hrs']);
      const originalTotalHrs = workOrder.originalTotalHrs !== undefined ? Number(workOrder.originalTotalHrs) : undefined;
      const currentTotalHrs = calculateTotalHours();
      const hoursChanged = originalTotalHrs !== undefined ? (Number(originalTotalHrs) !== Number(currentTotalHrs)) : false;

      // Si NO cambió nada, usar los valores originales
      let cleanParts = currentParts;
      let cleanMechanics = currentMechanics;
      let totalHrs = currentTotalHrs;
      let totalLabAndPartsValue = workOrder.totalLabAndParts;
      if (workOrder.id && !partsChanged && !mechanicsChanged && !hoursChanged) {
        cleanParts = originalParts;
        cleanMechanics = originalMechanics;
        totalHrs = workOrder.originalTotalHrs !== undefined ? workOrder.originalTotalHrs : currentTotalHrs;
        totalLabAndPartsValue = workOrder.originalTotalLabAndParts !== undefined ? workOrder.originalTotalLabAndParts : workOrder.totalLabAndParts;
      } else {
        // Si cambió algo, limpiar partes y recalcular subtotales
        if (Array.isArray(cleanParts)) {
          cleanParts = cleanParts
            .filter((p: Part) => p.sku && String(p.sku).trim() !== '')
            .map((p: Part) => {
              let costValue = p.cost;
              if (typeof costValue === 'string') {
                costValue = costValue !== '' ? Number(String(costValue).replace(/[^0-9.]/g, '')) : costValue;
              }
              let qtyValue = p.qty;
              if (typeof qtyValue === 'string') {
                qtyValue = qtyValue !== '' ? Number(qtyValue) : qtyValue;
              }
              return {
                ...p,
                cost: costValue,
                qty: qtyValue
              };
            });
        }
        // Recalcular totalHrs
        totalHrs = calculateTotalHours();
        const laborTotal = totalHrs * 60;
        const partsTotal = Array.isArray(cleanParts) && cleanParts.length > 0 ? cleanParts.reduce((total: number, part: any) => {
          let cost = Number(part && String(part.cost).replace(/[^0-9.]/g, ''));
          const qty = Number(part && part.qty);
          const validQty = !isNaN(qty) && qty > 0 ? qty : 0;
          const validCost = !isNaN(cost) && cost >= 0 ? cost : 0;
          return total + (validQty * validCost);
        }, 0) : 0;
        totalLabAndPartsValue = laborTotal + partsTotal;
      }

      // Validar cantidades solo si se editan
      const hasInvalidQty = Array.isArray(cleanParts) && cleanParts.some((p: Part) => {
        let qtyValue = p.qty;
        let qtyNum = typeof qtyValue === 'string' ? (qtyValue !== '' ? Number(qtyValue) : NaN) : qtyValue;
        return qtyNum !== undefined && qtyNum !== null && !isNaN(qtyNum) && qtyNum <= 0;
      });
      if (hasInvalidQty) {
        window.alert('Hay partes con cantidad inválida.');
        setLoading(false);
        return;
      }

      // Validar ID Classic si status es FINISHED
      if (workOrder.status === 'FINISHED' && (!workOrder.idClassic || workOrder.idClassic.trim() === '')) {
        window.alert('ID Classic es requerido para órdenes con status FINISHED.');
        setLoading(false);
        return;
      }

      // Si no se coloca el ID Classic, debe ir en blanco
      let idClassicToSend = '';
      if (workOrder.status === 'FINISHED') {
        idClassicToSend = workOrder.idClassic || '';
      } else {
        idClassicToSend = workOrder.idClassic && workOrder.idClassic.trim() !== '' ? workOrder.idClassic : '';
      }

      // Miscellaneous por defecto '5' si está vacío o no es número válido
      let miscValue = workOrder.miscellaneous;
      if (miscValue === undefined || miscValue === null || miscValue === '' || isNaN(Number(miscValue))) {
        miscValue = '5';
      }
      // Welding Supplies por defecto '15' si está vacío o no es número válido
      let weldValue = workOrder.weldPercent;
      if (weldValue === undefined || weldValue === null || weldValue === '' || isNaN(Number(weldValue))) {
        weldValue = '15';
      }

      // Convertir fecha a formato YYYY-MM-DD
      let dateToSend = workOrder.date;
      if (dateToSend) {
        let yyyy = '', mm = '', dd = '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateToSend)) {
          [mm, dd, yyyy] = dateToSend.split('/');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateToSend)) {
          [yyyy, mm, dd] = dateToSend.split('-');
        } else {
          const d = new Date(dateToSend);
          if (!isNaN(d.getTime())) {
            yyyy = String(d.getFullYear());
            mm = String(d.getMonth() + 1).padStart(2, '0');
            dd = String(d.getDate()).padStart(2, '0');
          }
        }
        if (yyyy && mm && dd) {
          dateToSend = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        } else {
          dateToSend = workOrder.date;
        }
      }


      // Mantener los valores originales de totales/cantidades si no se editan
      const dataToSend = {
        ...workOrder,
        idClassic: idClassicToSend,
        parts: cleanParts,
        mechanics: cleanMechanics,
        totalHrs: totalHrs,
        totalLabAndParts: totalLabAndPartsValue, // SIEMPRE número, nunca string con $
        usuario: localStorage.getItem('username') || '',
        forceUpdate: true,
        date: dateToSend
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
  // Eliminar lógica de extras anteriores


  // Solo muestra la campana si el trailer tiene partes pendientes NO usadas
  const showBell = (trailerNumber: string) => {
    // Si hay pendingParts, filtra por trailer y partes no usadas
    if (Array.isArray(pendingParts) && pendingParts.length > 0) {
      // Busca si hay alguna parte pendiente para este trailer que no esté usada
      return pendingParts.some(
        (part: any) =>
          (part.trailer === trailerNumber || part.trailerNumber === trailerNumber) &&
          (!part.status || part.status !== 'USED') &&
          (Number(part.qty) > 0 || Number(part.qty_remaining) > 0)
      );
    }
    // Fallback: lógica anterior
    return Array.isArray(trailersWithPendingParts) && trailersWithPendingParts.includes(trailerNumber);
  };

  // Si trailersWithPendingParts cambia y el trailer seleccionado YA NO tiene partes pendientes,
  // limpia la campana visual y fuerza refresco del input si es necesario
  // Eliminar efecto que forzaba el valor del trailer y bloqueaba edición

  const getTrailerOptionsForBill = (billToCo: string) => {
    return getTrailerOptions ? getTrailerOptions(billToCo) : [];
  };

  // Helper to format date to YYYY-MM-DD (for input type="date")
  const formatDateYYYYMMDD = (date: string | undefined): string => {
    if (!date) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return '';
  };

  // Handler for date input change (always store as YYYY-MM-DD string, never parse or convert)
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      onChange({ target: { name: 'date', value } } as any);
    }
    // Ignore any other format (do not update state)
  };
  return (
    <div style={{
      marginTop: '20px',
      border: '1px solid #1976d2',
      borderRadius: 8,
      padding: '24px',
      background: '#f5faff',
      width: '100%',
      minWidth: '350px',
      maxWidth: '700px',
      boxSizing: 'border-box',
      overflowX: 'auto',
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
              <option value="">Select...</option>
              {billToCoOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          
          <label style={{ flex: '1 1 120px' }}>
            Date<span style={{ color: 'red' }}>*</span>
            <input
              type="date"
              name="date"
              value={formatDateYYYYMMDD(workOrder.date)}
              onChange={handleDateChange}
              required
              style={{ width: '100%', marginTop: 4, padding: 8 }}
              pattern="\d{4}-\d{2}-\d{2}"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label style={{ flex: '1 1 120px' }}>
            Trailer
            <input
              name="trailer"
              value={workOrder.trailer || ''}
              onChange={e => {
                // Permitir cualquier texto y quitar solo el emoji si existe
                const cleanValue = e.target.value.replace(' 🔔', '');
                onChange({ target: { name: 'trailer', value: cleanValue } } as any);
              }}
              style={{ width: '100%', marginTop: 4, padding: 8 }}
              placeholder="Selecciona o escribe el trailer..."
              autoComplete="off"
              list="trailer-options"
            />
            <datalist id="trailer-options">
              {getTrailerOptionsForBill(workOrder.billToCo).map(opt => (
                <option key={opt} value={opt}>
                  {opt}{showBell(opt) ? ' 🔔' : ''}
                </option>
              ))}
            </datalist>
          </label>
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
              name="status"
              value={workOrder.status || 'PROCESSING'}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4, padding: 8 }}
            >
              <option value="PROCESSING">PROCESSING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="FINISHED">FINISHED</option>
              <option value="MISSING_PARTS">MISSING PARTS</option>
            </select>
          </label>
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
            Description
            <textarea
              name="description"
              value={workOrder.description || ''}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4, padding: 8, minHeight: 60 }}
              placeholder="Describe el trabajo realizado..."
            />
          </label>
        </div>

        {/* Tabla editable de partes */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#1976d2', marginBottom: 8 }}>Partes</h3>
          <div style={{ width: '100%', borderRadius: 8, boxShadow: '0 1px 4px rgba(25,118,210,0.07)', background: '#fff', padding: '8px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: '#e3f2fd' }}>
                  <th style={{ minWidth: 120, maxWidth: 180, textAlign: 'left', padding: '8px' }}>SKU</th>
                  <th style={{ minWidth: 120, textAlign: 'left', padding: '8px' }}>Descripción</th>
                  <th style={{ minWidth: 80, textAlign: 'center', padding: '8px' }}>Cantidad</th>
                  <th style={{ minWidth: 100, textAlign: 'center', padding: '8px' }}>Costo Unitario</th>
                  <th style={{ minWidth: 100, textAlign: 'center', padding: '8px' }}>Total</th>
                  <th style={{ minWidth: 60, textAlign: 'center', padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {(workOrder.parts || []).map((part: any, idx: number) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#f7fbff' : '#fff' }}>
                    <td style={{ padding: '6px' }}>
                      <input
                        value={part.sku || ''}
                        onChange={e => handlePartChange(idx, 'sku', e.target.value)}
                        style={{ width: '100%', padding: 4, fontFamily: 'monospace', fontSize: 15, borderRadius: 4, border: '1px solid #bcdffb' }}
                        onFocus={ev => showTooltipForPart(ev, part.sku)}
                        onBlur={hideTooltip}
                        list={`sku-options-${idx}`}
                        autoComplete="off"
                      />
                      <datalist id={`sku-options-${idx}`}>
                        {Array.isArray(inventory) && inventory.map((item: any) => (
                          <option key={item.sku} value={item.sku}>{item.sku} - {item.part}</option>
                        ))}
                      </datalist>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        value={part.part || ''}
                        onChange={e => handlePartChange(idx, 'part', e.target.value)}
                        style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #bcdffb' }}
                      />
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        value={part.qty || ''}
                        onChange={e => handlePartChange(idx, 'qty', e.target.value)}
                        style={{ width: '70px', padding: 4, borderRadius: 4, border: '1px solid #bcdffb', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={part.cost || ''}
                        onChange={e => handlePartChange(idx, 'cost', e.target.value)}
                        style={{ width: '90px', padding: 4, borderRadius: 4, border: '1px solid #bcdffb', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: '#1976d2' }}>
                      ${((part.qty || 0) * (parseFloat(part.cost) || 0)).toFixed(2)}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      <button type="button" onClick={() => onDeletePart && onDeletePart(idx)} style={{ color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={onAddEmptyPart} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>Agregar Parte</button>
        </div>

        {/* Lista editable de mecánicos.. */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#1976d2', marginBottom: 8 }}>Mecánicos</h3>
          {(workOrder.mechanics || []).map((mech: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select
                value={mech.name || ''}
                onChange={e => handleMechanicChange(idx, 'name', e.target.value)}
                style={{ padding: 4, minWidth: 120 }}
              >
                <option value="">Selecciona...</option>
                {MECHANICS_LIST.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input
                type="number"
                min="0"
                value={mech.hrs || ''}
                onChange={e => handleMechanicChange(idx, 'hrs', e.target.value)}
                style={{ width: '80px', padding: 4 }}
                placeholder="Horas"
              />
              <button type="button" onClick={() => removeMechanic(idx)} style={{ color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
            </div>
          ))}
          <button type="button" onClick={addMechanic} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Agregar Mecánico</button>
        </div>

        {/* Totales */}
        <div style={{ marginBottom: 24, background: '#e3f2fd', padding: 12, borderRadius: 8 }}>
          <div><b>Subtotal Partes:</b> ${calculatePartsTotal().toFixed(2)}</div>
          <div><b>Labor:</b> ${calculateTotalHours() * 60}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b>Total LAB & PARTS:</b>
            <input
              type="number"
              step="0.01"
              value={
                manualTotalLabAndParts !== null
                  ? manualTotalLabAndParts
                  : (workOrder.totalLabAndParts !== undefined && workOrder.totalLabAndParts !== null && workOrder.totalLabAndParts !== '' && !isNaN(Number(workOrder.totalLabAndParts))
                    ? Number(workOrder.totalLabAndParts)
                    : calculateTotalLabAndParts().toFixed(2))
              }
              onChange={e => {
                const val = e.target.value;
                setManualTotalLabAndParts(val); // Marca como editado manualmente
                setIsManualTotalLabAndParts(true);
                onChange({
                  target: {
                    name: 'totalLabAndParts',
                    value: val
                  }
                } as any);
              }}
              style={{ width: '140px', padding: 6, fontWeight: 700, fontSize: 16, background: '#fff', border: '1px solid #1976d2', borderRadius: 4 }}
              placeholder="Total manual"
            />
            <span style={{ color: '#888', fontSize: 12 }}>
              (editable, puede ser menor al cálculo)
            </span>
            <button
              type="button"
              onClick={handleRecalculateTotal}
              style={{
                marginLeft: 8,
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '6px 12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Recalcular Total
            </button>
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