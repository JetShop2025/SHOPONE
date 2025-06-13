import React, { useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com';

interface WorkOrderFormProps {
  workOrder: any;
  onChange: (e: React.ChangeEvent<any>, index?: number, field?: string) => void;
  onPartChange: (index: number, field: string, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  title: string;
  billToCoOptions: string[];
  getTrailerOptions: (billToCo: string) => string[];
  inventory: any[];
  trailersWithPendingParts?: string[];
  pendingParts?: any[];
  pendingPartsQty?: { [id: number]: string };
  setPendingPartsQty?: React.Dispatch<React.SetStateAction<{ [id: number]: string }>>;
  onAddPendingPart?: (part: any, qty: string) => void;
  onAddEmptyPart?: () => void;
  extraOptions: string[];
  setExtraOptions: React.Dispatch<React.SetStateAction<string[]>>;
}

interface Part {
  sku: string;
  part: string;
  qty: number;
  cost: number;
  [key: string]: any;
}

const formatCurrency = (value: string | number) => {
  const num = Number(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

// Convierte a formato $0.00
const formatCurrencyInput = (value: string | number) => {
  const num = Number(value.toString().replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

// Convierte $0.00 a número simple
const parseCurrencyInput = (value: string) => {
  return value.replace(/[^0-9.]/g, '');
};

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  workOrder, onChange, onPartChange, onSubmit, onCancel, title, billToCoOptions, getTrailerOptions, inventory, trailersWithPendingParts, pendingParts, pendingPartsQty, setPendingPartsQty, onAddPendingPart, onAddEmptyPart, extraOptions, setExtraOptions
}) => {
  const [autocomplete, setAutocomplete] = React.useState<{ [k: number]: any[] }>({});
  const [loading, setLoading] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');
  const [manualCostEdit, setManualCostEdit] = React.useState<{ [k: number]: boolean }>({});
  const [manualTotalEdit, setManualTotalEdit] = React.useState(false);

  // Normaliza datos al abrir para edición
  useEffect(() => {
    if (!workOrder) return;

    // Normaliza extras
    let normalizedExtras = workOrder.extraOptions;
    if (typeof normalizedExtras === 'string') {
      try {
        normalizedExtras = JSON.parse(normalizedExtras);
      } catch {
        normalizedExtras = [];
      }
    }
    if (!Array.isArray(normalizedExtras)) normalizedExtras = [];

    // Sincroniza el estado local de extras con los de la orden
    setExtraOptions(normalizedExtras);

    // Normaliza mecánicos
    let normalizedMechanics = workOrder.mechanics;
    if (typeof normalizedMechanics === 'string') {
      try {
        normalizedMechanics = JSON.parse(normalizedMechanics);
      } catch {
        normalizedMechanics = [];
      }
    }
    if (!Array.isArray(normalizedMechanics)) normalizedMechanics = [];

    // Normaliza total
    let normalizedTotal = workOrder.totalLabAndParts;
    if (
      normalizedTotal !== undefined &&
      normalizedTotal !== null &&
      normalizedTotal !== '' &&
      !isNaN(Number(String(normalizedTotal).replace(/[^0-9.]/g, '')))
    ) {
      normalizedTotal = Number(String(normalizedTotal).replace(/[^0-9.]/g, ''));
    } else {
      normalizedTotal = '';
    }

    // Aplica normalización
    onChange({
      ...workOrder,
      extraOptions: normalizedExtras,
      mechanics: normalizedMechanics,
      totalLabAndParts: normalizedTotal,
    });
    // eslint-disable-next-line
  }, [workOrder.id]);

  const handlePartChange = (index: number, field: string, value: string) => {
    if (field === 'part') {
      // Obtén los SKUs ya seleccionados en otras líneas
      const usedSkus = workOrder.parts
        .filter((p: Part, i: number) => i !== index && p.sku)
        .map((p: Part) => p.sku);

      // Filtra inventario excluyendo los ya usados
      const suggestions = inventory.filter(item =>
        !usedSkus.includes(item.sku) && (
          item.sku.toLowerCase().includes(value.toLowerCase()) ||
          (item.part && item.part.toLowerCase().includes(value.toLowerCase()))
        )
      );
      setAutocomplete(prev => ({ ...prev, [index]: suggestions }));

      // Si selecciona una sugerencia exacta, autocompleta precio unitario
      const found = inventory.find(item => item.sku === value || item.part === value);
      if (found) {
        onPartChange(index, 'sku', found.sku);
        onPartChange(index, 'part', found.part);
        onPartChange(index, 'unitPrice', found.precio || found.price || found.costTax || '');
        onPartChange(index, 'invoiceLink', found.invoiceLink || '');
        // Guarda el costo unitario, NO qty * unitario
        onPartChange(index, 'cost', formatCurrencyInput(found.precio || found.price || found.costTax || 0));
        setAutocomplete(prev => ({ ...prev, [index]: [] }));
      } else {
        onPartChange(index, 'part', value);
        onPartChange(index, 'unitPrice', '');
        onPartChange(index, 'cost', '');
      }
    } else if (field === 'qty') {
      onPartChange(index, 'qty', value);
      // NO recalcules el costo aquí, solo deja el unitario
    } else if (field === 'cost') {
      setManualCostEdit(prev => ({ ...prev, [index]: true })); // marca como editado manualmente
      onPartChange(index, 'cost', formatCurrencyInput(parseCurrencyInput(value)));
    } else {
      onPartChange(index, field, value);
    }
  };

  // Cuando cambia qty o unitario:
  const handleQtyOrUnitChange = (index: number, field: string, value: string) => {
    const part = workOrder.parts[index];
    let qty = field === 'qty' ? Number(value) : Number(part.qty);
    let unit = field === 'unit' ? Number(value) : Number(part.unitCost);
    let total = qty * unit;
    // Actualiza el campo cambiado
    onPartChange(index, field, value);
    // Actualiza el costo total de la línea
    onPartChange(index, 'cost', total.toString());
  };

  // Suma de partess
  const partsTotal = workOrder.parts?.reduce((sum: number, part: Part) => {
    // El campo cost ya debe ser el total de la línea (unitario * cantidad)
    const cost = Number(part.cost?.toString().replace(/[^0-9.]/g, ''));
    return sum + (isNaN(cost) ? 0 : cost); // Solo suma el total de la línea
  }, 0) || 0;

  // Labor
  const laborHrs = Array.isArray(workOrder.mechanics)
  ? workOrder.mechanics.reduce((sum: number, m: any) => sum + (Number(m.hrs) || 0), 0)
  : 0;
  const laborTotal = laborHrs > 0 ? laborHrs * 60 : 0;

  // Subtotal
  const subtotal = partsTotal + laborTotal;
  let extra = 0;
  (extraOptions || []).forEach(opt => {
    if (opt === '5') extra += subtotal * 0.05;
    if (opt === '15shop') extra += subtotal * 0.15;
    if (opt === '15weld') extra += subtotal * 0.15;
  });
  const totalLabAndParts = subtotal + extra;

  useEffect(() => {
    if (!manualTotalEdit) {
      const total = calcularTotalWO(workOrder);
      onChange({ ...workOrder, totalLabAndParts: total });
    }
    // eslint-disable-next-line
  }, [workOrder.parts, workOrder.mechanics, workOrder.extraOptions]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any) => {
    if (e && e.target) {
      const { name, value } = e.target;
      onChange({ ...workOrder, [name]: value });
    } else if (typeof e === 'object') {
      onChange(e);
    }
  };

  return (
    <div
      style={{
        marginTop: '20px',
        border: '1px solid #1976d2',
        borderRadius: 8,
        padding: '24px',
        background: '#f5faff',
        maxWidth: 700,
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.08)'
      }}
    >
      <h2 style={{ color: '#1976d2', marginBottom: 16 }}>{title}</h2>
      {loading && <div>Generando orden y PDF, por favor espera...</div>}
      {successMsg && <div>{successMsg}</div>}
      <form
        onSubmit={async e => {
          e.preventDefault(); // Esto es clave
          
          const cleanParts = workOrder.parts
  .filter((p: Part) => p.sku && String(p.sku).trim() !== '')
  .map((p: Part) => {
    const qty = Number(p.qty) || 0;
    const cost = Number(String(p.cost).replace(/[^0-9.]/g, ''));
    // Si el usuario puso el unitario, lo multiplicamos por qty
    // Si ya puso el total de la línea, lo dejamos igual
    // Considera unitario si cost < 1000 y qty > 1
    const total = (qty > 0 && cost > 0 && cost < 1000) ? cost * qty : cost;
    return {
      ...p,
      cost: total
    };
  });

          // Antes de enviar al backend, limpia el valor:
          const cleanTotalLabAndParts = workOrder.totalLabAndParts
            ? Number(String(workOrder.totalLabAndParts).replace(/[^0-9.]/g, ''))
            : undefined;

          const hasInvalidQty = cleanParts.some((p: Part) => !p.qty || Number(p.qty) <= 0);
          if (hasInvalidQty) {
            window.alert('Hay partes con cantidad inválida.');
            setLoading(false);
            return;
          }

          try {
            let res;
            if (workOrder.id) {
              res = await axios.put<{ pdfUrl?: string }>(`${API_URL}/work-orders/${workOrder.id}`, {
                ...workOrder,
                totalLabAndParts: cleanTotalLabAndParts,
                parts: cleanParts,
                extraOptions,
                usuario: localStorage.getItem('username') || ''
              });
              window.alert('¡Orden editada y PDF generado con éxito!');
            } else {
              res = await axios.post<{ pdfUrl?: string }>(`${API_URL}/work-orders`, {
                ...workOrder,
                totalLabAndParts: cleanTotalLabAndParts,
                parts: cleanParts,
                extraOptions,
                usuario: localStorage.getItem('username') || ''
              });
              window.alert('¡Orden creada y PDF generado con éxito!');
            }

            // Abrir PDF SOLO en nueva pestaña
            if (res.data.pdfUrl) {
              window.open(`${API_URL}${res.data.pdfUrl}`, '_blank', 'noopener,noreferrer');
            }

            setLoading(false);
            onSubmit(); // Esto debe cerrar el formulario/modal y refrescar la tabla
          } catch (err: any) {
            setLoading(false);
            if (err.response && err.response.data) {
              window.alert(err.response.data);
            } else {
              window.alert('Ocurrió un error al guardar la orden.');
            }
          }
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <label style={{ flex: '1 1 200px' }}>
            Bill To Co<span style={{ color: 'red' }}>*</span>
            <input
              list="clientes"
              name="billToCo"
              value={workOrder.billToCo}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
              required
              autoComplete="off"
              placeholder="Escribe o selecciona..."
            />
            <datalist id="clientes">
              {billToCoOptions.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </label>
          <label style={{ flex: '1 1 120px' }}>
            Fecha<span style={{ color: 'red' }}>*</span>
            <input
              type="date"
              name="date"
              value={workOrder.date || ''}
              onChange={onChange}
              required
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ flex: '1 1 120px' }}>
            Trailer
            {(() => {
              const trailerOpts = getTrailerOptions(workOrder.billToCo);
              if (trailerOpts.length > 0) {
                return (
                  <select
                    name="trailer"
                    value={workOrder.trailer}
                    onChange={onChange}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <option value="">Selecciona...</option>
                    {trailerOpts.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                        {trailersWithPendingParts && trailersWithPendingParts.includes(opt) ? '  • Pending Parts' : ''}
                      </option>
                    ))}
                  </select>
                );
              } else {
                return (
                  <input
                    type="text"
                    name="trailer"
                    placeholder="Trailer"
                    value={workOrder.trailer}
                    onChange={onChange}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                );
              }
            })()}
          </label>
          
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ width: '100%' }}>
            Descripción<span style={{ color: 'red' }}>*</span>
            <textarea
              name="description"
              placeholder="Descripción*"
              value={workOrder.description}
              onChange={onChange}
              rows={3}
              style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
            />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <strong>Partes</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {workOrder.parts.map((part: Part, index: number) => (
              <div key={index} style={{
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: 8,
                minWidth: 180,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column', // <-- Cambia a columna
                gap: 4
              }}>
                <label>
                  PRT
                  <input
                    type="text"
                    name="part"
                    autoComplete="off"
                    value={part.part}
                    onChange={e => handlePartChange(index, 'part', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                  {/* Sugerencias de autocompletado */}
                  {autocomplete[index] && autocomplete[index].length > 0 && (
                    <div style={{
                      position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #1976d2', borderRadius: 4, width: '100%', maxHeight: 120, overflowY: 'auto'
                    }}>
                      {autocomplete[index]
                        .map((item: any, i: number) => (
                          <div
                            key={item.sku}
                            style={{ padding: 6, cursor: 'pointer', color: '#1976d2' }}
                            onClick={() => handlePartChange(index, 'part', item.part)}
                          >
                            {item.sku} - {item.part}
                          </div>
                        ))}
                    </div>
                  )}
                </label>
                <label>
                  Qty
                  <input
                    type="number"
                    placeholder="Cantidad"
                    value={part.qty}
                    onChange={e => handlePartChange(index, 'qty', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
                <label>
                  Costo
                  <input
                    type="text"
                    placeholder="Costo"
                    value={part.cost}
                    onChange={e => onPartChange(index, 'cost', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...workOrder,
                  parts: [
                    ...workOrder.parts,
                    { part: '', sku: '', qty: '', cost: '' }
                  ]
                });
              }}
              style={{
                background: '#fff',
                color: '#1976d2',
                border: '1px solid #1976d2',
                padding: '6px 16px',
                borderRadius: 4,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              + Agregar otra parte
            </button>
          </div>
        </div>
        {pendingParts && pendingParts.length > 0 && (
          <div style={{ margin: '12px 0', background: '#fffbe6', border: '1px solid #ffd600', borderRadius: 6, padding: 12 }}>
            <strong>Pending Parts for this trailer:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {pendingParts &&
                pendingParts
                  .filter((part: any) => {
                    // Calcula cuántas ya se agregaron de esta parte
                    const addedQty = workOrder.parts
                      .filter((p: Part) => p.sku === part.sku)
                      .reduce((sum: number, p: Part) => sum + Number(p.qty), 0);
                    // Solo muestra si quedan por agregar
                    return Number(part.qty) - addedQty > 0;
                  })
                  .map((part: any, idx: number) => {
                    const addedQty = workOrder.parts
                      .filter((p: Part) => p.sku === part.sku)
                      .reduce((sum: number, p: Part) => sum + Number(p.qty), 0);
                    const remainingQty = Number(part.qty) - addedQty;
                    return (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid #1976d2',
                          borderRadius: 4,
                          padding: '6px 12px',
                          background: '#e3f2fd',
                          color: '#1976d2',
                          cursor: 'pointer'
                        }}
                        title={"Click para agregar a la WO"}
                        onClick={() => onAddPendingPart && onAddPendingPart(part, String(remainingQty))}
                      >
                        {part.sku} - {part.item} ({remainingQty} pcs)
                      </div>
                    );
                  })}
            </div>
            <div style={{ fontSize: 12, color: '#1976d2', marginTop: 4 }}>
              Click a part to add it to the WO parts list.
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
         <label style={{ flex: 1 }}>
             Status<span style={{ color: 'red' }}>*</span>
            <select
              name="status"
              value={workOrder.status}
              onChange={onChange}
              style={{ width: '100%', marginTop: 4 }}
              required
            >
              <option value="">Select...</option>
              <option value="PRE W.O">PRE W.O</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="FINISHED">FINISHED</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Extras:
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
              <label>
                <input
                  type="checkbox"
                  value="5"
                  checked={extraOptions.includes('5')}
                  onChange={e => {
                    setExtraOptions(prev =>
                      e.target.checked
                        ? [...prev, '5']
                        : prev.filter(opt => opt !== '5')
                    );
                  }}
                />
                +5% General
              </label>
              <label>
                <input
                  type="checkbox"
                  value="15shop"
                  checked={extraOptions.includes('15shop')}
                  onChange={e => {
                    setExtraOptions(prev =>
                      e.target.checked
                        ? [...prev, '15shop']
                        : prev.filter(opt => opt !== '15shop')
                    );
                  }}
                />
                +15% Shop Miscellaneous
              </label>
              <label>
                <input
                  type="checkbox"
                  value="15weld"
                  checked={extraOptions.includes('15weld')}
                  onChange={e => {
                    setExtraOptions(prev =>
                      e.target.checked
                        ? [...prev, '15weld']
                        : prev.filter(opt => opt !== '15weld')
                    );
                  }}
                />
                +15% Welding Supplies
              </label>
            </div>
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong>Mecánicos y horas<span style={{ color: 'red' }}>*</span></strong>
          {(Array.isArray(workOrder.mechanics) && workOrder.mechanics.length > 0
            ? workOrder.mechanics
            : [{ name: '', hrs: '' }]
          ).map((m: any, idx: number, arr: any[]) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <input
                type="text"
                value={m?.name || ''}
                onChange={e => {
                  const mechanics = Array.isArray(workOrder.mechanics) && workOrder.mechanics.length > 0
                    ? workOrder.mechanics.map((me: any) => ({ ...me }))
                    : [{ name: '', hrs: '' }];
                  mechanics[idx] = { ...mechanics[idx], name: e.target.value };
                  onChange({ ...workOrder, mechanics });
                }}
                placeholder="Nombre del mecánico"
                style={{ flex: 2 }}
              />
              <input
                type="number"
                value={m?.hrs || ''}
                onChange={e => {
                  const mechanics = Array.isArray(workOrder.mechanics) && workOrder.mechanics.length > 0
                    ? workOrder.mechanics.map((me: any) => ({ ...me }))
                    : [{ name: '', hrs: '' }];
                  mechanics[idx] = { ...mechanics[idx], hrs: e.target.value };
                  onChange({ ...workOrder, mechanics });
                }}
                placeholder="Horas"
                min={0}
                step="any"
                style={{ flex: 1 }}
              />
              {arr.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const mechanics = workOrder.mechanics.filter((_: any, i: number) => i !== idx);
                    onChange({ ...workOrder, mechanics });
                  }}
                  style={{
                    background: '#fff',
                    color: '#d32f2f',
                    border: '1px solid #d32f2f',
                    borderRadius: 4,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                  title="Eliminar mecánico"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const mechanics = Array.isArray(workOrder.mechanics) && workOrder.mechanics.length > 0
                ? [...workOrder.mechanics, { name: '', hrs: '' }]
                : [{ name: '', hrs: '' }, { name: '', hrs: '' }];
              onChange({ ...workOrder, mechanics });
            }}
            style={{
              background: '#fff',
              color: '#1976d2',
              border: '1px solid #1976d2',
              borderRadius: 4,
              padding: '4px 12px',
              marginTop: 4,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Agregar mecánico
          </button>
        </div>
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button type="submit" style={{ background: '#1976d2', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: 4 }}>Save</button>
          <button type="button" onClick={onCancel} style={{ background: '#fff', color: '#1976d2', border: '1px solid #1976d2', padding: '8px 20px', borderRadius: 4 }}>Cancel</button>
        </div>
      </form>
      <div style={{ marginTop: 16 }}>
          <label style={{ fontWeight: 700, color: '#1976d2' }}>
            Total LAB & PARTS:&nbsp;
            <input
              type="text"
              name="totalLabAndParts"
              value={
                manualTotalEdit
                  ? workOrder.totalLabAndParts
                  : totalLabAndParts.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
              }
              onChange={e => {
                setManualTotalEdit(true);
                onChange({ ...workOrder, totalLabAndParts: e.target.value });
              }}
              onBlur={() => {
                if (
                  workOrder.totalLabAndParts === '' ||
                  workOrder.totalLabAndParts === undefined ||
                  workOrder.totalLabAndParts === null
                ) {
                  setManualTotalEdit(false);
                }
              }}
              style={{ fontWeight: 700, color: '#1976d2', background: '#f5faff', border: 'none', fontSize: 18 }}
            />
          </label>
        </div>
        {workOrder.status === 'FINISHED' && (
          <div style={{ marginTop: 12 }}>
            <label>
              ID CLASSIC:
              <input
                type="text"
                name="idClassic"
                value={workOrder.idClassic || ''}
                onChange={e => onChange({ ...workOrder, idClassic: e.target.value })}
                placeholder="ID del otro sistema"
                style={{ marginLeft: 8 }}
              />
            </label>
          </div>
        )}
    </div>
  );
};

function calcularTotalWO(order: any) {
  if (
    order.totalLabAndParts !== undefined &&
    order.totalLabAndParts !== null &&
    order.totalLabAndParts !== '' &&
    !isNaN(Number(String(order.totalLabAndParts).replace(/[^0-9.]/g, '')))
  ) {
    return Number(String(order.totalLabAndParts).replace(/[^0-9.]/g, ''));
  }
  // Suma costo unitario * cantidad
  const partsTotal = order.parts?.reduce((sum: number, part: any) => {
    const cost = Number(part.cost?.toString().replace(/[^0-9.]/g, ''));
    return sum + (isNaN(cost) ? 0 : cost); // Solo suma el total de la línea
  }, 0) || 0;
  // Suma de horas de todos los mecánicos
  const laborHrs = Array.isArray(order.mechanics)
    ? order.mechanics.reduce((sum: number, m: any) => sum + (Number(m.hrs) || 0), 0)
    : 0;
  const laborTotal = laborHrs > 0 ? laborHrs * 60 : 0;
  const subtotal = partsTotal + laborTotal;
  let extra = 0;
  (order.extraOptions || []).forEach((opt: string) => {
    if (opt === '5') extra += subtotal * 0.05;
    if (opt === '15shop') extra += subtotal * 0.15;
    if (opt === '15weld') extra += subtotal * 0.15;
  });
  return subtotal + extra;
}

export default WorkOrderForm;