import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

function renderDetalles(detalles: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(detalles);
  } catch {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{detalles}</pre>;
  }

  if (parsed.antes && parsed.despues) {
    const keys = Array.from(new Set([...Object.keys(parsed.antes), ...Object.keys(parsed.despues)]));
    return (
      <table style={{
        fontSize: 13,
        borderCollapse: 'separate',
        borderSpacing: 0,
        minWidth: 280,
        background: '#f9fafc',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(25,118,210,0.07)'
      }}>
        <thead>
          <tr style={{ background: '#1976d2', color: '#fff' }}>
            <th style={{ padding: 6, borderRight: '1px solid #e3eaf2', borderTopLeftRadius: 8 }}>Campo</th>
            <th style={{ padding: 6, borderRight: '1px solid #e3eaf2' }}>Antes</th>
            <th style={{ padding: 6, borderTopRightRadius: 8 }}>Después</th>
          </tr>
        </thead>
        <tbody>
          {keys.map(key => {
            const antes = parsed.antes[key];
            const despues = parsed.despues[key];
            const changed =
              typeof antes === 'object' && typeof despues === 'object'
                ? JSON.stringify(antes) !== JSON.stringify(despues)
                : antes !== despues;
            return (
              <tr key={key} style={changed ? { background: '#fff8e1' } : {}}>
                <td style={{ borderRight: '1px solid #e3eaf2', padding: 5, fontWeight: changed ? 600 : 400 }}>{key}</td>
                <td style={{ borderRight: '1px solid #e3eaf2', padding: 5, color: changed ? '#d32f2f' : '#333' }}>
                  {typeof antes === 'object' && antes !== null
                    ? <pre style={{ margin: 0, fontSize: 12, background: '#f5f5f5', borderRadius: 4, padding: 4 }}>{JSON.stringify(antes, null, 2)}</pre>
                    : String(antes ?? '')}
                </td>
                <td style={{ padding: 5, color: changed ? '#388e3c' : '#333' }}>
                  {typeof despues === 'object' && despues !== null
                    ? <pre style={{ margin: 0, fontSize: 12, background: '#f5f5f5', borderRadius: 4, padding: 4 }}>{JSON.stringify(despues, null, 2)}</pre>
                    : String(despues ?? '')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // Si es creación o eliminación, muestra bonito
  return (
    <pre style={{
      whiteSpace: 'pre-wrap',
      fontSize: 13,
      background: '#f5faff',
      borderRadius: 8,
      padding: 10,
      color: '#333',
      border: '1px solid #e3eaf2'
    }}>
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
}

const AuditLogTable: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
  axios.get<any[]>(`${API_URL}/audit/audit-log`)
      .then(res => setLogs(res.data))
      .catch(() => setLogs([]));
  }, []);

  return (
    <div style={{ padding: 32, background: '#f5faff', borderRadius: 16, maxWidth: 1200, margin: '32px auto', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
      <h1 style={{ color: '#1976d2', fontFamily: 'Segoe UI, Arial, sans-serif', fontWeight: 800, fontSize: 28, marginBottom: 24 }}>Movimientos del Sistema</h1>
      <table style={{
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: 0,
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(25,118,210,0.07)'
      }}>
        <thead>
          <tr style={{ background: '#1976d2', color: '#fff' }}>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>ID</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>Usuario</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>Acción</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>Tabla</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>ID Registro</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>Fecha</th>
            <th style={{ padding: 10 }}>Detalles</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} style={{ borderBottom: '1px solid #e3eaf2', background: '#f9fafd' }}>
              <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{log.id}</td>
              <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{log.usuario}</td>
              <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e3eaf2', fontWeight: 600 }}>{log.accion}</td>
              <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{log.tabla}</td>
              <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{log.registro_id}</td>
              <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e3eaf2' }}>{new Date(log.fecha).toLocaleString()}</td>
              <td style={{ padding: 8 }}>{renderDetalles(log.detalles)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditLogTable;