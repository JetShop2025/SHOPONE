import React, { useState, useEffect } from 'react';
import InventoryTable from './InventoryTable';
import ReceiveInventory from './ReceiveInventory';

const Inventory: React.FC = () => {
  const [view, setView] = useState<'master' | 'receive' | null>(null);

  // Keyboard shortcuts for Inventory submenu
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable element
      const activeElement = document.activeElement as HTMLElement;
      const isEditableElement = 
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.contentEditable === 'true';

      if (isEditableElement) return;

      if (event.key === '1') {
        setView('master');
      } else if (event.key === '2') {
        setView('receive');
      } else if (event.key === 'Escape') {
        setView(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

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
        boxShadow: '0 4px 24px rgba(10, 56, 84, 0.10)',
        maxWidth: 600,
        margin: '48px auto',
        textAlign: 'center'
      }}
    >
      <h1
        style={{
          color: '#0A3854',
          fontWeight: 800,
          letterSpacing: 2,
          fontSize: 36,
          marginBottom: 32
        }}
      >
        INVENTORY
      </h1>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 24, fontStyle: 'italic' }}>
        Press <strong>1</strong> for MASTER or <strong>2</strong> for RECEIVE
      </div>
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setView('master')}
          style={{
            background: '#0A3854',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '18px 48px',
            fontWeight: 700,
            fontSize: 20,
            marginRight: 16,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(10,56,84,0.10)',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#062838')}
          onMouseOut={e => (e.currentTarget.style.background = '#0A3854')}
        >
          <span style={{ marginRight: 8 }}>1.</span> MASTER
        </button>
        <button
          onClick={() => setView('receive')}
          style={{
            background: '#fff',
            color: '#0A3854',
            border: '2px solid #0A3854',
            borderRadius: 8,
            padding: '18px 48px',
            fontWeight: 700,
            fontSize: 20,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(10,56,84,0.10)',
            transition: 'background 0.2s, color 0.2s'
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#0A3854';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.color = '#0A3854';
          }}
        >
          <span style={{ marginRight: 8 }}>2.</span> RECEIVE
        </button>
      </div>
    </div>
  );
};

export default Inventory;