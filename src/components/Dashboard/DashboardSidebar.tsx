import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';
const CURRENT_VERSION = process.env.REACT_APP_VERSION || 'v1.2.24';

interface RecentChange {
  id: string;
  action: string;
  module: string;
  user: string;
  timestamp: string;
  details?: string;
  description?: string;
}

interface FormattedActivity {
  summary: string;
  badges: string[];
  lines: string[];
}

const DashboardSidebar: React.FC = () => {
  const navigate = useNavigate();
  const [recentChanges, setRecentChanges] = useState<RecentChange[]>([]);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditPassword, setAuditPassword] = useState('');
  const [error, setError] = useState('');
  const username = localStorage.getItem('username') || 'USER';

  const fetchRecentChanges = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/audit?limit=20&userOnly=true`);
      const changes = response.data?.data || response.data || [];

      const trackedModules = new Set([
        'work_orders',
        'inventory',
        'receives',
        'login',
        'auth',
      ]);

      setRecentChanges(
        changes
          .filter((item: any) => {
            const module = String(item.module || '').toLowerCase();
            const user = String(item.username || item.user || '').toUpperCase();
            const details = String(item.details || item.description || '').toLowerCase();
            const isTracked =
              trackedModules.has(module) ||
              details.includes('work order') ||
              details.includes('inventory') ||
              details.includes('receive') ||
              details.includes('login') ||
              details.includes('auth');

            return (
              isTracked &&
              user !== 'SYSTEM'
            );
          })
          .slice(0, 4)
          .map((item: any) => ({
            id: item._id || item.id,
            action: (() => {
              const normalized = String(item.action || 'UPDATE').toUpperCase();
              if (normalized === 'CREATE') return 'Created';
              if (normalized === 'UPDATE') return 'Updated';
              if (normalized === 'DELETE') return 'Deleted';
              if (normalized === 'LOGIN') return 'Login';
              if (normalized === 'LOGOUT') return 'Logout';
              return item.action || 'Updated';
            })(),
            module: (() => {
              const normalized = String(item.module || 'work_orders').toLowerCase();
              if (normalized === 'work_orders') return 'Work Orders';
              if (normalized === 'inventory') return 'Inventory';
              if (normalized === 'receives' || normalized === 'receive') return 'Receives';
              if (normalized === 'login' || normalized === 'auth') return 'Login';
              return item.module || 'Work Orders';
            })(),
            user: item.username || item.user || 'Unknown',
            timestamp: item.timestamp || new Date().toISOString(),
            details: item.details || item.description,
            description: item.description || item.details,
          }))
      );
    } catch (error) {
      console.error('Error fetching recent changes:', error);
      // Fallback con datos de demostración si la API falla
      setRecentChanges([]);
    }
  }, []);

  useEffect(() => {
    fetchRecentChanges();
    
    const handleSystemChange = () => {
      fetchRecentChanges();
    };
    
    window.addEventListener('systemDataChanged', handleSystemChange);
    
    return () => {
      window.removeEventListener('systemDataChanged', handleSystemChange);
    };
  }, [fetchRecentChanges]);

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const getModuleIcon = (module: string) => {
    const icons: { [key: string]: string } = {
      'Work Orders': '📋',
      'Inventory': '📦',
      'Receives': '📥',
      'Login': '🔐',
      'Trailers': '🚚',
      'Audit': '🔍',
      'Users': '👤',
      'default': '⚙️',
    };
    return icons[module] || icons['default'];
  };

  const toReadableLabel = (value: string) => String(value || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  const truncateText = (value: string, max = 140) => {
    if (!value) return '';
    return value.length > max ? `${value.slice(0, max - 3)}...` : value;
  };

  const translateActivityText = (value: string) => String(value || '')
    .replace(/Actualizaci[o\u00f3]n de Work Order/gi, 'Work Order update')
    .replace(/Creaci[o\u00f3]n de Work Order/gi, 'Work Order creation')
    .replace(/Eliminaci[o\u00f3]n de Work Order/gi, 'Work Order deletion')
    .replace(/actualizada por/gi, 'updated by')
    .replace(/creada por/gi, 'created by')
    .replace(/eliminada por/gi, 'deleted by')
    .replace(/Cliente/gi, 'Client')
    .replace(/Estado/gi, 'Status')
    .replace(/costoTotal/gi, 'Total cost')
    .replace(/descripcion/gi, 'Description')
    .replace(/antes/gi, 'before')
    .replace(/despues/gi, 'after')
    .replace(/Sin definir/gi, 'Undefined');

  const formatRecentActivity = (change: RecentChange): FormattedActivity => {
    const raw = String(change.description || change.details || '').trim();
    if (!raw) {
      return { summary: '', badges: [], lines: [] };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return { summary: truncateText(raw), badges: [], lines: [] };
    }

    const summary = truncateText(
      translateActivityText(parsed.summary || parsed.operation || `${change.action} in ${change.module}`),
      90
    );

    const badges: string[] = [];
    if (parsed.workOrderId) badges.push(`WO #${parsed.workOrderId}`);
    if (parsed.cliente) badges.push(`Client: ${truncateText(String(parsed.cliente), 28)}`);
    if (parsed.trailer) badges.push(`Trailer: ${truncateText(String(parsed.trailer), 20)}`);
    if (parsed.estado) badges.push(`Status: ${parsed.estado}`);
    if (parsed.detalles?.costoTotal) badges.push(`Total: ${parsed.detalles.costoTotal}`);

    const lines: string[] = [];
    const relevantOrder = ['status', 'billToCo', 'trailer', 'totalLabAndParts', 'onHand', 'qty_remaining', 'precio', 'cost', 'action'];
    const changesObj = parsed.cambios || parsed.changes;
    if (changesObj && typeof changesObj === 'object' && !Array.isArray(changesObj)) {
      const sorted = Object.entries(changesObj).sort(([a], [b]) => {
        const ia = relevantOrder.indexOf(a);
        const ib = relevantOrder.indexOf(b);
        const va = ia === -1 ? 999 : ia;
        const vb = ib === -1 ? 999 : ib;
        return va - vb;
      });
      sorted.slice(0, 4).forEach(([field, values]: [string, any]) => {
        if (values && typeof values === 'object' && ('antes' in values || 'despues' in values)) {
          lines.push(`${toReadableLabel(field)}: before ${values.antes ?? '-'} | after ${values.despues ?? '-'}`);
        } else {
          lines.push(`${toReadableLabel(field)}: ${truncateText(String(values), 40)}`);
        }
      });
    }

    if (lines.length === 0 && parsed.detalles && typeof parsed.detalles === 'object') {
      Object.entries(parsed.detalles).slice(0, 3).forEach(([field, value]) => {
        lines.push(`${toReadableLabel(field)}: ${truncateText(String(value), 42)}`);
      });
    }

    return {
      summary,
      badges: badges.map((badge) => translateActivityText(badge)),
      lines: lines.map((line) => translateActivityText(line)).slice(0, 3),
    };
  };

  const menuItems = [
      {
        id: 'inventory',
        label: 'INVENTORY',
        icon: '📦',
        number: '1',
        path: '/inventory',
        submenu: [
          { label: 'MASTER', icon: '1.', path: '/inventory' },
          { label: 'RECEIVE', icon: '2.', path: '/inventory' },
        ],
      },
      {
        id: 'work-orders',
        label: 'WORK ORDERS',
        icon: '📋',
        number: '2',
        path: '/work-orders',
        submenu: [
          { label: 'W.O ENTRY', icon: '1.', path: '/work-orders' },
          { label: 'FINAL W.O', icon: '2.', path: '/finished-work-orders' },
        ],
      },
      {
        id: 'trailer-control',
        label: 'TRAILER CONTROL',
        icon: '🚚',
        number: '3',
        path: '/trailas',
        submenu: null,
      },
      {
        id: 'trailer-location',
        label: 'TRAILER LOCATION',
        icon: '🛰️',
        number: '4',
        path: '/trailer-location',
        submenu: null,
      },
      {
        id: 'audit',
        label: 'AUDIT',
        icon: '🔍',
        number: '5',
        path: '/audit',
        submenu: null,
      },
    ];

    const handleMenuClick = (menuId: string, path: string) => {
      if (menuItems.find(m => m.id === menuId)?.submenu) {
        setExpandedMenu(expandedMenu === menuId ? null : menuId);
      } else if (menuId === 'audit') {
        setShowAuditModal(true);
        setError('');
        setAuditPassword('');
      } else {
        navigate(path);
      }
    };

    const handleAuditAccess = () => {
      if (auditPassword === '6214') {
        setShowAuditModal(false);
        setAuditPassword('');
        setError('');
        navigate('/audit');
      } else {
        setError('wrong password, try again!');
      }
    };

    return (
    <div
      style={{
        width: 280,
        height: '100vh',
        background: 'linear-gradient(180deg, #0A3854 0%, #062838 100%)',
        padding: 24,
        boxShadow: '0 4px 24px rgba(10, 56, 84, 0.25)',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
          display: 'flex',
          flexDirection: 'column',
      }}
    >
        {/* Logo */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <img
            src={logo}
            alt="JetShop Logo"
            style={{
              width: 240,
              height: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: '2px solid rgba(255,255,255,0.2)',
              imageRendering: 'crisp-edges',
              WebkitBackfaceVisibility: 'hidden',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
              display: 'block',
              margin: '0 auto'
            }}
          />
        </div>

        {/* Username Display */}
        <div style={{ 
          marginBottom: 20, 
          textAlign: 'center', 
          background: 'rgba(255,255,255,0.15)',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.25)'
        }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>👤 Usuario Activo</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{username}</div>
        </div>

        {/* Main Menu */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>
            📍 Navigation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {menuItems.map((item) => (
              <div key={item.id}>
                <button
                  onClick={() => handleMenuClick(item.id, item.path)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  }}
                >
                  <span>
                    <span style={{ marginRight: 8 }}>{item.icon}</span>
                    {item.number}. {item.label}
                  </span>
                  {item.submenu && (
                    <span style={{ fontSize: 10, opacity: 0.6 }}>
                      {expandedMenu === item.id ? '▼' : '▶'}
                    </span>
                  )}
                </button>

                {/* Submenu */}
                {item.submenu && expandedMenu === item.id && (
                  <div style={{ marginTop: 6, marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {item.submenu.map((sub, idx) => (
                      <button
                        key={idx}
                        onClick={() => navigate(sub.path)}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.9)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          textAlign: 'left',
                          fontWeight: 500,
                          fontSize: 12,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          marginLeft: 8,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        }}
                      >
                        <span>{sub.icon}</span> {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div style={{ marginBottom: 16, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>
            📝 Update Area (Mini Audit)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentChanges.length > 0 ? (
              recentChanges.map((change) => {
                const formatted = formatRecentActivity(change);
                return (
                  <div
                    key={change.id}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 7,
                      padding: '8px 9px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: 10,
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, minWidth: 16 }}>{getModuleIcon(change.module)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 10, wordBreak: 'break-word' }}>
                          {change.action}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 9, marginTop: 1 }}>
                          {change.module}
                        </div>

                        {formatted.summary && (
                          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 9, marginTop: 4, fontWeight: 600 }}>
                            {formatted.summary}
                          </div>
                        )}

                        {formatted.badges.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                            {formatted.badges.slice(0, 3).map((badge, idx) => (
                              <span
                                key={`${change.id}-badge-${idx}`}
                                style={{
                                  fontSize: 8,
                                  padding: '1px 5px',
                                  borderRadius: 10,
                                  background: 'rgba(255,255,255,0.15)',
                                  color: 'rgba(255,255,255,0.9)',
                                  border: '1px solid rgba(255,255,255,0.2)'
                                }}
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        )}

                        {formatted.lines.length > 0 && (
                          <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            {formatted.lines.slice(0, 3).map((line, idx) => (
                              <div key={`${change.id}-line-${idx}`} style={{ color: 'rgba(255,255,255,0.68)', fontSize: 8, marginBottom: 1, wordBreak: 'break-word' }}>
                                • {truncateText(line, 90)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.64)', fontSize: 8 }}>
                        👤 {change.user}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.52)', fontSize: 8, fontWeight: 500 }}>
                        {formatTime(change.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 8,
                  padding: '16px 12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                }}
              >
                No recent activity
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.2)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.88)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: 700 }}>Current Version: ShopOne {CURRENT_VERSION}</div>
          <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.65)', fontSize: 10 }}>{new Date().toLocaleDateString('es-ES')}</div>
        </div>

        {/* Audit Password Modal */}
        {showAuditModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
            onClick={() => setShowAuditModal(false)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 32,
                width: 320,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ color: '#0A3854', marginBottom: 20, textAlign: 'center', fontSize: 20 }}>🔒 AUDIT ACCESS</h2>
              <input
                type="password"
                placeholder="Enter password"
                value={auditPassword}
                onChange={(e) => setAuditPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuditAccess()}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: 12,
                  fontSize: 16,
                  border: '2px solid #e0e0e0',
                  borderRadius: 8,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
              {error && (
                <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowAuditModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#e0e0e0',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleAuditAccess}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#0A3854',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  ACCESS
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export default DashboardSidebar;
