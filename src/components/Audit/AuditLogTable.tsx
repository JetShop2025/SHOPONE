import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

// Función para renderizar detalles de auditoría de forma profesional
function renderDetalles(detalles: string | null | undefined) {
  // Verificar si detalles es null, undefined o string vacío
  if (!detalles || detalles === 'null' || detalles === 'undefined') {
    return (
      <div style={{ 
        fontSize: 12, 
        color: '#666', 
        fontStyle: 'italic',
        padding: '8px 12px',
        background: '#f5f5f5',
        borderRadius: 4,
        border: '1px solid #e0e0e0'
      }}>
        Sin detalles disponibles
      </div>
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(detalles);
  } catch {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{detalles}</pre>;
  }

  // Verificar si parsed es null después del JSON.parse
  if (!parsed || typeof parsed !== 'object') {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{detalles}</pre>;
  }

  // Si tiene summary, mostrarlo primero como encabezado principal
  if (parsed.summary) {
    return (
      <div style={{ fontSize: 13 }}>
        <div style={{ 
          fontWeight: 600, 
          color: '#1565c0', 
          marginBottom: 12,
          padding: '8px 12px',
          background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
          borderRadius: 8,
          border: '1px solid #2196f3',
          boxShadow: '0 2px 4px rgba(33, 150, 243, 0.1)'
        }}>
          📋 {parsed.summary}
        </div>
        
        {/* Mostrar información contextual si existe */}
        {renderContextInfo(parsed)}
        
        {/* Mostrar cambios si existen */}
        {parsed.changes && renderChangesTable(parsed.changes)}
        
        {/* Mostrar detalles adicionales */}
        {parsed.detalles && renderDataTable(parsed.detalles, 'Detalles', '#4caf50')}
        {parsed.datosEliminados && renderDataTable(parsed.datosEliminados, 'Datos Eliminados', '#f44336')}
      </div>
    );
  }

  // Si es un objeto con changes, mostrar tabla de cambios
  if (parsed.changes) {
    return renderChangesTable(parsed.changes);
  }

  // Si es un objeto, mostrar tabla general
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return renderDataTable(parsed, 'Información', '#2196f3');
  }

  // Si no es objeto, mostrar como texto plano
  return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{detalles}</pre>;
}

// Función para renderizar información contextual
function renderContextInfo(parsed: any) {
  if (!parsed || typeof parsed !== 'object') return null;
  
  const contextFields = ['cliente', 'trailer', 'estado', 'numero', 'tipo', 'parte', 'categoria', 'sku'];
  const contextData: any = {};
  
  contextFields.forEach(field => {
    if (parsed[field] && parsed[field] !== null && parsed[field] !== 'null') {
      contextData[field] = parsed[field];
    }
  });
  
  if (Object.keys(contextData).length === 0) return null;
  
  return (
    <div style={{
      background: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: 6,
      padding: '8px 12px',
      marginBottom: 12,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {Object.entries(contextData).map(([key, value]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ 
            fontWeight: 600, 
            color: '#495057',
            fontSize: 11,
            textTransform: 'uppercase',
            marginRight: 6
          }}>
            {key}:
          </span>
          <span style={{ 
            color: '#6c757d',
            fontSize: 12,
            padding: '2px 8px',
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #e9ecef'
          }}>
            {String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Función para renderizar tabla de cambios (antes/después)
function renderChangesTable(changes: any) {
  if (!changes || typeof changes !== 'object') return null;
  
  const keys = Object.keys(changes);
  if (keys.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#e65100',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        🔄 Cambios Realizados
      </div>
      <table style={{
        fontSize: 12,
        borderCollapse: 'collapse',
        width: '100%',
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #e0e0e0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <thead>
          <tr style={{ background: 'linear-gradient(135deg, #ff5722 0%, #e64a19 100%)', color: '#fff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>CAMPO</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>VALOR ANTERIOR</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>VALOR NUEVO</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key, index) => {
            const change = changes[key];
            return (
              <tr key={key} style={{ 
                borderBottom: index < keys.length - 1 ? '1px solid #f5f5f5' : 'none',
                background: index % 2 === 0 ? '#fafafa' : '#fff'
              }}>
                <td style={{ 
                  padding: '8px 12px', 
                  fontWeight: 600, 
                  color: '#424242',
                  borderRight: '1px solid #f0f0f0',
                  background: '#f8f9fa'
                }}>
                  {key}
                </td>
                <td style={{ 
                  padding: '8px 12px', 
                  color: '#d32f2f',                  borderRight: '1px solid #f0f0f0',
                  fontStyle: change.antes === null || change.antes === 'Sin definir' || change.antes === 'Vacío' || change.antes === 'null' ? 'italic' : 'normal'
                }}>
                  <div style={{
                    padding: '4px 8px',
                    background: '#ffebee',
                    borderRadius: 4,
                    border: '1px solid #ffcdd2'
                  }}>
                    {change.antes === null || change.antes === 'null' ? 'Sin definir' : String(change.antes ?? 'Sin definir')}
                  </div>
                </td>
                <td style={{ 
                  padding: '8px 12px', 
                  color: '#388e3c',
                  fontStyle: change.despues === null || change.despues === 'Sin definir' || change.despues === 'Vacío' || change.despues === 'null' ? 'italic' : 'normal'
                }}>
                  <div style={{
                    padding: '4px 8px',
                    background: '#e8f5e8',
                    borderRadius: 4,
                    border: '1px solid #c8e6c9'
                  }}>
                    {change.despues === null || change.despues === 'null' ? 'Sin definir' : String(change.despues ?? 'Sin definir')}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Función para renderizar tabla de datos general
function renderDataTable(data: any, title: string = 'Información', color: string = '#2196f3') {
  if (!data || typeof data !== 'object') return null;
  
  const keys = Object.keys(data).filter(key => 
    key !== 'summary' && 
    key !== 'changes' && 
    key !== 'operation' &&
    key !== 'workOrderId' &&
    key !== 'trailerId' &&
    key !== 'sku' &&
    data[key] !== null &&
    data[key] !== 'null' &&
    data[key] !== undefined
  );
  if (keys.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: color,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        📄 {title}
      </div>
      <table style={{
        fontSize: 12,
        borderCollapse: 'collapse',
        width: '100%',
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #e0e0e0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <thead>
          <tr style={{ background: `linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%)`, color: '#fff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>CAMPO</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>VALOR</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key, index) => (
            <tr key={key} style={{ 
              borderBottom: index < keys.length - 1 ? '1px solid #f5f5f5' : 'none',
              background: index % 2 === 0 ? '#fafafa' : '#fff'
            }}>
              <td style={{ 
                padding: '8px 12px', 
                fontWeight: 600, 
                color: '#424242',
                borderRight: '1px solid #f0f0f0',
                background: '#f8f9fa',
                textTransform: 'capitalize'
              }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </td>              <td style={{ padding: '8px 12px', color: '#616161' }}>
                <div style={{
                  padding: '4px 8px',
                  background: '#f5f5f5',
                  borderRadius: 4,
                  border: '1px solid #e0e0e0'
                }}>
                  {data[key] === null || data[key] === 'null' 
                    ? 'Sin definir' 
                    : typeof data[key] === 'object' 
                      ? JSON.stringify(data[key]) 
                      : String(data[key] ?? 'Sin definir')
                  }
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Función auxiliar para ajustar colores
function adjustColor(color: string, amount: number): string {
  const colorMap: { [key: string]: string } = {
    '#2196f3': amount > 0 ? '#1976d2' : '#1565c0',
    '#4caf50': amount > 0 ? '#388e3c' : '#2e7d32',
    '#f44336': amount > 0 ? '#d32f2f' : '#c62828',
    '#ff9800': amount > 0 ? '#f57c00' : '#ef6c00'
  };
  return colorMap[color] || color;
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
            console.log('Audit logs response:', res.data);
            const safeData = Array.isArray(res.data) ? res.data : [];
            setLogs(safeData);
            setLoading(false);
          }
        })
        .catch(error => { 
          console.error('Error fetching audit logs:', error);
          if (isMounted) {
            setLogs([]);
            setLoading(false);
          }
        });
    };
      fetchData();
    // Reducir frecuencia de polling para optimizar memoria (cada 30 segundos en lugar de 10)
    const interval = setInterval(fetchData, 30000);
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