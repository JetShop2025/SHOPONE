import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardSidebar from '../Dashboard/DashboardSidebar';

interface LayoutWithDashboardProps {
  children: React.ReactNode;
}

const LayoutWithDashboard: React.FC<LayoutWithDashboardProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleEscToBack = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (location.pathname === '/') return;
      
      // Don't handle ESC on work orders pages - they have their own ESC handlers
      if (location.pathname === '/work-orders' || location.pathname === '/finished-work-orders') return;

      event.preventDefault();
      navigate(-1);
    };

    window.addEventListener('keydown', handleEscToBack);
    return () => window.removeEventListener('keydown', handleEscToBack);
  }, [navigate, location.pathname]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <DashboardSidebar />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#f5f5f5',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default LayoutWithDashboard;
