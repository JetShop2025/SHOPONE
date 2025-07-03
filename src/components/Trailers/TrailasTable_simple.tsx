import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';
const clientes = ['GALGRE', 'JETGRE', 'PRIGRE', 'RAN100', 'GABGRE'];

const TrailasTable: React.FC = () => {
  const [trailas, setTrailas] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchData = () => {
      axios.get<any[]>(`${API_URL}/trailas`)
        .then(res => setTrailas(res.data || []))
        .catch(() => setTrailas([]));
    };
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ 
      maxWidth: 1200, 
      margin: '0 auto', 
      padding: 24,
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 32,
        background: 'white',
        padding: 24,
        borderRadius: 16,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#1976d2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12
        }}>
          <span style={{ fontSize: 24 }}>🚛</span>
        </div>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#1976d2',
          margin: 0,
          letterSpacing: 2
        }}>
          TRAILER CONTROL
        </h1>
      </div>

      <div style={{
        background: 'white',
        padding: 24,
        borderRadius: 16,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#1976d2', marginBottom: 20 }}>Sistema Modernizado - Cargando...</h2>
        <p>Total de trailers: {trailas.length}</p>
        
        {trailas.map((traila, index) => (
          <div key={index} style={{
            padding: 16,
            margin: '8px 0',
            background: '#f8f9fa',
            borderRadius: 8,
            border: '1px solid #e9ecef'
          }}>
            <strong>{traila.nombre}</strong> - {traila.estatus || 'DISPONIBLE'}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrailasTable;
