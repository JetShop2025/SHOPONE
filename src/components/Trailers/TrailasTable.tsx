import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const CLIENTES = [
  { nombre: "GALGRE", prefijo: "1-", inicio: 100, fin: 153 },
  { nombre: "JETGRE", prefijo: "2-", inicio: 1, fin: 16, pad: 3 },
  { nombre: "PRIGRE", prefijo: "3-", inicio: 300, fin: 323 },
  { nombre: "RAN100", prefijo: "4-", inicio: 400, fin: 419 },
  { nombre: "GABGRE", prefijo: "5-", inicio: 500, fin: 529 }
];

function getTrailerOptions(cliente: string): string[] {
  const c = CLIENTES.find(c => c.nombre === cliente);
  if (!c) return [];
  const pad = c.pad || 0;
  return Array.from({ length: c.fin - c.inicio + 1 }, (_, i) =>
    c.prefijo + (pad ? String(c.inicio + i).padStart(pad, '0') : (c.inicio + i))
  );
}

const TrailasTable: React.FC = () => {
  const [cliente, setCliente] = useState('');
  const [trailer, setTrailer] = useState('');
  const [estatus, setEstatus] = useState<string | null>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [trailas, setTrailas] = useState<any[]>([]);

  // Carga todos los trailers para saber su estatus
  useEffect(() => {
    axios.get<any[]>(`${API_URL}/trailas`)
      .then(res => setTrailas(res.data))
      .catch(() => setTrailas([]));
  }, []);

  // Cuando seleccionas trailer, busca estatus y work orders
  useEffect(() => {
    if (trailer) {
      // Busca estatus
      const t = trailas.find((t: any) => t.nombre === trailer);
      setEstatus(t ? t.estatus : 'No registrado');
      // Busca work orders
      axios.get<any[]>(`${API_URL}/work-orders`)
        .then(res => {
          const filtered = res.data.filter((wo: any) => wo.trailer === trailer);
          setWorkOrders(filtered);
        })
        .catch(() => setWorkOrders([]));
    } else {
      setEstatus(null);
      setWorkOrders([]);
    }
  }, [trailer, trailas]);

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', background: '#f5faff', borderRadius: 16, padding: 32 }}>
      <h1 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 24 }}>Control de Trailas</h1>
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div>
          <label style={{ fontWeight: 700, color: '#1976d2' }}>Cliente:</label>
          <select
            value={cliente}
            onChange={e => { setCliente(e.target.value); setTrailer(''); }}
            style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #1976d2' }}
          >
            <option value="">Selecciona...</option>
            {CLIENTES.map(c => (
              <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontWeight: 700, color: '#1976d2' }}>Traila:</label>
          <select
            value={trailer}
            onChange={e => setTrailer(e.target.value)}
            style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #1976d2' }}
            disabled={!cliente}
          >
            <option value="">Selecciona...</option>
            {getTrailerOptions(cliente).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>
      {trailer && (
        <div style={{ marginBottom: 24 }}>
          <strong>Estatus:</strong>{' '}
          <span style={{
            color: estatus === 'RENTADA' ? '#d32f2f' : '#388e3c',
            fontWeight: 700
          }}>
            {estatus || 'No registrado'}
          </span>
          <button
            style={{
              marginLeft: 16,
              background: estatus === 'RENTADA' ? '#388e3c' : '#d32f2f',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 18px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={async () => {
              const nuevo = estatus === 'RENTADA' ? 'DISPONIBLE' : 'RENTADA';
              await axios.put(`${API_URL}/trailas/${trailer}/estatus`, { estatus: nuevo });
              setEstatus(nuevo);
              // Opcional: actualiza la lista de trailas
              setTrailas(trailas.map(t => t.nombre === trailer ? { ...t, estatus: nuevo } : t));
            }}
          >
            Marcar como {estatus === 'RENTADA' ? 'DISPONIBLE' : 'RENTADA'}
          </button>
        </div>
      )}
      {trailer && (
        <div>
          <h2 style={{ color: '#1976d2', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>
            Historial de Work Orders para {trailer}
          </h2>
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