import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const TrailasTable: React.FC = () => {
  const [trailas, setTrailas] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  useEffect(() => {
    axios.get<any[]>(`${API_URL}/trailas`)
      .then(res => setTrailas(res.data))
      .catch(() => setTrailas([]));
  }, []);

  useEffect(() => {
    if (selected) {
      axios.get<any[]>(`${API_URL}/work-orders`)
        .then(res => {
          const filtered = res.data.filter((wo: any) => wo.trailer === selected.nombre);
          setWorkOrders(filtered);
        })
        .catch(() => setWorkOrders([]));
    } else {
      setWorkOrders([]);
    }
  }, [selected]);

  return (
    <div style={{ maxWidth: 1000, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>Control de Trailas</h1>
      <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
        <thead>
          <tr style={{ background: '#1976d2', color: '#fff' }}>
            <th>Nombre</th>
            <th>Estatus</th>
            <th>Ver Historial</th>
          </tr>
        </thead>
        <tbody>
          {trailas.map(traila => (
            <tr key={traila.nombre}>
              <td>{traila.nombre}</td>
              <td style={{ color: traila.estatus === 'RENTADA' ? '#d32f2f' : '#388e3c', fontWeight: 700 }}>
                {traila.estatus}
              </td>
              <td>
                <button
                  style={{
                    background: '#1976d2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 18px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelected(traila)}
                >
                  Ver Work Orders
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ color: '#1976d2', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>
            Historial de Work Orders para {selected.nombre}
          </h2>
          <button onClick={() => setSelected(null)} style={{ marginBottom: 16, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>← Volver a la lista</button>
          {workOrders.length === 0 ? (
            <div style={{ color: '#888', fontStyle: 'italic' }}>No hay work orders para esta traila.</div>
          ) : (
            <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
              <thead>
                <tr style={{ background: '#1976d2', color: '#fff' }}>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Estatus</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id}>
                    <td>{wo.id}</td>
                    <td>{wo.date ? wo.date.slice(0, 10) : ''}</td>
                    <td>{wo.status}</td>
                    <td>
                      <a
                        href={`${API_URL}/pdfs/${wo.date ? wo.date.slice(5, 7) + '-' + wo.date.slice(8, 10) + '-' + wo.date.slice(0, 4) : ''}_${wo.id}.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#1976d2', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        Ver PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default TrailasTable;