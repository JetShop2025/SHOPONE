import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

// Función para renderizar detalles de auditoría de forma profesional
function renderDetalles(detalles: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(detalles);
  } catch {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{detalles}</pre>;
  }

  // Si tiene summary, mostrarlo primero
  if (parsed.summary) {
    return (
      <div style={{ fontSize: 13 }}>
        <div style={{ 
          fontWeight: 600, 
          color: '#1976d2', 
          marginBottom: 8,
          padding: '4px 8px',
          background: '#e3f2fd',
          borderRadius: 4,
          border: '1px solid #1976d2'
        }}>
          📋 {parsed.summary}
        </div>
        {parsed.changes && renderChangesTable(parsed.changes)}
        {parsed.data && renderDataTable(parsed.data)}
      </div>
    );
  }

  // Si es un objeto con changes, mostrar tabla de cambios
  if (parsed.changes) {
    return renderChangesTable(parsed.changes);
  }

  // Si es un objeto, mostrar tabla general
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return renderDataTable(parsed);
  }

  // Si no es objeto, mostrar como texto plano
  return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{detalles}</pre>;
}

// Función para renderizar tabla de cambios (antes/después)
function renderChangesTable(changes: any) {
  const keys = Object.keys(changes);
  if (keys.length === 0) return null;

  return (
    <table style={{
      fontSize: 12,
      borderCollapse: 'collapse',
      width: '100%',
      background: '#fafafa',
      borderRadius: 6,
      overflow: 'hidden',
      border: '1px solid #e0e0e0',
      marginTop: 8
    }}>
      <thead>
        <tr style={{ background: '#f44336', color: '#fff' }}>
          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>CAMPO</th>
          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>ANTES</th>
          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>DESPUÉS</th>
        </tr>
      </thead>
      <tbody>
        {keys.map(key => {
          const change = changes[key];
          return (
            <tr key={key} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={{ 
                padding: '6px 8px', 
                fontWeight: 600, 
                background: '#f5f5f5',
                borderRight: '1px solid #e0e0e0'
              }}>
                {key}
              </td>
              <td style={{ 
                padding: '6px 8px', 
                color: '#d32f2f',
                borderRight: '1px solid #e0e0e0'
              }}>
                {String(change.antes ?? '')}
              </td>
              <td style={{ 
                padding: '6px 8px', 
                color: '#388e3c'
              }}>
                {String(change.despues ?? '')}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Función para renderizar tabla de datos general
function renderDataTable(data: any) {
  const keys = Object.keys(data).filter(key => key !== 'summary' && key !== 'changes');
  if (keys.length === 0) return null;

  return (
    <table style={{
      fontSize: 12,
      borderCollapse: 'collapse',
      width: '100%',
      background: '#fafafa',
      borderRadius: 6,
      overflow: 'hidden',
      border: '1px solid #e0e0e0',
      marginTop: 8
    }}>
      <thead>
        <tr style={{ background: '#2196f3', color: '#fff' }}>
          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>CAMPO</th>
          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>VALOR</th>
        </tr>
      </thead>
      <tbody>
        {keys.map(key => (
          <tr key={key} style={{ borderBottom: '1px solid #e0e0e0' }}>
            <td style={{ 
              padding: '6px 8px', 
              fontWeight: 600, 
              background: '#f5f5f5',
              borderRight: '1px solid #e0e0e0'
            }}>
              {key}
            </td>
            <td style={{ padding: '6px 8px' }}>
              {typeof data[key] === 'object' ? JSON.stringify(data[key]) : String(data[key] ?? '')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Función para obtener el ícono según la acción
function getActionIcon(action: string) {
  switch (action.toLowerCase()) {
    case 'create': return '✅';
    case 'update': return '✏️';
    case 'delete': return '❌';
    case 'deduct': return '📉';
    case 'rent': return '🏠';
    case 'return': return '↩️';
    default: return '📝';
  }
}

// Función para obtener el color según la acción
function getActionColor(action: string) {
  switch (action.toLowerCase()) {
    case 'create': return '#4caf50';
    case 'update': return '#ff9800';
    case 'delete': return '#f44336';
    case 'deduct': return '#9c27b0';
    case 'rent': return '#2196f3';
    case 'return': return '#607d8b';
    default: return '#757575';
  }
}

const AuditLogTable: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    usuario: '',
    accion: '',
    tabla: ''
  });

  useEffect(() => {
    let isMounted = true;
    const fetchData = () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.usuario) params.append('usuario', filters.usuario);
      if (filters.accion) params.append('accion', filters.accion);
      if (filters.tabla) params.append('tabla', filters.tabla);
      
      axios.get<any[]>(`${API_URL}/audit/audit-log?${params.toString()}`)
        .then(res => { 
          if (isMounted) {
            setLogs(res.data || []);
            setLoading(false);
          }
        })
        .catch(() => { 
          if (isMounted) {
            setLogs([]);
            setLoading(false);
          }
        });
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000); // cada 10 segundos
    return () => { isMounted = false; clearInterval(interval); };
  }, [filters]);

  return (
    <div style={{ 
      padding: 32, 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 
      minHeight: '100vh' 
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          padding: 32,
          textAlign: 'center'
        }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: 32, 
            fontWeight: 700,
            letterSpacing: '1px'
          }}>
            🔍 SISTEMA DE AUDITORÍA
          </h1>
          <p style={{ 
            margin: '8px 0 0 0', 
            fontSize: 16, 
            opacity: 0.9 
          }}>
            Registro completo de movimientos del sistema
          </p>
        </div>

        {/* Filters */}
        <div style={{ 
          padding: 24, 
          borderBottom: '1px solid #e0e0e0',
          background: '#f8f9fa'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            alignItems: 'center', 
            flexWrap: 'wrap' 
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: 4, 
                fontSize: 14, 
                fontWeight: 600,
                color: '#333'
              }}>
                Usuario:
              </label>
              <input
                type="text"
                value={filters.usuario}
                onChange={(e) => setFilters({...filters, usuario: e.target.value})}
                placeholder="Filtrar por usuario..."
                style={{
                  padding: '8px 12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: 8,
                  fontSize: 14,
                  minWidth: 150
                }}
              />
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: 4, 
                fontSize: 14, 
                fontWeight: 600,
                color: '#333'
              }}>
                Acción:
              </label>
              <select
                value={filters.accion}
                onChange={(e) => setFilters({...filters, accion: e.target.value})}
                style={{
                  padding: '8px 12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: 8,
                  fontSize: 14,
                  minWidth: 150
                }}
              >
                <option value="">Todas las acciones</option>
                <option value="CREATE">Crear</option>
                <option value="UPDATE">Actualizar</option>
                <option value="DELETE">Eliminar</option>
                <option value="DEDUCT">Deducir</option>
                <option value="RENT">Rentar</option>
                <option value="RETURN">Devolver</option>
              </select>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: 4, 
                fontSize: 14, 
                fontWeight: 600,
                color: '#333'
              }}>
                Tabla:
              </label>
              <select
                value={filters.tabla}
                onChange={(e) => setFilters({...filters, tabla: e.target.value})}
                style={{
                  padding: '8px 12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: 8,
                  fontSize: 14,
                  minWidth: 150
                }}
              >
                <option value="">Todas las tablas</option>
                <option value="work_orders">Work Orders</option>
                <option value="inventory">Inventario</option>
                <option value="trailers">Trailers</option>
                <option value="receives">Receives</option>
              </select>
            </div>

            <button
              onClick={() => setFilters({ usuario: '', accion: '', tabla: '' })}
              style={{
                padding: '10px 20px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                marginTop: 20
              }}
            >
              🔄 Limpiar Filtros
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{
                width: 40,
                height: 40,
                border: '4px solid #e3f2fd',
                borderTop: '4px solid #1976d2',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}></div>
              <p style={{ color: '#666', fontSize: 16 }}>Cargando registros de auditoría...</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#666', fontSize: 18 }}>
                No se encontraron registros con los filtros aplicados
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <thead>
                  <tr style={{ background: '#1976d2', color: '#fff' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>ID</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>USUARIO</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>ACCIÓN</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>TABLA</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>REGISTRO ID</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>FECHA</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>DETALLES</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={log.id} style={{ 
                      backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa',
                      borderBottom: '1px solid #e0e0e0'
                    }}>
                      <td style={{ padding: 12, fontWeight: 600, color: '#1976d2' }}>
                        #{log.id}
                      </td>
                      <td style={{ padding: 12, fontWeight: 600 }}>
                        👤 {log.usuario}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 4,
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: getActionColor(log.accion)
                        }}>
                          {getActionIcon(log.accion)} {log.accion}
                        </span>
                      </td>
                      <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 13 }}>
                        {log.tabla}
                      </td>
                      <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 13 }}>
                        {log.registro_id}
                      </td>
                      <td style={{ padding: 12, fontSize: 12, color: '#666' }}>
                        {dayjs(log.fecha).format('DD/MM/YYYY HH:mm:ss')}
                      </td>
                      <td style={{ padding: 12, maxWidth: 400 }}>
                        {renderDetalles(log.detalles)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default AuditLogTable;