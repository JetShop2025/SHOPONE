import React from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://shipone-onrender.com/api';

interface Traila {
  id: number;
  nombre: string;
  estatus: string;
  cliente?: string;
  fecha_renta?: string;
  fecha_devolucion?: string;
  tipo?: string;
  ubicacion?: string;
}

interface TrailerCardProps {
  traila: Traila;
  showCliente?: boolean;
  getStatusColor: (status: string) => string;
  onRent: (traila: Traila) => void;
  onReturn: (traila: Traila) => void;
  onMarkAvailable: (traila: Traila) => void;
  onShowHistory: (traila: Traila, history: any[]) => void;
  onShowWorkOrders: (traila: Traila, workOrders: any[]) => void;
}

const TrailerCard: React.FC<TrailerCardProps> = ({
  traila,
  showCliente = false,
  getStatusColor,
  onRent,
  onReturn,
  onMarkAvailable,
  onShowHistory,
  onShowWorkOrders,
}) => {
  const StatusBadge = ({ status }: { status: string }) => (
    <span style={{
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      color: 'white',
      backgroundColor: getStatusColor(status),
      textTransform: 'uppercase'
    }}>
      {status}
    </span>
  );

  const handleShowHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/trailas/${traila.nombre}/rental-history`);
      onShowHistory(traila, Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching rental history:', error);
      onShowHistory(traila, []);
    }
  };

  const handleShowWorkOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/work-orders/trailer/${traila.nombre}`);
      onShowWorkOrders(traila, Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching work order history:', error);
      onShowWorkOrders(traila, []);
    }
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        border: '1px solid #f0f0f0',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
      }}
    >
      {/* Trailer Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1976d2', margin: '0' }}>
          {traila.nombre}
        </h3>
        <StatusBadge status={traila.estatus} />
      </div>

      {/* Trailer Info */}
      <div style={{ marginBottom: '16px' }}>
        {showCliente && traila.cliente && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: '600', color: '#666' }}>Cliente: </span>
            <span style={{ color: '#333' }}>{traila.cliente}</span>
          </div>
        )}
        {traila.fecha_renta && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: '600', color: '#666' }}>Fecha Renta: </span>
            <span style={{ color: '#333' }}>{dayjs(traila.fecha_renta).format('DD/MM/YYYY')}</span>
          </div>
        )}
        {traila.fecha_devolucion && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: '600', color: '#666' }}>Fecha Devolución: </span>
            <span style={{ color: '#333' }}>{dayjs(traila.fecha_devolucion).format('DD/MM/YYYY')}</span>
          </div>
        )}
        {traila.ubicacion && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: '600', color: '#666' }}>{showCliente ? 'Ubicación' : 'Location'}: </span>
            <span style={{ color: '#333' }}>{traila.ubicacion}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {traila.estatus === 'DISPONIBLE' && (
          <button
            onClick={() => onRent(traila)}
            style={{
              padding: '8px 16px',
              background: '#4caf50', color: 'white',
              border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontSize: '12px', fontWeight: '600'
            }}
          >
            📋 Rentar
          </button>
        )}

        {traila.estatus === 'RENTADO' && (
          <button
            onClick={() => onReturn(traila)}
            style={{
              padding: '8px 16px',
              background: '#ff9800', color: 'white',
              border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontSize: '12px', fontWeight: '600'
            }}
          >
            ↩️ Devolver
          </button>
        )}

        {traila.estatus !== 'DISPONIBLE' && traila.estatus !== 'RENTADO' && (
          <button
            onClick={() => onMarkAvailable(traila)}
            style={{
              padding: '8px 16px',
              background: '#2e7d32', color: 'white',
              border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontSize: '12px', fontWeight: '600'
            }}
          >
            ✅ Marcar Disponible
          </button>
        )}

        <button
          onClick={handleShowHistory}
          style={{
            padding: '8px 16px',
            background: '#2196f3', color: 'white',
            border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '12px', fontWeight: '600'
          }}
        >
          📊 Historial
        </button>

        <button
          onClick={handleShowWorkOrders}
          style={{
            padding: '8px 16px',
            background: '#9c27b0', color: 'white',
            border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '12px', fontWeight: '600'
          }}
        >
          🔧 W.O
        </button>
      </div>
    </div>
  );
};

export default TrailerCard;
