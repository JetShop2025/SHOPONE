import React, { useState } from 'react';
import dayjs from 'dayjs';

function getWeekRange(weekStr: string) {
  const [year, week] = weekStr.split('-W');
  const start = dayjs().year(Number(year)).week(Number(week)).startOf('week');
  const end = dayjs().year(Number(year)).week(Number(week)).endOf('week');
  return { start, end };
}

const HourmeterModal: React.FC<{
  show: boolean;
  onClose: () => void;
  workOrders: any[];
  mechanics: string[];
  selectedWeek: string;
}> = ({ show, onClose, workOrders, mechanics, selectedWeek }) => {
  const [week, setWeek] = useState(selectedWeek);
  const [mechanic, setMechanic] = useState('');

  const { start, end } = getWeekRange(week);
  const filtered = workOrders.filter(order => {
    if (!order.date) return false;
    const orderDate = dayjs(order.date.slice(0, 10));
    const inWeek = orderDate.isBetween(start, end, 'day', '[]');
    const matchesMechanic = !mechanic || order.mechanic === mechanic;
    return inWeek && matchesMechanic;
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

  // 2. Recorre las órdenes filtradas
  filtered.forEach(order => {
    const orderId = order.id ? String(order.id) : JSON.stringify(order);

    if (Array.isArray(order.mechanics) && order.mechanics.length > 0) {
      const numMech = order.mechanics.length;
      order.mechanics.forEach((m: { name: string, hrs: number, deadHrs?: number }) => {
        const mechanicName = (m.name || '').trim().toUpperCase();
        if (!mechanicStats[mechanicName]) {
          mechanicStats[mechanicName] = { totalHrs: 0, workOrders: 0, totalLabAndParts: 0, deadHours: 0, orders: new Set() };
        }
        mechanicStats[mechanicName].totalHrs += Number(m.hrs) || 0;
        mechanicStats[mechanicName].totalLabAndParts += (Number(order.totalLabAndParts) || 0) / numMech;
        // Dead hours: solo suma si es un número finito y mayor o igual a 0
        if (typeof m.deadHrs === 'number' && isFinite(m.deadHrs) && m.deadHrs >= 0 && m.deadHrs < 1000) {
          mechanicStats[mechanicName].deadHours += m.deadHrs;
        } else if ((Number(order.totalLabAndParts) || 0) === 0 && (m.hrs || 0) > 0) {
          mechanicStats[mechanicName].deadHours += Number(m.hrs) || 0;
        }
        if (!mechanicStats[mechanicName].orders.has(orderId)) {
          mechanicStats[mechanicName].orders.add(orderId);
          mechanicStats[mechanicName].workOrders += 1;
        }
      });
    } else {
      let mechanics: string[] = [];
      if (Array.isArray(order.mechanic)) {
        mechanics = order.mechanic;
      } else if (typeof order.mechanic === 'string') {
        mechanics = order.mechanic.split(',').map((m: string) => m.trim()).filter(Boolean);
      }
      const hrs = parseFloat(order.totalHrs) || 0;
      const labAndParts = Number(order.totalLabAndParts) || 0;
      const numMech = mechanics.length || 1;
      mechanics.forEach((mec: string) => {
        const mechanicName = (mec || '').trim().toUpperCase();
        if (!mechanicStats[mechanicName]) {
          mechanicStats[mechanicName] = { totalHrs: 0, workOrders: 0, totalLabAndParts: 0, deadHours: 0, orders: new Set() };
        }
        mechanicStats[mechanicName].totalHrs += hrs;
        mechanicStats[mechanicName].totalLabAndParts += labAndParts / numMech;
        // Dead hours: solo suma si es un número finito y razonable
        if (labAndParts === 0 && hrs > 0 && hrs < 1000) mechanicStats[mechanicName].deadHours += hrs;
        if (!mechanicStats[mechanicName].orders.has(orderId)) {
          mechanicStats[mechanicName].orders.add(orderId);
          mechanicStats[mechanicName].workOrders += 1;
        }
      });
    }
  });

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
          }}>📊 Hourmeter Report</h2>
          <p style={{
            color: '#666',
            fontSize: 14,
            margin: 0,
            fontStyle: 'italic'
          }}>Reporte detallado de horas por mecánico</p>
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
              }}
            >
              <option value="">Todos</option>
              {mechanics.map(mec =>
                <option key={mec} value={mec}>{mec}</option>
              )}
            </select>
          </div>
          
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
                  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
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