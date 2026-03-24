import React from 'react';

interface TrailersHeaderBarProps {
  trailerCount: number;
}

const TrailersHeaderBar: React.FC<TrailersHeaderBarProps> = ({ trailerCount }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '32px',
      background: 'white',
      padding: '24px',
      borderRadius: '16px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#1976d2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '16px'
        }}>
          <span style={{ fontSize: '24px' }}>🚛</span>
        </div>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1976d2',
            margin: '0',
            letterSpacing: '1px'
          }}>
            TRAILER CONTROL
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
            Sistema de Control de Trailers - {trailerCount} trailers
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            background: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#062838'}
          onMouseOut={(e) => e.currentTarget.style.background = '#1976d2'}
        >
          🔄 Actualizar
        </button>
      </div>
    </div>
  );
};

export default TrailersHeaderBar;
