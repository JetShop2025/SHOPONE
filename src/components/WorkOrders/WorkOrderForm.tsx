import React from 'react';
import WorkOrderBasicInfoSection from './WorkOrderBasicInfoSection';
import WorkOrderLaborAndDescriptionSection from './WorkOrderLaborAndDescriptionSection';
import WorkOrderPartsSection from './WorkOrderPartsSection';
import WorkOrderCostSummarySection from './WorkOrderCostSummarySection';

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
      if (
        workOrder.miscellaneousFixed === undefined ||
        workOrder.miscellaneousFixed === null ||
        workOrder.miscellaneousFixed === '' ||
        isNaN(Number(workOrder.miscellaneousFixed))
      ) {
        onChange({ target: { name: 'miscellaneousFixed', value: '0' } } as any);
      }
      if (
        workOrder.weldFixed === undefined ||
        workOrder.weldFixed === null ||
        workOrder.weldFixed === '' ||
        isNaN(Number(workOrder.weldFixed))
      ) {
        onChange({ target: { name: 'weldFixed', value: '0' } } as any);
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
      const miscFixed = Number(workOrder.miscellaneousFixed ?? 0);
      const weldFixed = Number(workOrder.weldFixed ?? 0);
      const miscAmount =
        !isNaN(miscFixed) && miscFixed > 0
          ? miscFixed
          : Math.round(subtotal * ((!isNaN(miscPercent) && miscPercent >= 0 ? miscPercent : 0) / 100) * 100) / 100;
      const weldAmount =
        !isNaN(weldFixed) && weldFixed > 0
          ? weldFixed
          : Math.round(subtotal * ((!isNaN(weldPercent) && weldPercent >= 0 ? weldPercent : 0) / 100) * 100) / 100;
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

  const getMiscAmount = (subtotal: number) => {
    const miscFixed = Number(workOrder.miscellaneousFixed ?? 0);
    if (!isNaN(miscFixed) && miscFixed > 0) return miscFixed;
    const miscPercent = Number(workOrder.miscellaneous ?? 0);
    return Math.round(subtotal * ((!isNaN(miscPercent) && miscPercent >= 0 ? miscPercent : 0) / 100) * 100) / 100;
  };

  const getWeldAmount = (subtotal: number) => {
    const weldFixed = Number(workOrder.weldFixed ?? 0);
    if (!isNaN(weldFixed) && weldFixed > 0) return weldFixed;
    const weldPercent = Number(workOrder.weldPercent ?? 0);
    return Math.round(subtotal * ((!isNaN(weldPercent) && weldPercent >= 0 ? weldPercent : 0) / 100) * 100) / 100;
  };

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
    const miscAmount = getMiscAmount(subtotal);
    const weldAmount = getWeldAmount(subtotal);
    const calculatedTotal = subtotal + miscAmount + weldAmount;
    const formattedTotal = `$${calculatedTotal.toFixed(2)}`;
    const currentValue = String(workOrder.totalLabAndParts ?? '').trim();
    if (currentValue !== formattedTotal) {
      onChange({ target: { name: 'totalLabAndParts', value: formattedTotal } } as any);
    }
  }, [workOrder.parts, workOrder.mechanics, workOrder.miscellaneous, workOrder.weldPercent, workOrder.miscellaneousFixed, workOrder.weldFixed, onChange, manualTotalOverride, isEditingMode]);
  
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
    const miscAmount = getMiscAmount(subtotal);
    const weldAmount = getWeldAmount(subtotal);
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
        const miscPercentNum = parseFloat(miscValue) || 0;
        const weldPercentNum = parseFloat(weldValue) || 0;
        const miscFixedNum = Math.max(0, Number(workOrder.miscellaneousFixed || 0)) || 0;
        const weldFixedNum = Math.max(0, Number(workOrder.weldFixed || 0)) || 0;
        const laborTotal = totalHrs * 60;
        const partsTotal = Array.isArray(cleanParts) && cleanParts.length > 0 ? cleanParts.reduce((total: number, part: any) => {
          const qty = Number(part && part.qty);
          const cost = Number(part && String(part.cost).replace(/[^0-9.]/g, ''));
          const validQty = !isNaN(qty) && qty > 0 ? qty : 0;
          const validCost = !isNaN(cost) && cost >= 0 ? cost : 0;
          return total + (validQty * validCost);
        }, 0) : 0;
        const subtotal = laborTotal + partsTotal;
        const miscAmount = miscFixedNum > 0 ? miscFixedNum : subtotal * (miscPercentNum / 100);
        const weldAmount = weldFixedNum > 0 ? weldFixedNum : subtotal * (weldPercentNum / 100);
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
        miscellaneousFixed: String(Math.max(0, Number(workOrder.miscellaneousFixed || 0)) || 0),
        weldFixed: String(Math.max(0, Number(workOrder.weldFixed || 0)) || 0),
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
        {/* Fila 1-2: Basic information */}
        <WorkOrderBasicInfoSection
          workOrder={workOrder}
          onChange={onChange as any}
          idClassicError={idClassicError}
          billToCoOptions={billToCoOptions}
          getTrailerOptionsForBill={getTrailerOptionsForBill}
          showBell={showBell}
          handleDateFieldChange={handleDateFieldChange}
          DateInputWithCalendar={DateInputWithCalendar}
        />

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

        <WorkOrderLaborAndDescriptionSection
          workOrder={workOrder}
          mechanicsList={MECHANICS_LIST}
          DateInputWithCalendar={DateInputWithCalendar}
          addMechanic={addMechanic}
          removeMechanic={removeMechanic}
          handleMechanicChange={handleMechanicChange}
          getDefaultLaborDate={getDefaultLaborDate}
          normalizeDateForSubmit={normalizeDateForSubmit}
          getMechanicHoursSummary={getMechanicHoursSummary}
          autoDescription={autoDescription}
          setAutoDescription={setAutoDescription}
          onChange={onChange as any}
        />

        <WorkOrderPartsSection
          workOrder={workOrder}
          inventory={inventory}
          onAddEmptyPart={onAddEmptyPart}
          onDeletePart={onDeletePart}
          handlePartChange={handlePartChange}
          showTooltipForPart={showTooltipForPart}
          hideTooltip={hideTooltip}
        />
        
        <WorkOrderCostSummarySection
          workOrder={workOrder}
          onChange={onChange as any}
          onCancel={onCancel}
          loading={loading}
          setManualTotalOverride={setManualTotalOverride}
          calculateTotalHours={calculateTotalHours}
          calculatePartsTotal={calculatePartsTotal}
          getMiscAmount={getMiscAmount}
          getWeldAmount={getWeldAmount}
          calculateTotalLabAndParts={calculateTotalLabAndParts}
        />
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