import React, { useState } from 'react';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function getWeekRange(weekStr: string) {
  const [year, week] = weekStr.split('-W');
  const start = dayjs().year(Number(year)).week(Number(week)).startOf('week');
  const end = dayjs().year(Number(year)).week(Number(week)).endOf('week');
  return { start, end };
}

type PDFWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

type MechanicEntry = {
  name: string;
  hrs: number;
  deadHrs: number;
};

type DetailedRow = {
  mechanicName: string;
  orderId: string;
  date: string;
  billToCo: string;
  trailer: string;
  status: string;
  totalHrs: number;
  deadHrs: number;
  labAmount: number;
  partsAmount: number;
  totalCombined: number;
};

const toNumber = (value: any): number => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMechanic = (value: any): string => String(value || '').trim().toUpperCase();

const parseMechanicEntries = (order: any): MechanicEntry[] => {
  if (Array.isArray(order?.mechanics) && order.mechanics.length > 0) {
    const entries = order.mechanics
      .map((m: any) => ({
        name: normalizeMechanic(m?.name),
        hrs: Math.max(0, toNumber(m?.hrs)),
        deadHrs: Math.max(0, toNumber(m?.deadHrs)),
      }))
      .filter((m: MechanicEntry) => m.name);
    if (entries.length > 0) return entries;
  }

  const raw = order?.mechanic;
  const names = Array.isArray(raw)
    ? raw.map((m: any) => normalizeMechanic(m)).filter(Boolean)
    : String(raw || '')
        .split(',')
        .map((m: string) => normalizeMechanic(m))
        .filter(Boolean);

  if (names.length === 0) return [];

  const totalHrs = Math.max(0, toNumber(order?.totalHrs));
  const sharedHrs = names.length > 0 ? totalHrs / names.length : 0;

  return names.map((name: string) => ({ name, hrs: sharedHrs, deadHrs: 0 }));
};

const getPartsTotalFromOrder = (order: any): number => {
  let partsArray: any[] = [];
  if (Array.isArray(order?.parts)) {
    partsArray = order.parts;
  } else if (typeof order?.parts === 'string') {
    try {
      const parsed = JSON.parse(order.parts);
      if (Array.isArray(parsed)) partsArray = parsed;
    } catch {
      partsArray = [];
    }
  }

  const explicitPartsTotal = partsArray.reduce((sum: number, part: any) => {
    const qty = Math.max(0, toNumber(part?.qty));
    const unitCost = Math.max(0, toNumber(part?.cost));
    return sum + qty * unitCost;
  }, 0);

  if (explicitPartsTotal > 0) return explicitPartsTotal;

  const orderTotal = Math.max(0, toNumber(order?.totalLabAndParts));
  const laborTotal = Math.max(0, toNumber(order?.totalHrs)) * 60;
  return Math.max(0, orderTotal - laborTotal);
};

const HourmeterModal: React.FC<{
  show: boolean;
  onClose: () => void;
  workOrders: any[];
  mechanics: string[];
  selectedWeek: string;
}> = ({ show, onClose, workOrders, mechanics, selectedWeek }) => {
  const [week, setWeek] = useState(selectedWeek);
  const [mechanic, setMechanic] = useState('');
  const [selectedDate, setSelectedDate] = useState(''); // Nuevo filtro por día
  const { start, end } = getWeekRange(week);
  const selectedMechanicNormalized = normalizeMechanic(mechanic);

  const filtered = workOrders.filter(order => {
    if (!order.date) return false;
    const orderDate = dayjs(order.date.slice(0, 10));
    
    // Filtro por semana
    const inWeek = orderDate.isBetween(start, end, 'day', '[]');
    
    // Filtro por día específico (si se selecciona)
    const matchesDate = !selectedDate || orderDate.format('YYYY-MM-DD') === selectedDate;

    // Filtro por mecánico (soporta mechanics[] y mechanic string)
    const entries = parseMechanicEntries(order);
    const matchesMechanic =
      !selectedMechanicNormalized ||
      entries.some((entry: MechanicEntry) => entry.name === selectedMechanicNormalized);
    
    return inWeek && matchesDate && matchesMechanic;
  });

  const detailedRows: DetailedRow[] = [];
  filtered.forEach(order => {
    const orderId = order.id ? String(order.id) : 'N/A';
    const dateValue = order.date ? String(order.date).slice(0, 10) : '';
    const entries = parseMechanicEntries(order).filter((entry: MechanicEntry) => {
      if (!selectedMechanicNormalized) return true;
      return entry.name === selectedMechanicNormalized;
    });

    if (entries.length === 0) return;

    const totalOrderHrs = entries.reduce((sum: number, entry: MechanicEntry) => sum + entry.hrs, 0);
    const orderPartsTotal = getPartsTotalFromOrder(order);
    const orderTotal = Math.max(0, toNumber(order?.totalLabAndParts));

    entries.forEach((entry: MechanicEntry) => {
      const ratio = totalOrderHrs > 0 ? entry.hrs / totalOrderHrs : 1 / entries.length;
      const labAmount = entry.hrs * 60;
      const partsAmount = orderPartsTotal * ratio;
      const deadHrs = entry.deadHrs > 0 ? entry.deadHrs : (orderTotal === 0 && entry.hrs > 0 ? entry.hrs : 0);

      detailedRows.push({
        mechanicName: entry.name,
        orderId,
        date: dateValue,
        billToCo: String(order.billToCo || ''),
        trailer: String(order.trailer || ''),
        status: String(order.status || ''),
        totalHrs: entry.hrs,
        deadHrs,
        labAmount,
        partsAmount,
        totalCombined: labAmount + partsAmount,
      });
    });
  });

  detailedRows.sort((a, b) => {
    const mechanicDiff = a.mechanicName.localeCompare(b.mechanicName, 'es', { sensitivity: 'base' });
    if (mechanicDiff !== 0) return mechanicDiff;
    return Number(a.orderId) - Number(b.orderId);
  });

  // 1. Construye un objeto para acumular por mecánico
  const mechanicStats: {
    [mechanic: string]: {
      totalHrs: number,
      workOrders: number,
      totalLabAndParts: number,
      deadHours: number,
      orders: Set<string>
    }
  } = {};

  // 2. Recorre los renglones detallados y acumula por mecánico
  detailedRows.forEach((row) => {
    if (!mechanicStats[row.mechanicName]) {
      mechanicStats[row.mechanicName] = { totalHrs: 0, workOrders: 0, totalLabAndParts: 0, deadHours: 0, orders: new Set() };
    }

    mechanicStats[row.mechanicName].totalHrs += row.totalHrs;
    mechanicStats[row.mechanicName].totalLabAndParts += row.totalCombined;
    mechanicStats[row.mechanicName].deadHours += row.deadHrs;

    if (!mechanicStats[row.mechanicName].orders.has(row.orderId)) {
      mechanicStats[row.mechanicName].orders.add(row.orderId);
      mechanicStats[row.mechanicName].workOrders += 1;
    }
  });

  const exportDetailedPdf = () => {
    if (detailedRows.length === 0) {
      window.alert('No hay datos para exportar con los filtros seleccionados.');
      return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfDoc = pdf as PDFWithAutoTable;

    const title = 'Hourmeter Detailed Work Order Report';
    const filterWeekText = `Semana: ${week || 'N/A'}`;
    const filterMechanicText = `Mecánico: ${mechanic || 'Todos'}`;
    const filterDateText = `Día: ${selectedDate || 'Todos'}`;

    pdf.setFontSize(16);
    pdf.setTextColor(10, 56, 84);
    pdf.text(title, 14, 16);

    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.text(filterWeekText, 14, 23);
    pdf.text(filterMechanicText, 14, 28);
    pdf.text(filterDateText, 14, 33);

    const summaryRows = Object.entries(mechanicStats)
      .sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }))
      .map(([mec, stats]) => [
        mec,
        String(stats.workOrders),
        Number(stats.totalHrs).toFixed(2),
        Number(stats.deadHours).toFixed(2),
        Number(stats.totalLabAndParts).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      ]);

    autoTable(pdf, {
      startY: 38,
      head: [['MECÁNICO', '# W.O', 'TOTAL HRS', 'DEAD HRS', 'TOTAL LAB + PARTS']],
      body: summaryRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 56, 84], textColor: 255 },
    });

    const detailsStartY = (pdfDoc.lastAutoTable?.finalY || 45) + 8;
    autoTable(pdf, {
      startY: detailsStartY,
      head: [[
        'MECÁNICO',
        '# W.O',
        'FECHA',
        'COMPAÑÍA',
        'TRAILER',
        'STATUS',
        'HRS',
        'DEAD HRS',
        '$ LAB',
        '$ PARTS',
        'TOTAL'
      ]],
      body: detailedRows.map((row) => [
        row.mechanicName,
        row.orderId,
        row.date || 'N/A',
        row.billToCo || 'N/A',
        row.trailer || 'N/A',
        row.status || 'N/A',
        row.totalHrs.toFixed(2),
        row.deadHrs.toFixed(2),
        row.labAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        row.partsAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        row.totalCombined.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      ]),
      styles: { fontSize: 7, cellPadding: 1.8 },
      headStyles: { fillColor: [25, 118, 210], textColor: 255 },
      alternateRowStyles: { fillColor: [247, 250, 255] },
    });

    const fileSuffix = selectedDate || week || dayjs().format('YYYY-MM-DD');
    pdf.save(`hourmeter_detailed_${fileSuffix}.pdf`);
  };

  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}
      onClick={onClose}
    >
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fffe 100%)', 
        borderRadius: 20, 
        padding: 40, 
        minWidth: 600, 
        maxWidth: 800, 
        maxHeight: '85vh',
        overflowY: 'auto', 
        boxShadow: '0 20px 60px rgba(25,118,210,0.15), 0 8px 32px rgba(0,0,0,0.1)',
        border: '1px solid rgba(25,118,210,0.1)'
      }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ 
          textAlign: 'center', 
          marginBottom: 32,
          borderBottom: '2px solid #e3f2fd',
          paddingBottom: 20
        }}>
          <h2 style={{ 
            color: '#1976d2', 
            marginBottom: 8,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.5px'
          }}>📊 Hourmeter Report</h2>          <p style={{
            color: '#666',
            fontSize: 14,
            margin: 0,
            fontStyle: 'italic'
          }}>
            Reporte detallado de horas por mecánico
            {selectedDate && ` - Día: ${dayjs(selectedDate).format('DD/MM/YYYY')}`}
          </p>
        </div>

        <div style={{ 
          marginBottom: 28,
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '20px',
          background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 100%)',
          borderRadius: 12,
          border: '1px solid #e1f5fe'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ 
              fontWeight: 600, 
              color: '#1976d2',
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              📅 Semana:
            </label>
            <input
              type="week"
              value={week}
              onChange={e => setWeek(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '2px solid #e3f2fd',
                fontSize: 14,
                fontWeight: 500,
                outline: 'none',
                transition: 'all 0.2s ease',
                background: '#fff'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ 
              fontWeight: 600, 
              color: '#1976d2',
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              👨‍🔧 Mecánico:
            </label>
            <select
              value={mechanic}
              onChange={e => setMechanic(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '2px solid #e3f2fd',
                fontSize: 14,
                fontWeight: 500,
                outline: 'none',
                transition: 'all 0.2s ease',
                background: '#fff',
                minWidth: 150
              }}            >
              <option value="">Todos</option>
              {mechanics.map(mec =>
                <option key={mec} value={mec}>{mec}</option>
              )}
            </select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ 
              fontWeight: 600, 
              color: '#1976d2',
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              📅 Día específico:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '2px solid #e3f2fd',
                fontSize: 14,
                fontWeight: 500,
                outline: 'none',
                transition: 'all 0.2s ease',
                background: '#fff',
                minWidth: 150
              }}
              title="Opcional: Filtra por un día específico dentro de la semana"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  background: '#f44336',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
                title="Limpiar filtro de día"
              >
                ✕ Limpiar
              </button>
            )}
          </div>
          
          <button
            onClick={exportDetailedPdf}
            style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 12px rgba(46,125,50,0.25)',
              marginTop: 'auto'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(46,125,50,0.35)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(46,125,50,0.25)';
            }}
          >
            📄 Export PDF
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 12px rgba(25,118,210,0.2)',
              marginTop: 'auto'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(25,118,210,0.3)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(25,118,210,0.2)';
            }}
          >
            ✕ Cerrar
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(25,118,210,0.08)',
            border: '1px solid #e3f2fd'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ 
                  background: 'linear-gradient(135deg, #0A3854 0%, #062838 100%)',
                  color: '#fff'
                }}>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '18px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>👨‍🔧 Mecánico</th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '18px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>📋 # W.O.</th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '18px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>⏰ Total Hrs</th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '18px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>💰 Total LAB & PRTS</th>
                  <th style={{ 
                    textAlign: 'center', 
                    padding: '18px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>🔴 Dead Hours</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mechanicStats).map(([mec, stats], index) => (
                  <tr key={mec} style={{
                    background: index % 2 === 0 ? '#fafbff' : '#fff',
                    borderBottom: '1px solid #f0f4f8',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = '#e3f2fd';
                    e.currentTarget.style.transform = 'scale(1.01)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = index % 2 === 0 ? '#fafbff' : '#fff';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}>
                    <td style={{ 
                      padding: '16px 20px',
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#1976d2'
                    }}>{mec}</td>
                    <td style={{ 
                      textAlign: 'center',
                      padding: '16px 12px',
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#2e7d32'
                    }}>{stats.orders?.size || 0}</td>
                    <td style={{ 
                      textAlign: 'center',
                      padding: '16px 12px',
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#f57c00'
                    }}>{Number(stats.totalHrs || 0).toFixed(2)}</td>
                    <td style={{ 
                      textAlign: 'center',
                      padding: '16px 12px',
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#388e3c'
                    }}>{Number(stats.totalLabAndParts || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                    <td style={{ 
                      textAlign: 'center',
                      padding: '16px 12px',
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#d32f2f'
                    }}>{Number(stats.deadHours || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filtered.length === 0 && (
            <div style={{ 
              marginTop: 24, 
              textAlign: 'center',
              padding: '24px',
              background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
              borderRadius: 12,
              border: '1px solid #ffcc02',
              color: '#e65100',
              fontSize: 16,
              fontWeight: 600
            }}>
              📊 No hay datos para la selección actual
            </div>
          )}
          
          {Object.keys(mechanicStats).length > 0 && (
            <div style={{
              marginTop: 20,
              padding: '16px',
              background: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
              borderRadius: 12,
              border: '1px solid #4caf50',
              textAlign: 'center'
            }}>
              <span style={{
                color: '#2e7d32',
                fontSize: 14,
                fontWeight: 600
              }}>
                ✅ Mostrando datos de {Object.keys(mechanicStats).length} mecánico(s) | {filtered.length} órdenes encontradas
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HourmeterModal;