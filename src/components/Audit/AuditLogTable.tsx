import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com';

function renderDetalles(detalles: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(detalles);
  } catch {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{detalles}</pre>;
  }

  // Si el formato es { campo: { antes, despues }, ... }
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Object.values(parsed).every(
      (v: any) => v && typeof v === 'object' && 'antes' in v && 'despues' in v
    )
  ) {
    const keys = Object.keys(parsed);
    return (
      <table style={{
        fontSize: 14,
        borderCollapse: 'collapse',
        minWidth: 260,
        background: '#f9fafc',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(25,118,210,0.07)',
        margin: 0
      }}>
        <thead>
          <tr style={{ background: '#1976d2', color: '#fff' }}>
            <th style={{ padding: 7, borderRight: '1px solid #e3eaf2', borderTopLeftRadius: 8 }}>FIELD</th>
            <th style={{ padding: 7, borderRight: '1px solid #e3eaf2' }}>BEFORE</th>
            <th style={{ padding: 7, borderTopRightRadius: 8 }}>AFTER</th>
          </tr>
        </thead>
        <tbody>
          {keys.map(key => {
            const { antes, despues } = parsed[key];
            const changed = antes !== despues;
            return (
              <tr key={key}>
                <td style={{ borderRight: '1px solid #e3eaf2', padding: 6, fontWeight: 600 }}>{key}</td>
                <td style={{ borderRight: '1px solid #e3eaf2', padding: 6, color: '#d32f2f', background: changed ? '#fff8e1' : undefined }}>
                  {String(antes ?? '')}
                </td>
                <td style={{ padding: 6, color: changed ? '#388e3c' : '#333', fontWeight: changed ? 700 : 400, background: changed ? '#e8f5e9' : undefined }}>
                  {String(despues ?? '')}
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
    let isMounted = true;
    const fetchData = () => {
      axios.get<any[]>(`${API_URL}/audit/audit-log`)
        .then(res => { if (isMounted) setLogs(res.data); })
        .catch(() => { if (isMounted) setLogs([]); });
    };
    fetchData();
    const interval = setInterval(fetchData, 4000); // cada 4 segundos
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  return (
    <div style={{ padding: 32, background: '#f5faff', borderRadius: 16, maxWidth: 1200, margin: '32px auto', boxShadow: '0 2px 12px rgba(25,118,210,0.07)' }}>
      <h1 style={{ color: '#1976d2', fontFamily: 'Segoe UI, Arial, sans-serif', fontWeight: 800, fontSize: 28, marginBottom: 24 }}>SYSTEM MOVEMENTS</h1>
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
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>USER</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>ACTION</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>TABLE</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>RECORD ID</th>
            <th style={{ padding: 10, borderRight: '1px solid #e3eaf2' }}>DATE</th>
            <th style={{ padding: 10 }}>DETAILS</th>
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