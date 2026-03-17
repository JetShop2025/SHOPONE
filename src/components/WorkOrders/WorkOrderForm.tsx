import React from 'react';

export {}; // Force module

// List of predefined mechanics
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
  workOrderNumber?: string | number;
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

interface LaborEntry {
  name?: string;
  hrs?: string | number;
  date?: string;
  task?: string;
  deadHrs?: string | number;
}

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  workOrder, 
  workOrderNumber,
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
  const [manualTotalOverride, setManualTotalOverride] = React.useState(false);
  const [autoDescription, setAutoDescription] = React.useState(true);
  const isEditingMode = Boolean(workOrder?.id && Number(workOrder.id) > 0) || /edit/i.test(String(title || ''));
  
  // Function to hide tooltip
  const hideTooltip = () => setTooltip({ visible: false, x: 0, y: 0, info: null });
  // Function to show tooltip with part info
  const showTooltipForPart = (event: React.MouseEvent | React.FocusEvent, sku: string, partIndex?: number) => {
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
      
      // PRIORITY 1: Use custom description from the form if it exists
      let customPartName = '';
      let customCost = 0;
      if (partIndex !== undefined && workOrder.parts && workOrder.parts[partIndex]) {
        customPartName = workOrder.parts[partIndex].part || '';
        customCost = workOrder.parts[partIndex].cost || 0;
      }
      
      // PRIORITY 2: If no custom description, use the inventory one
      const partName = customPartName || partInfo.part || partInfo.description || partInfo.name || 'Sin nombre';
      
      // PRIORITY 2: If no custom cost, use the inventory one
      const precio = customCost || partInfo.precio || partInfo.cost || partInfo.price || 0;
      
      setTooltip({
        visible: true,
        x: x,
        y: y,
        info: {
          part: partName,
          precio: precio,
          onHand: partInfo.onHand || partInfo.quantity || partInfo.qty || 0,
          um: partInfo.um || partInfo.unit || 'UN'
        }
      });
    }
  };
    // Debug: verificar inventario
  // Remove excessive inventory debug logging
  React.useEffect(() => {}, [inventory]);
  // Set default miscellaneous (5%) and weldPercent (0%) for new Work Orders
  React.useEffect(() => {
    if (!workOrder.id) {
      if (
        workOrder.miscellaneous === undefined ||
        workOrder.miscellaneous === null ||
        workOrder.miscellaneous === '' ||
        isNaN(Number(workOrder.miscellaneous))
      ) {
        onChange({ target: { name: 'miscellaneous', value: '5' } } as any);
      }
      if (
        workOrder.weldPercent === undefined ||
        workOrder.weldPercent === null ||
        workOrder.weldPercent === '' ||
        isNaN(Number(workOrder.weldPercent))
      ) {
        onChange({ target: { name: 'weldPercent', value: '0' } } as any);
      }
    }
  }, [workOrder.id]);

  // Siempre forzar que weldPercent nunca quede vacío (si el usuario borra, poner 0)
  React.useEffect(() => {
    if (
      workOrder.weldPercent === '' ||
      workOrder.weldPercent === undefined ||
      workOrder.weldPercent === null ||
      isNaN(Number(workOrder.weldPercent))
    ) {
      onChange({ target: { name: 'weldPercent', value: '0' } } as any);
    }
  }, [workOrder.weldPercent]);

  React.useEffect(() => {
    // Al abrir el formulario, detectar si el total es un valor manual
    // comparándolo con el cálculo automático
    if (isEditingMode && workOrder.id) {
      const totalHours = Array.isArray(workOrder.mechanics)
        ? workOrder.mechanics.reduce((total: number, mechanic: any) => {
            const hrs = Number(mechanic?.hrs);
            return total + (!isNaN(hrs) && hrs > 0 ? hrs : 0);
          }, 0)
        : 0;
      const laborTotal = totalHours * 60;
      const partsTotal = Array.isArray(workOrder.parts)
        ? workOrder.parts.reduce((total: number, part: any) => {
            if (!part || (!part.sku && !part.part && !part.qty && !part.cost)) return total;
            const qty = Number(part?.qty);
            const cost = Number(String(part?.cost ?? '').replace(/[^0-9.]/g, ''));
            const validQty = !isNaN(qty) && qty > 0 ? qty : 0;
            const validCost = !isNaN(cost) && cost >= 0 ? cost : 0;
            return total + (validQty * validCost);
          }, 0)
        : 0;
      const subtotal = laborTotal + partsTotal;
      const miscPercent = Number(workOrder.miscellaneous ?? 0);
      const weldPercent = Number(workOrder.weldPercent ?? 0);
      const miscAmount = Math.round(subtotal * ((!isNaN(miscPercent) && miscPercent >= 0 ? miscPercent : 0) / 100) * 100) / 100;
      const weldAmount = Math.round(subtotal * ((!isNaN(weldPercent) && weldPercent >= 0 ? weldPercent : 0) / 100) * 100) / 100;
      const calculatedTotal = subtotal + miscAmount + weldAmount;
      
      // Obtener el valor actual del total
      const currentTotal = Number(String(workOrder.totalLabAndParts ?? '').replace(/[^0-9.]/g, ''));
      
      // Si el valor actual difiere del calculado, es un valor manual
      if (!isNaN(currentTotal) && Math.abs(currentTotal - calculatedTotal) > 0.01) {
        setManualTotalOverride(true);
      } else {
        setManualTotalOverride(false);
      }
    } else {
      // En modo creación, iniciar sin override
      setManualTotalOverride(false);
    }
  }, [workOrder.id, title, isEditingMode]);

  // Auto-calculate total automatically:
  // - NEW: siempre que cambien partes/mechanics/misc/weld
  // - EDIT: NUNCA (solo cuando el usuario presiona "Calcular Auto")
  React.useEffect(() => {
    // En modo edición, NO recalcular automáticamente
    if (isEditingMode) return;
    
    // En modo creación, no recalcular si el usuario ya puso un valor manual
    if (manualTotalOverride) return;

    const currentParts = Array.isArray(workOrder.parts) ? workOrder.parts : [];
    const currentMechanics = Array.isArray(workOrder.mechanics) ? workOrder.mechanics : [];

    const totalHours = Array.isArray(workOrder.mechanics)
      ? workOrder.mechanics.reduce((total: number, mechanic: any) => {
          const hrs = Number(mechanic?.hrs);
          return total + (!isNaN(hrs) && hrs > 0 ? hrs : 0);
        }, 0)
      : 0;
    const laborTotal = totalHours * 60;
    const partsTotal = Array.isArray(workOrder.parts)
      ? workOrder.parts.reduce((total: number, part: any) => {
          if (!part || (!part.sku && !part.part && !part.qty && !part.cost)) return total;
          const qty = Number(part?.qty);
          const cost = Number(String(part?.cost ?? '').replace(/[^0-9.]/g, ''));
          const validQty = !isNaN(qty) && qty > 0 ? qty : 0;
          const validCost = !isNaN(cost) && cost >= 0 ? cost : 0;
          return total + (validQty * validCost);
        }, 0)
      : 0;
    const subtotal = laborTotal + partsTotal;
    const miscPercent = Number(workOrder.miscellaneous);
    const weldPercent = Number(workOrder.weldPercent);
    const miscAmount = Math.round(subtotal * ((!isNaN(miscPercent) && miscPercent >= 0 ? miscPercent : 0) / 100) * 100) / 100;
    const weldAmount = Math.round(subtotal * ((!isNaN(weldPercent) && weldPercent >= 0 ? weldPercent : 0) / 100) * 100) / 100;
    const calculatedTotal = subtotal + miscAmount + weldAmount;
    const formattedTotal = `$${calculatedTotal.toFixed(2)}`;
    const currentValue = String(workOrder.totalLabAndParts ?? '').trim();
    if (currentValue !== formattedTotal) {
      onChange({ target: { name: 'totalLabAndParts', value: formattedTotal } } as any);
    }
  }, [workOrder.parts, workOrder.mechanics, workOrder.miscellaneous, workOrder.weldPercent, onChange, manualTotalOverride, isEditingMode]);
  
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
        // Autocompletar unidad de medida desde el Master Inventory
        newParts[index].um = foundPart.um || foundPart.unit || 'EA';
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
  const calculateTotalHours = () => {
    if (!workOrder.mechanics || workOrder.mechanics.length === 0) return 0;
    return workOrder.mechanics.reduce((total: number, mechanic: any) => {
      // Sumar solo si mechanic.hrs es un número válido y mayor o igual a 0
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

  // Calcular total LAB & PARTS + Miscellaneous
  const calculateTotalLabAndParts = () => {
    const totalHours = calculateTotalHours();
    const laborTotal = totalHours * 60; // $60 por hora
    const partsTotal = calculatePartsTotal();
    const subtotal = laborTotal + partsTotal;
    // Miscellaneous: porcentaje extra definido por el usuario
    let miscPercent = Number(workOrder.miscellaneous);
    miscPercent = !isNaN(miscPercent) && miscPercent >= 0 ? miscPercent : 0;
    const miscAmount = Math.round(subtotal * (miscPercent / 100) * 100) / 100;
    // Welding Supplies: porcentaje extra definido por el usuario
    let weldPercent = Number(workOrder.weldPercent);
    weldPercent = !isNaN(weldPercent) && weldPercent >= 0 ? weldPercent : 0;
    const weldAmount = Math.round(subtotal * (weldPercent / 100) * 100) / 100;
    const total = subtotal + miscAmount + weldAmount;
    return !isNaN(total) && total >= 0 ? total : 0;
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

  const sanitizeMechanicsForStorage = (entries: LaborEntry[]) => {
    return (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        const name = String(entry?.name || '').trim();
        const task = String(entry?.task || '').trim();
        const date = normalizeDateForSubmit(entry?.date || '');
        const hrsNum = Number(entry?.hrs);
        const deadHrsNum = Number(entry?.deadHrs);
        const hrs = !isNaN(hrsNum) && hrsNum > 0 ? Number(hrsNum.toFixed(2)) : 0;
        const deadHrs = !isNaN(deadHrsNum) && deadHrsNum > 0 ? Number(deadHrsNum.toFixed(2)) : 0;

        return {
          name,
          hrs,
          date,
          task,
          deadHrs,
        };
      })
      .filter((entry) => {
        return (
          entry.name !== '' ||
          entry.task !== '' ||
          entry.date !== '' ||
          entry.hrs > 0 ||
          entry.deadHrs > 0
        );
      });
  };

  const aggregateMechanicsForSubmit = (entries: LaborEntry[]) => {
    const grouped = new Map<string, { name: string; hrs: number; deadHrs: number }>();

    entries.forEach((entry) => {
      const name = String(entry?.name || '').trim();
      if (!name) return;
      const hrs = Number(entry?.hrs) || 0;
      const deadHrs = Number(entry?.deadHrs) || 0;

      if (grouped.has(name)) {
        const current = grouped.get(name)!;
        current.hrs += hrs;
        current.deadHrs += deadHrs;
      } else {
        grouped.set(name, { name, hrs, deadHrs });
      }
    });

    return Array.from(grouped.values()).map((item) => ({
      name: item.name,
      hrs: Number(item.hrs.toFixed(2)),
      deadHrs: Number(item.deadHrs.toFixed(2)),
    }));
  };

  const buildDescriptionFromEntries = (entries: LaborEntry[]) => {
    return entries
      .filter((entry) => String(entry?.task || '').trim() !== '')
      .map((entry) => {
        const task = String(entry.task || '').trim();
        const mechanic = String(entry.name || '').trim();
        const dateRaw = String(entry.date || '').trim();
        const mmddyyyy = formatDateMMDDYYYY(dateRaw).replace(/\//g, '-');
        const hrs = Number(entry.hrs) || 0;
        const hrsText = hrs > 0 ? ` (${hrs}h)` : '';
        const mechanicText = mechanic ? ` BY ${mechanic}` : '';
        const dateText = mmddyyyy ? ` ${mmddyyyy}` : '';
        return `- ${task}${mechanicText}${dateText}${hrsText}`;
      })
      .join('\n\n');
  };

  const getMechanicHoursSummary = (entries: LaborEntry[]) => {
    const aggregated = aggregateMechanicsForSubmit(entries);
    if (!aggregated.length) return '';
    return aggregated.map((m) => `${m.name}: ${m.hrs}h`).join(' | ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Detectar si el usuario modificó partes, mecánicos o las horas (shallow)
      const originalParts = workOrder.originalParts || [];
      const originalMechanics = workOrder.originalMechanics || [];
      const currentParts = Array.isArray(workOrder.parts) ? workOrder.parts : [];
      const currentMechanics = Array.isArray(workOrder.mechanics) ? workOrder.mechanics : [];
      const normalizedCurrentMechanics = sanitizeMechanicsForStorage(currentMechanics);
      const normalizedOriginalMechanics = sanitizeMechanicsForStorage(originalMechanics);
      const partsChanged = !shallowArrayEqual(currentParts, originalParts, ['sku', 'part', 'qty', 'cost']);
      const mechanicsChanged = !shallowArrayEqual(
        normalizedCurrentMechanics,
        normalizedOriginalMechanics,
        ['name', 'hrs', 'date', 'task', 'deadHrs']
      );
      const originalTotalHrs = workOrder.originalTotalHrs !== undefined ? Number(workOrder.originalTotalHrs) : undefined;
      const currentTotalHrs = calculateTotalHours();
      const hoursChanged = originalTotalHrs !== undefined ? (Number(originalTotalHrs) !== Number(currentTotalHrs)) : false;
      const generatedDescription = buildDescriptionFromEntries(normalizedCurrentMechanics);

      // Detectar si el totalLabAndParts cambió del valor original
      const originalTotal = workOrder.originalTotalLabAndParts !== undefined 
        ? Number(String(workOrder.originalTotalLabAndParts ?? '').replace(/[^0-9.]/g, ''))
        : Number(String(workOrder.totalLabAndParts ?? '').replace(/[^0-9.]/g, ''));
      const currentTotal = Number(String(workOrder.totalLabAndParts ?? '').replace(/[^0-9.]/g, ''));
      const totalChanged = !isNaN(originalTotal) && !isNaN(currentTotal) && Math.abs(originalTotal - currentTotal) > 0.01;

      // Si NO cambió nada, usar los valores originales
      let cleanParts = currentParts;
      let cleanMechanics = normalizedCurrentMechanics;
      let totalHrs = currentTotalHrs;
      let totalLabAndPartsValue = workOrder.totalLabAndParts;
      let descriptionToSend = (autoDescription && generatedDescription) ? generatedDescription : (workOrder.description || '');
      if (workOrder.id && !partsChanged && !mechanicsChanged && !hoursChanged && !totalChanged) {
        // Nada cambió - usar valores originales
        cleanParts = originalParts;
        cleanMechanics = normalizedOriginalMechanics;
        totalHrs = workOrder.originalTotalHrs !== undefined ? workOrder.originalTotalHrs : currentTotalHrs;
        totalLabAndPartsValue = workOrder.originalTotalLabAndParts !== undefined ? workOrder.originalTotalLabAndParts : workOrder.totalLabAndParts;
      } else if (workOrder.id && !partsChanged && !mechanicsChanged && !hoursChanged && totalChanged) {
        // Solo cambió el total - preservar el valor manual
        totalLabAndPartsValue = workOrder.totalLabAndParts;
        cleanParts = originalParts;
        cleanMechanics = normalizedOriginalMechanics;
        totalHrs = workOrder.originalTotalHrs !== undefined ? workOrder.originalTotalHrs : currentTotalHrs;
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
        // Miscellaneous por defecto '0' si está vacío o no es número válido
        let miscValue = workOrder.miscellaneous;
        if (miscValue === undefined || miscValue === null || miscValue === '' || isNaN(Number(miscValue))) {
          miscValue = '0';
        }
        // Welding Supplies por defecto '0' si está vacío o no es número válido
        let weldValue = workOrder.weldPercent;
        if (weldValue === undefined || weldValue === null || weldValue === '' || isNaN(Number(weldValue))) {
          weldValue = '0';
        }
        let miscPercentNum = parseFloat(miscValue) || 0;
        let weldPercentNum = parseFloat(weldValue) || 0;
        const laborTotal = totalHrs * 60;
        const partsTotal = Array.isArray(cleanParts) && cleanParts.length > 0 ? cleanParts.reduce((total: number, part: any) => {
          const qty = Number(part && part.qty);
          const cost = Number(part && String(part.cost).replace(/[^0-9.]/g, ''));
          const validQty = !isNaN(qty) && qty > 0 ? qty : 0;
          const validCost = !isNaN(cost) && cost >= 0 ? cost : 0;
          return total + (validQty * validCost);
        }, 0) : 0;
        const subtotal = laborTotal + partsTotal;
        const miscAmount = subtotal * (miscPercentNum / 100);
        const weldAmount = subtotal * (weldPercentNum / 100);
        const calculatedTotal = subtotal + miscAmount + weldAmount;

        const manualTotalRaw = workOrder.totalLabAndParts;
        if (manualTotalRaw !== undefined && manualTotalRaw !== null && String(manualTotalRaw).trim() !== '') {
          const manualParsed = Number(String(manualTotalRaw).replace(/[^0-9.]/g, ''));
          totalLabAndPartsValue = !isNaN(manualParsed) && manualParsed >= 0 ? manualParsed : calculatedTotal;
        } else {
          totalLabAndPartsValue = calculatedTotal;
        }
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

      // Miscellaneous por defecto '0' si está vacío o no es número válido
      let miscValue = workOrder.miscellaneous;
      if (miscValue === undefined || miscValue === null || miscValue === '' || isNaN(Number(miscValue))) {
        miscValue = '0';
      }
      // Welding Supplies por defecto '0' si está vacío o no es número válido
      let weldValue = workOrder.weldPercent;
      if (weldValue === undefined || weldValue === null || weldValue === '' || isNaN(Number(weldValue))) {
        weldValue = '0';
      }

      const startDateToSend = normalizeDateForSubmit(workOrder.startDate || workOrder.date);
      const endDateToSend = normalizeDateForSubmit(workOrder.endDate);


      const normalizedTotal = Number(String(totalLabAndPartsValue ?? '').replace(/[^0-9.]/g, ''));
      const finalTotalLabAndParts = !isNaN(normalizedTotal) && normalizedTotal >= 0 ? normalizedTotal : 0;

      // Mantener los valores originales de totales/cantidades si no se editan
      const dataToSend = {
        ...workOrder,
        idClassic: idClassicToSend,
        description: descriptionToSend,
        parts: cleanParts,
        mechanics: cleanMechanics,
        totalHrs: totalHrs,
        totalLabAndParts: finalTotalLabAndParts,
        miscellaneous: miscValue,
        weldPercent: weldValue,
        usuario: localStorage.getItem('username') || '',
        forceUpdate: true,
        date: startDateToSend,
        startDate: startDateToSend,
        endDate: endDateToSend || ''
      };

      await onSubmit(dataToSend);
      
      // Notify dashboard to refresh immediately
      window.dispatchEvent(new Event('workOrderUpdated'));
      
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

  const getDefaultLaborDate = () => {
    return normalizeDateForSubmit(workOrder.startDate || workOrder.date || new Date().toISOString().slice(0, 10));
  };

  const addMechanic = () => {
    const newMechanics = [...(workOrder.mechanics || []), { name: '', hrs: '', date: '', task: '' }];
    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
  };

  const removeMechanic = (index: number) => {
    const newMechanics = (workOrder.mechanics || []).filter((_: any, i: number) => i !== index);
    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
  };

  React.useEffect(() => {
    if (!Array.isArray(workOrder.mechanics)) return;
    if (workOrder.mechanics.length > 0) return;
    // Initialize with one row, date preset to START DATE
    const defaultDate = normalizeDateForSubmit(workOrder.startDate || workOrder.date || new Date().toISOString().slice(0, 10));
    onChange({
      target: {
        name: 'mechanics',
        value: [{ name: '', hrs: '', date: defaultDate, task: '' }],
      },
    } as any);
  }, [workOrder.id]);

  React.useEffect(() => {
    if (!Array.isArray(workOrder.mechanics)) return;
    if (workOrder.mechanics.length !== 1) return;

    const first = workOrder.mechanics[0] || {};
    const shouldSyncFirstDate =
      !String(first.name || '').trim() &&
      !String(first.hrs || '').trim() &&
      !String(first.task || '').trim();

    if (!shouldSyncFirstDate) return;

    const startDateDefault = normalizeDateForSubmit(workOrder.startDate || workOrder.date || new Date().toISOString().slice(0, 10));
    if ((first.date || '') === startDateDefault) return;

    const newMechanics = [...workOrder.mechanics];
    newMechanics[0] = { ...first, date: startDateDefault };
    onChange({ target: { name: 'mechanics', value: newMechanics } } as any);
  }, [workOrder.startDate, workOrder.id]);

  React.useEffect(() => {
    const hasStructuredRows = Array.isArray(workOrder.mechanics)
      ? workOrder.mechanics.some((m: any) => String(m?.task || '').trim() !== '' || String(m?.date || '').trim() !== '')
      : false;
    const hasDescription = String(workOrder.description || '').trim() !== '';
    setAutoDescription(hasStructuredRows || !hasDescription);
  }, [workOrder.id, title]);

  React.useEffect(() => {
    if (!autoDescription) return;
    if (!Array.isArray(workOrder.mechanics)) return;
    const generated = buildDescriptionFromEntries(workOrder.mechanics);
    if (!generated && String(workOrder.description || '').trim() !== '') return;
    if ((workOrder.description || '') !== generated) {
      onChange({ target: { name: 'description', value: generated } } as any);
    }
  }, [workOrder.mechanics, autoDescription]);
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

  // Mostrar fechas en MM/DD/YYYY en los formularios (crear/editar)
  const formatDateMMDDYYYY = (date: string | undefined): string => {
    if (!date) return '';
    const trimmed = String(date).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [yyyy, mm, dd] = trimmed.split('-');
      return `${mm}/${dd}/${yyyy}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const [yyyy, mm, dd] = trimmed.slice(0, 10).split('-');
      return `${mm}/${dd}/${yyyy}`;
    }
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return '';
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    const yyyy = String(parsed.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  };

  const normalizeDateInputToMMDDYYYY = (value: string): string => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const normalizeDateForSubmit = (dateValue: string | undefined): string => {
    if (!dateValue) return '';
    const trimmed = String(dateValue).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [mm, dd, yyyy] = trimmed.split('/');
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
    const parsedDate = new Date(trimmed);
    if (isNaN(parsedDate.getTime())) return '';
    const yyyy = String(parsedDate.getFullYear());
    const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(parsedDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Format date from YYYY-MM-DD to MM/DD/YYYY for display
  const formatDateForDisplay = (dateValue: string) => {
    if (!dateValue || String(dateValue).trim() === '') return '';
    const trimmed = String(dateValue).trim();
    // If already in MM/DD/YYYY format, return as is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
    // If in YYYY-MM-DD format, convert to MM/DD/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [yyyy, mm, dd] = trimmed.split('-');
      return `${mm}/${dd}/${yyyy}`;
    }
    return '';
  };

  // Handler for date inputs (now accepting MM/DD/YYYY format from text input)
  const handleDateFieldChange = (fieldName: 'startDate' | 'endDate') => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value; // User enters in MM/DD/YYYY format
    // Convert MM/DD/YYYY to YYYY-MM-DD for internal storage
    value = normalizeDateForSubmit(value);
    onChange({ target: { name: fieldName, value } } as any);
    if (fieldName === 'startDate') {
      onChange({ target: { name: 'date', value } } as any);
    }
  };

  const DateInputWithCalendar: React.FC<{
    value: string;
    onTextChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCalendarChange: (isoDate: string) => void;
    placeholder?: string;
    required?: boolean;
    inputName?: string;
    inputStyle?: React.CSSProperties;
  }> = ({ value, onTextChange, onCalendarChange, placeholder = 'MM/DD/YYYY', required = false, inputName, inputStyle }) => {
    const calendarRef = React.useRef<HTMLInputElement>(null);

    const openPicker = () => {
      const picker = calendarRef.current;
      if (!picker) return;
      if (typeof picker.showPicker === 'function') {
        picker.showPicker();
      } else {
        picker.click();
      }
    };

    return (
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          name={inputName}
          value={formatDateForDisplay(value)}
          onChange={onTextChange}
          placeholder={placeholder}
          required={required}
          style={{ width: '100%', padding: '6px 32px 6px 8px', boxSizing: 'border-box', fontSize: '14px', ...(inputStyle || {}) }}
          autoComplete="off"
        />

        <input
          ref={calendarRef}
          type="date"
          value={normalizeDateForSubmit(value)}
          onChange={(e) => onCalendarChange(e.target.value)}
          aria-label="Open calendar"
          style={{
            position: 'absolute',
            right: 8,
            top: 0,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none'
          }}
        />

        <button
          type="button"
          onClick={openPicker}
          aria-label="Open calendar picker"
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            color: '#0A3854',
            padding: 2
          }}
        >
          📅
        </button>
      </div>
    );
  };

  return (
    <div style={{
      marginTop: '0px',
      border: 'none',
      borderRadius: 0,
      padding: '0px',
      background: '#fff',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      maxHeight: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      boxShadow: 'none'
    }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ color: '#0A3854', margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <div style={{
            fontSize: 14,
            fontWeight: 800,
            color: '#0A3854',
            background: '#e3f2fd',
            border: '1px solid #90caf9',
            borderRadius: 999,
            padding: '4px 10px'
          }}>
            W.O #{workOrderNumber ?? workOrder?.id ?? 'N/A'}
          </div>
        </div>
        {loading && (
          <div style={{ color: '#0A3854', fontWeight: 700, marginBottom: 8 }}>
            Processing, please wait...
          </div>
        )}
        {successMsg && (
          <div style={{ color: 'green', fontWeight: 700, marginBottom: 8 }}>
            {successMsg}
          </div>
        )}
        
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            alignItems: 'start'
          }}
        >
        {/* Fila 1: Bill To Company (2 cols) | Start Date (1 col) | End Date (1 col) */}
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
            {billToCoOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        
        <label style={{ gridColumn: 'span 1' }}>
          Start Date<span style={{ color: 'red' }}>*</span>
          <DateInputWithCalendar
            value={workOrder.startDate || workOrder.date || ''}
            onTextChange={handleDateFieldChange('startDate')}
            onCalendarChange={(value) => {
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
            onCalendarChange={(value) => onChange({ target: { name: 'endDate', value } } as any)}
            placeholder="MM/DD/YYYY"
            inputName="endDate"
            inputStyle={{ marginTop: '4px' }}
          />
        </label>
        
        {/* Fila 2: Trailer (2 cols) | Status (1 col) | ID Classic (1 col) */}
        <label style={{ gridColumn: 'span 2' }}>
          Trailer
          <input
            name="trailer"
            value={workOrder.trailer || ''}
            onChange={e => {
              const cleanValue = e.target.value.replace(' 🔔', '');
              onChange({ target: { name: 'trailer', value: cleanValue } } as any);
            }}
            style={{ width: '100%', marginTop: 4, padding: '6px 8px', boxSizing: 'border-box', fontSize: '14px' }}
            placeholder="Select or type trailer..."
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
            placeholder={workOrder.status === 'FINISHED' ? "Required" : "When FINISHED"}
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
              cursor: workOrder.status !== 'FINISHED' ? 'not-allowed' : 'text'
            }}
          />
          {idClassicError && workOrder.status === 'FINISHED' && (
            <div style={{
              color: '#f44336',
              fontSize: '10px',
              marginTop: '2px',
              fontWeight: '500'
            }}>
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

        {/* Previsualizador de Partes Pendientes */}
        {pendingParts && pendingParts.length > 0 && (
          <div style={{
            marginBottom: 0,
            padding: 16,
            border: '2px solid #4caf50',
            borderRadius: 8,
            backgroundColor: '#f1f8e9',
            gridColumn: '1 / -1'
          }}>
            <h3 style={{ 
              color: '#388e3c', 
              marginBottom: 12, 
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              🚛 Pending Parts for {workOrder.trailer}
              <span style={{ 
                fontSize: 12, 
                background: '#4caf50', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: 12 
              }}>
                {pendingParts.length} available
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
                      Available Qty: <strong style={{ 
                        color: hasQtyAvailable ? '#2e7d32' : '#f44336' 
                      }}>
                        {availableQty} {hasQtyAvailable ? '' : '(Out of Stock)'}
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
                        {hasQtyAvailable ? '➕ Add to WO' : '❌ Out of Stock'}
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
              💡 <strong>Tip:</strong> These parts are already assigned to this trailer. 
              When added, they will be automatically deducted from inventory.
            </div>
          </div>
        )}

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
                fontSize: '12px'
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
                onTextChange={e => handleMechanicChange(index, 'date', normalizeDateForSubmit(e.target.value))}
                onCalendarChange={(value) => handleMechanicChange(index, 'date', value)}
                placeholder="MM/DD/YYYY"
              />
              <select
                value={mechanic.name || ''}
                onChange={e => handleMechanicChange(index, 'name', e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '6px', 
                  borderRadius: 4, 
                  border: '1px solid #ccc',
                  fontSize: 13,
                  backgroundColor: '#fff',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Mechanic...</option>
                {MECHANICS_LIST.map(mechanicName => (
                  <option key={mechanicName} value={mechanicName}>
                    {mechanicName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Hrs"
                value={mechanic.hrs || ''}
                onChange={e => handleMechanicChange(index, 'hrs', e.target.value)}
                style={{ width: '100%', padding: '6px', boxSizing: 'border-box', fontSize: '13px' }}
                step="0.25"
                min="0"
              />
              <input
                type="text"
                placeholder="Work done..."
                value={mechanic.task || ''}
                onChange={e => handleMechanicChange(index, 'task', e.target.value)}
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
                  lineHeight: '1'
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
              Descripción / Invoice Notes<span style={{ color: 'red' }}>*</span>
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
            Tip: Use labor rows to generate clear lines by date/mecanic/hours automatically.
          </div>
        </div>

        <div style={{ marginBottom: 0, gridColumn: '1 / -1', minWidth: 0, maxHeight: 430, overflowY: 'auto', overflowX: 'hidden', padding: 12, border: '1px solid #d9e2ec', borderRadius: 8, background: '#f8fbff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'space-between' }}>
            <strong>Parts ({(workOrder.parts || []).length})</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onAddEmptyPart && (
              <button
                type="button"
                onClick={onAddEmptyPart}
                style={{
                  padding: '4px 8px',
                  background: '#0A3854',
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
          </div>
          <div style={{ fontSize: 11, color: '#5f7387', marginBottom: 10 }}>
            Vista en lista por tarjetas con 2+ columnas y scroll interno para evitar desbordes.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, alignItems: 'start' }}>            {workOrder.parts && workOrder.parts.map((part: Part, index: number) => (
              <div key={index} style={{
                border: '1px solid #cdd9e5',
                borderRadius: 8,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                position: 'relative',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(10,56,84,0.08)'
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
                    title="Delete part"
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
                        showTooltipForPart(e, target.value, index);
                      }
                    }}
                    onMouseEnter={(e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.value) {
                        showTooltipForPart(e, target.value, index);
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
                  Part Name
                  <input
                    type="text"
                    value={part.part || ''}
                    onChange={e => handlePartChange(index, 'part', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4, backgroundColor: '#f0f8ff' }}
                    placeholder="Part description"
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  Quantity
                  <input
                    type="number"
                    value={part.qty || ''}
                    onChange={e => handlePartChange(index, 'qty', e.target.value)}
                    style={{ width: '100%', marginTop: 2, padding: 4 }}
                    placeholder="Quantity"
                  />
                </label>                <label style={{ fontSize: 12, fontWeight: 'bold' }}>
                  Unit Cost
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
                <div style={{ fontSize: 11, color: '#0A3854', fontWeight: 'bold', marginTop: 4 }}>
                  Total: ${((parseFloat(String(part.qty || '0'))) * (parseFloat(String(part.cost).replace(/[^0-9.]/g, '')) || 0)).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          {/* TOTAL PARTS FOOTER */}
          {workOrder.parts && workOrder.parts.length > 0 && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: '#0A3854',
              color: 'white',
              borderRadius: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 700,
              fontSize: 14
            }}>
              <span>PARTS TOTAL:</span>
              <span style={{ fontSize: 16 }}>
                ${workOrder.parts.reduce((total: number, part: any) => {
                  const qty = parseFloat(String(part?.qty || '0'));
                  const cost = parseFloat(String(part?.cost ?? '0').replace(/[^0-9.]/g, ''));
                  return total + ((!isNaN(qty) && qty > 0 ? qty : 0) * (!isNaN(cost) && cost >= 0 ? cost : 0));
                }, 0).toFixed(2)}
              </span>
            </div>
          )}
        </div>
        
        <div style={{ marginBottom: 0, gridColumn: 'span 4', minWidth: 0 }}>
          <strong>Miscellaneous</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 500, color: '#0A3854', marginRight: 4, display: 'inline-flex', alignItems: 'center' }}>
              % Miscellaneous:
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                name="miscellaneous"
                value={workOrder.miscellaneous ?? ''}
                onChange={e => {
                  onChange({ target: { name: 'miscellaneous', value: e.target.value } } as any);
                }}
                style={{ width: 76, marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                placeholder="%"
              />
            </label>
            <span style={{ color: '#0A3854', fontWeight: 700, whiteSpace: 'nowrap', background: '#f0f4f8', border: '1px solid #b0c4de', borderRadius: 6, padding: '6px 10px' }}>
              Extra charge: ${(() => {
                const totalHours = calculateTotalHours();
                const laborTotal = totalHours * 60;
                const partsTotal = calculatePartsTotal();
                const subtotal = laborTotal + partsTotal;
                const miscPercent = parseFloat(workOrder.miscellaneous) || 0;
                return (subtotal * (miscPercent / 100)).toFixed(2);
              })()}
            </span>
          </div>
        </div>
        {/* Welding Supplies field */}
        <div style={{ marginBottom: 0, gridColumn: 'span 4', minWidth: 0 }}>
          <strong>Welding Supplies</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 500, color: '#0A3854', marginRight: 4, display: 'inline-flex', alignItems: 'center' }}>
              % Welding Supplies:
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                name="weldPercent"
                value={workOrder.weldPercent ?? ''}
                onChange={e => {
                  onChange({ target: { name: 'weldPercent', value: e.target.value } } as any);
                }}
                style={{ width: 76, marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                placeholder="%"
              />
            </label>
            <span style={{ color: '#0A3854', fontWeight: 700, whiteSpace: 'nowrap', background: '#f0f4f8', border: '1px solid #b0c4de', borderRadius: 6, padding: '6px 10px' }}>
              Cargo extra: ${(() => {
                const totalHours = calculateTotalHours();
                const laborTotal = totalHours * 60;
                const partsTotal = calculatePartsTotal();
                const subtotal = laborTotal + partsTotal;
                const weldPercent = parseFloat(workOrder.weldPercent) || 0;
                return (subtotal * (weldPercent / 100)).toFixed(2);
              })()}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 16, gridColumn: 'span 4', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', flexDirection: 'column' }}>
              Total LAB & PARTS
              <input
                type="text"
                name="totalLabAndParts"
                value={
                  (workOrder.totalLabAndParts === 0 || workOrder.totalLabAndParts === '0' ||
                   (workOrder.totalLabAndParts !== undefined && workOrder.totalLabAndParts !== null && String(workOrder.totalLabAndParts).trim() !== ''))
                    ? (typeof workOrder.totalLabAndParts === 'number' ? `$${workOrder.totalLabAndParts.toFixed(2)}` : String(workOrder.totalLabAndParts))
                    : `$${calculateTotalLabAndParts().toFixed(2)}`
                }
                onChange={(e) => {
                  setManualTotalOverride(true);
                  onChange(e as any);
                }}
                style={{ 
                  width: 220,
                  marginTop: 4, 
                  padding: '8px 10px', 
                  fontWeight: 'bold',
                  backgroundColor: '#ffffff',
                  border: '2px solid #0A3854',
                  color: '#0A3854',
                  fontSize: '16px',
                  borderRadius: 6
                }}
                placeholder="$0.00"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setManualTotalOverride(false);
                const calculatedTotal = calculateTotalLabAndParts();
                onChange({ target: { name: 'totalLabAndParts', value: `$${calculatedTotal.toFixed(2)}` } } as any);
              }}
              style={{
                padding: '8px 12px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                fontSize: '12px',
                marginTop: 0,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Calcular Auto
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4, maxWidth: 620 }}>
            Cálculo sugerido: Labor (${(calculateTotalHours() * 60).toFixed(2)}) + Partes (${calculatePartsTotal().toFixed(2)}) + Miscellaneous (${(() => {
              const totalHours = calculateTotalHours();
              const laborTotal = totalHours * 60;
              const partsTotal = calculatePartsTotal();
              const subtotal = laborTotal + partsTotal;
              const miscPercent = parseFloat(workOrder.miscellaneous) || 0;
              return (subtotal * (miscPercent / 100)).toFixed(2);
            })()}) + Welding Supplies (${(() => {
              const totalHours = calculateTotalHours();
              const laborTotal = totalHours * 60;
              const partsTotal = calculatePartsTotal();
              const subtotal = laborTotal + partsTotal;
              const weldPercent = parseFloat(workOrder.weldPercent) || 0;
              return (subtotal * (weldPercent / 100)).toFixed(2);
            })()}) = ${(() => {
              const totalHours = calculateTotalHours();
              const laborTotal = totalHours * 60;
              const partsTotal = calculatePartsTotal();
              const subtotal = laborTotal + partsTotal;
              const miscPercent = parseFloat(workOrder.miscellaneous) || 0;
              const weldPercent = parseFloat(workOrder.weldPercent) || 0;
              return (subtotal + (subtotal * (miscPercent / 100)) + (subtotal * (weldPercent / 100))).toFixed(2);
            })()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 8, gridColumn: '1 / -1', position: 'sticky', bottom: 0, background: '#fff', paddingTop: 12, borderTop: '1px solid #d9e2ec', zIndex: 3 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? '#ccc' : '#0A3854',
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
              color: '#0A3854',
              border: '1px solid #0A3854',
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
            border: '1px solid #0A3854',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(10,56,84,0.15)',
            padding: 16,
            zIndex: 9999,
            minWidth: 220
          }}
          onClick={hideTooltip}
        >
          <div style={{ fontWeight: 700, color: '#0A3854', marginBottom: 6 }}>Part Info</div>
          <div><b>Part Name:</b> {tooltip.info.part}</div>
          <div><b>Price:</b> {tooltip.info.precio ? Number(tooltip.info.precio).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00'}</div>
          <div><b>On Hand:</b> {tooltip.info.onHand}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>(Click para cerrar)</div>
        </div>
      )}
      </div>
    </div>
  );
};

export default WorkOrderForm;