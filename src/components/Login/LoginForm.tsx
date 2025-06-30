import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logo from '../../assets/logo.png'; // Ajusta la ruta si tu logo está en otro lugar

const API_URL = process.env.REACT_APP_API_URL || 'https://graphical-system-v2.onrender.com/api';

const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem('username');
  }, []);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  try {
    const res = await axios.post<{ success: boolean }>(`${API_URL}/login`, { username, password });
    if (res.data.success) {
      localStorage.setItem('username', username);
      navigate('/menu', { replace: true });
    } else {
      setError('INCORRECT USERNAME OR PASSWORD');
    }
  } catch {
    setError('CONNECTION ERROR');
  }
  setLoading(false);
};

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(120deg, #e3f2fd 60%, #fffbe6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 4px 24px rgba(25,118,210,0.10)',
          padding: 40,
          minWidth: 350,
          maxWidth: 400,
          border: '1px solid #e3eaf2',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <img
          src={logo}
          alt="Logo"
          style={{
            width: 120,
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
          }}
        />
        <h1 style={{
          color: '#1976d2',
          fontWeight: 800,
          marginBottom: 32,
          letterSpacing: 2,
          fontFamily: 'Segoe UI, Arial, sans-serif',
          textAlign: 'center'
        }}>
          Login
        </h1>
        <form onSubmit={handleSubmit} style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'center',
        }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: 8,
              border: '1.5px solid #1976d2',
              fontSize: 17,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(25,118,210,0.07)',
              boxSizing: 'border-box',
              margin: 0,
              display: 'block'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: 8,
              border: '1.5px solid #1976d2',
              fontSize: 17,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(25,118,210,0.07)',
              boxSizing: 'border-box',
              margin: 0,
              display: 'block'
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 0',
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 18,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(25,118,210,0.10)'
            }}
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
          {loading && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <span className="loader" style={{
                display: 'inline-block',
                width: 32,
                height: 32,
                border: '4px solid #1976d2',
                borderTop: '4px solid #fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <style>
                {`
                  @keyframes spin {
                    0% { transform: rotate(0deg);}
                    100% { transform: rotate(360deg);}
                  }
                `}
              </style>
            </div>
          )}
          {error && (
            <div style={{ color: '#d32f2f', marginTop: 18, fontWeight: 600, fontSize: 15, textAlign: 'center' }}>
              {error === 'INCORRECT USERNAME OR PASSWORD'
                ? 'Incorrect username or password'
                : error === 'CONNECTION ERROR'
                ? 'Connection error'
                : error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginForm;