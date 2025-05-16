import React, { useState } from 'react';
import InventoryTable from './InventoryTable';
import ReceiveInventory from './ReceiveInventory';

const Inventory: React.FC = () => {
  const [view, setView] = useState<'master' | 'receive' | null>(null);

  if (view === 'master') {
    return <InventoryTable />;
  }
  if (view === 'receive') {
    return <ReceiveInventory />;
  }

  return (
    <div
      style={{
        padding: 40,
        background: 'linear-gradient(90deg, #e3f2fd 0%, #ffffff 100%)',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(25, 118, 210, 0.10)',
        maxWidth: 600,
        margin: '48px auto',
        textAlign: 'center'
      }}
    >
      <h1
        style={{
          color: '#1976d2',
          fontWeight: 800,
          letterSpacing: 2,
          fontSize: 36,
          marginBottom: 32
        }}
      >
        INVENTORY
      </h1>
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setView('master')}
          style={{
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '18px 48px',
            fontWeight: 700,
            fontSize: 20,
            marginRight: 16,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(25,118,210,0.10)',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#1565c0')}
          onMouseOut={e => (e.currentTarget.style.background = '#1976d2')}
        >
          MASTER
        </button>
        <button
          onClick={() => setView('receive')}
          style={{
            background: '#fff',
            color: '#1976d2',
            border: '2px solid #1976d2',
            borderRadius: 8,
            padding: '18px 48px',
            fontWeight: 700,
            fontSize: 20,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(25,118,210,0.10)',
            transition: 'background 0.2s, color 0.2s'
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#1976d2';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.color = '#1976d2';
          }}
        >
          RECEIVE
        </button>
      </div>
    </div>
  );
};

export default Inventory;