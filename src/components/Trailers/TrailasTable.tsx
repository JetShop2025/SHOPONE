import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const modalStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};
const modalContentStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: 32,
  minWidth: 500,
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
};

const TrailasTable: React.FC = () => {
  const [trailas, setTrailas] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    axios.get<any[]>(`${API_URL}/trailas`)
      .then(res => setTrailas(res.data))
      .catch(() => setTrailas([]));
  }, []);

  useEffect(() => {
    if (selected && showModal) {
      axios.get<any[]>(`${API_URL}/work-orders`)
        .then(res => {
          const filtered = res.data
            .filter((wo: any) => wo.trailer === selected.nombre)
            .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
          setWorkOrders(filtered);
        })
        .catch(() => setWorkOrders([]));
    } else {
      setWorkOrders([]);
    }
  }, [selected, showModal]);

  // Cambiar estatus con password
  const handleChangeStatus = async (traila: any) => {
    const nuevo = traila.estatus === 'RENTADA' ? 'DISPONIBLE' : 'RENTADA';
    const password = prompt('Ingresa el password para cambiar el estatus:');
    if (!password) return;
    try {
      await axios.put(`${API_URL}/trailas/${traila.nombre}/estatus`, { estatus: nuevo, password });
      setTrailas(trailas.map(t => t.nombre === traila.nombre ? { ...t, estatus: nuevo } : t));
      if (selected && selected.nombre === traila.nombre) setSelected({ ...traila, estatus: nuevo });
      alert('Estatus actualizado');
    } catch (err: any) {
      alert(err.response?.data || 'Error al actualizar estatus');
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>Control de Trailas</h1>
      <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
        <thead>
          <tr style={{ background: '#1976d2', color: '#fff' }}>
            <th>Nombre</th>
            <th>Estatus</th>
            <th>Cambiar Estatus</th>
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
                    background: traila.estatus === 'RENTADA' ? '#388e3c' : '#d32f2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 18px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => handleChangeStatus(traila)}
                >
                  Marcar como {traila.estatus === 'RENTADA' ? 'DISPONIBLE' : 'RENTADA'}
                </button>
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
                  onClick={() => { setSelected(traila); setShowModal(true); }}
                >
                  Ver Work Orders
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && selected && (
        <div style={modalStyle} onClick={() => setShowModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#1976d2', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>
              Historial de Work Orders para {selected.nombre}
            </h2>
            <button onClick={() => setShowModal(false)} style={{ marginBottom: 16, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, float: 'right' }}>✕ Cerrar</button>
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
        </div>
      )}
    </div>
  );
};

export default TrailasTable;