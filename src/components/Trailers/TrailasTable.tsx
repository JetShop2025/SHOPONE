import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const TrailasTable: React.FC = () => {
  const [trailas, setTrailas] = useState<any[]>([]);

  useEffect(() => {
    axios.get<any[]>(`${API_URL}/trailas`)
      .then(res => setTrailas(res.data))
      .catch(() => setTrailas([]));
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>Control de Trailas</h1>
      <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
        <thead>
          <tr style={{ background: '#1976d2', color: '#fff' }}>
            <th>Nombre</th>
            <th>Estatus</th>
            <th>Work Orders</th>
          </tr>
        </thead>
        <tbody>
          {trailas.map(traila => (
            <tr key={traila.id}>
              <td>{traila.nombre}</td>
              <td>{traila.estatus}</td>
              <td>
                <WorkOrderCount nombre={traila.nombre} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const WorkOrderCount: React.FC<{ nombre: string }> = ({ nombre }) => {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    axios.get<{ total: number }>(`${API_URL}/trailas/${nombre}/work-orders`)
      .then(res => setCount(res.data.total))
      .catch(() => setCount(0));
  }, [nombre]);
  return <span>{count}</span>;
};

export default TrailasTable;