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
      background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}
      onClick={onClose}
    >
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32, minWidth: 400, maxWidth: 520, maxHeight: '80vh',
        overflowY: 'auto', boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
      }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ color: '#1976d2', marginBottom: 16 }}>Hourmeter Report</h2>
        <div style={{ marginBottom: 16 }}>
          <label>
            Semana:&nbsp;
            <input
              type="week"
              value={week}
              onChange={e => setWeek(e.target.value)}
            />
          </label>
          <label style={{ marginLeft: 16 }}>
            Mecánico:&nbsp;
            <select
              value={mechanic}
              onChange={e => setMechanic(e.target.value)}
            >
              <option value="">Todos</option>
              {mechanics.map(mec =>
                <option key={mec} value={mec}>{mec}</option>
              )}
            </select>
          </label>
          <button
            className="wo-btn"
            style={{ marginLeft: 16 }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f5faff', borderRadius: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Mecánico</th>
                <th># W.O.</th>
                <th>Total Hrs</th>
                <th>Total LAB & PRTS</th>
                <th>Dead Hours</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mechanicStats).map(([mec, stats]) => (
                <tr key={mec}>
                  <td>{mec}</td>
                  <td>{stats.orders?.size || 0}</td>
                  <td>{Number(stats.totalHrs || 0).toFixed(2)}</td>
                  <td>{Number(stats.totalLabAndParts || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                  <td>{Number(stats.deadHours || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: 13, color: '#888' }}>
            {filtered.length === 0 && 'No hay datos para la selección.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HourmeterModal;