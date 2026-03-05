import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

interface DashboardStats {
  totalWorkOrders: number;
  processingOrders: number;
  approvedOrders: number;
  inventoryItems: number;
  lowStockItems: number;
  trailers: number;
  activeRentals: number;
}

const DashboardSidebar: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalWorkOrders: 0,
    processingOrders: 0,
    approvedOrders: 0,
    inventoryItems: 0,
    lowStockItems: 0,
    trailers: 0,
    activeRentals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const [wo, inv, trailers] = await Promise.all([
        axios.get(`${API_URL}/work-orders?limit=1`),
        axios.get(`${API_URL}/inventory?limit=1`),
        axios.get(`${API_URL}/trailas?limit=1`),
      ]);

      setStats({
        totalWorkOrders: wo.data?.total || 0,
        processingOrders: wo.data?.processing || 0,
        approvedOrders: wo.data?.approved || 0,
        inventoryItems: inv.data?.total || 0,
        lowStockItems: inv.data?.lowStock || 0,
        trailers: trailers.data?.total || 0,
        activeRentals: trailers.data?.rented || 0,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: 280,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1976d2 0%, #1565c0 100%)',
        padding: 24,
        boxShadow: '0 4px 24px rgba(25, 118, 210, 0.15)',
        overflowY: 'auto',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#fff',
            marginBottom: 4,
            letterSpacing: 1,
          }}
        >
          📊 DASHBOARD
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
          {new Date().toLocaleDateString('es-ES')}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Work Orders Section */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 12 }}>
            📋 Work Orders
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Total</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
              {stats.totalWorkOrders}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div
              style={{
                background: 'rgba(255,152,0,0.2)',
                borderRadius: 12,
                padding: 10,
                border: '1px solid rgba(255,152,0,0.3)',
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Processing</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffb74d', marginTop: 4 }}>
                {stats.processingOrders}
              </div>
            </div>
            <div
              style={{
                background: 'rgba(76,175,80,0.2)',
                borderRadius: 12,
                padding: 10,
                border: '1px solid rgba(76,175,80,0.3)',
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Approved</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#81c784', marginTop: 4 }}>
                {stats.approvedOrders}
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Section */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 12 }}>
            📦 Inventory
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Total Items</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
              {stats.inventoryItems}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(244,67,54,0.2)',
              borderRadius: 12,
              padding: 10,
              border: '1px solid rgba(244,67,54,0.3)',
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>⚠️ Low Stock</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ef5350', marginTop: 4 }}>
              {stats.lowStockItems}
            </div>
          </div>
        </div>

        {/* Trailers Section */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 12 }}>
            🚚 Trailers
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Total</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
              {stats.trailers}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(156,39,176,0.2)',
              borderRadius: 12,
              padding: 10,
              border: '1px solid rgba(156,39,176,0.3)',
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Active Rentals</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ba68c8', marginTop: 4 }}>
              {stats.activeRentals}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.2)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
        }}
      >
        Last update: {new Date().toLocaleTimeString('es-ES')}
      </div>
    </div>
  );
};

export default DashboardSidebar;
