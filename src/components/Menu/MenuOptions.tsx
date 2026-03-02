import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

const MenuOptions: React.FC = () => {
  const navigate = useNavigate();
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditPassword, setAuditPassword] = useState('');
  const [error, setError] = useState('');
  const [showWorkOrderSubmenu, setShowWorkOrderSubmenu] = useState(false);

  const handleAuditAccess = () => {
    if (auditPassword === '6214') {
      setShowAuditModal(false);
      setAuditPassword('');
      setError('');
      navigate('/audit');
    } else {
      setError('wrong password, try  again!');
    }
  };

  // Keyboard shortcuts para Work Orders
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!showWorkOrderSubmenu) return;
      
      if (event.key === '1') {
        setShowWorkOrderSubmenu(false);
        navigate('/work-orders');
      } else if (event.key === '2') {
        setShowWorkOrderSubmenu(false);
        navigate('/finished-work-orders');
      } else if (event.key === 'Escape') {
        setShowWorkOrderSubmenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showWorkOrderSubmenu, navigate]);

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '60px auto',
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 4px 24px rgba(25,118,210,0.10)',
        padding: 40,
        textAlign: 'center',
        border: '1px solid #e3eaf2'
      }}
    >
      <img
        src={logo}
        alt="Logo"
        style={{ width: 120, marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(25,118,210,0.10)' }}
      />
      <h1 style={{ color: '#1976d2', fontWeight: 800, marginBottom: 32, letterSpacing: 2 }}>MAIN MENU</h1>
      <button
        style={{
          width: '100%',
          padding: '16px 0',
          marginBottom: 18,
          background: '#1976d2',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 18,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
        }}
        onClick={() => navigate('/inventory')}
      >
        INVENTORY
      </button>
      <button
        style={{
          width: '100%',
          padding: '16px 0',
          marginBottom: 18,
          background: '#43a047',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 18,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(67,160,71,0.10)'
        }}
        onClick={() => setShowWorkOrderSubmenu(!showWorkOrderSubmenu)}
      >
        WORK ORDERS
      </button>

      {/* Submenu para Work Orders */}
      {showWorkOrderSubmenu && (
        <div style={{
          background: '#f5f5f5',
          borderRadius: 8,
          padding: 16,
          marginBottom: 18,
          border: '2px solid #43a047'
        }}>
          <div
            style={{
              padding: '12px 0',
              marginBottom: 8,
              background: '#fff',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 16,
              transition: 'all 0.2s ease'
            }}
            onClick={() => {
              setShowWorkOrderSubmenu(false);
              navigate('/work-orders');
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f5e9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <span style={{ marginRight: 8 }}>1.</span> W.O ENTRY
          </div>
          <div
            style={{
              padding: '12px 0',
              background: '#fff',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 16,
              transition: 'all 0.2s ease'
            }}
            onClick={() => {
              setShowWorkOrderSubmenu(false);
              navigate('/finished-work-orders');
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f5e9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <span style={{ marginRight: 8 }}>2.</span> FINAL W.O
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 12, fontStyle: 'italic' }}>
            Press 1 or 2, or ESC to close
          </div>
        </div>
      )}
      <button
        style={{
          width: '100%',
          padding: '16px 0',
          marginBottom: 18,
          background: '#1976d2',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 18,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
        }}
        onClick={() => navigate('/trailas')}
      >
        TRAILER CONTROL
      </button>
      <button
        style={{
          width: '100%',
          padding: '16px 0',
          marginBottom: 18,
          background: '#ff9800',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 18,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(255,152,0,0.10)'
        }}
        onClick={() => navigate('/trailer-location')}
      >
        🛰️ TRAILER LOCATION
      </button>
      <button
        style={{
          width: '100%',
          padding: '16px 0',
          marginBottom: 18,
          background: '#d32f2f',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 18,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(211,47,47,0.10)'
        }}
        onClick={() => { setShowAuditModal(true); setError(''); setAuditPassword(''); }}
      >
        AUDIT
      </button>

      {/* Modal para password de auditoría */}
      {showAuditModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onClick={() => setShowAuditModal(false)}
        >
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, minWidth: 320,
            boxShadow: '0 4px 24px rgba(25,118,210,0.10)'
          }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ color: '#1976d2', fontWeight: 700, marginBottom: 16 }}>Audit Access</h2>
            <input
              type="password"
              value={auditPassword}
              onChange={e => setAuditPassword(e.target.value)}
              placeholder="Password"
              style={{
                padding: '12px 18px',
                borderRadius: 8,
                border: '1.5px solid #1976d2',
                fontSize: 17,
                marginBottom: 12,
                width: 220,
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(25,118,210,0.07)'
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleAuditAccess(); }}
              autoFocus
            />
            <div>
              <button
                style={{
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 36px',
                  fontWeight: 700,
                  fontSize: 17,
                  cursor: 'pointer',
                  marginRight: 8
                }}
                onClick={handleAuditAccess}
              >
                Enter
              </button>
              <button
                style={{
                  background: '#fff',
                  color: '#1976d2',
                  border: '1.5px solid #1976d2',
                  borderRadius: 8,
                  padding: '10px 36px',
                  fontWeight: 700,
                  fontSize: 17,
                  cursor: 'pointer'
                }}
                onClick={() => setShowAuditModal(false)}
              >
                Cancel
              </button>
            </div>
            {error && <div style={{ color: '#d32f2f', marginTop: 10 }}>{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuOptions;