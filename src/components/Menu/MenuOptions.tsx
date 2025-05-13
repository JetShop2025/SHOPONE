import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png'; // Asegúrate de tener tu logo en esta ruta

const MenuOptions: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    // Lógica de autenticación aquí
    if (password === '6214') {
      navigate('/audit');
    } else {
      setError('Contraseña incorrecta');
    }
  };

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
      <h1 style={{ color: '#1976d2', fontWeight: 800, marginBottom: 32, letterSpacing: 2 }}>Menú Principal</h1>
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
        Inventario
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
        onClick={() => navigate('/work-orders')}
      >
        Órdenes de Trabajo
      </button>
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
        Control de Trailas
      </button>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        margin: '32px 0'
      }}>
        <label style={{ fontWeight: 700, color: '#1976d2', fontSize: 18, marginBottom: 8 }}>
          Ingresa tu contraseña de auditoría
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            padding: '12px 18px',
            borderRadius: 8,
            border: '1.5px solid #1976d2',
            fontSize: 17,
            marginBottom: 12,
            width: 260,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(25,118,210,0.07)'
          }}
        />
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
            boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
          }}
          onClick={handleLogin}
        >
          Entrar
        </button>
        {error && <div style={{ color: '#d32f2f', marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
};

export default MenuOptions;