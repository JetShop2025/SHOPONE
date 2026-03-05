import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

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
  const navigate = useNavigate();
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
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

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
      } else {
        navigate(path);
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
              width: 80,
              height: 80,
              borderRadius: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          />
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

        {/* Stats Section */}
        <div style={{ flex: 1, marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>
            📊 Quick Stats
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Work Orders Quick Stat */}
          <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: 12,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
            }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Work Orders</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{stats.totalWorkOrders}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                🟠 Processing: {stats.processingOrders}
              </div>
            </div>

            {/* Inventory Quick Stat */}
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: 12,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Inventory Items</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{stats.inventoryItems}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                ⚠️ Low Stock: {stats.lowStockItems}
              </div>
            </div>

            {/* Trailers Quick Stat */}
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: 12,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Trailers</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{stats.trailers}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                🔴 Rented: {stats.activeRentals}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.2)',
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
          }}
        >
          <div>ShopOne v1.2.24</div>
          <div style={{ marginTop: 4 }}>{new Date().toLocaleDateString('es-ES')}</div>
        </div>
      </div>
    );
  };

  export default DashboardSidebar;
