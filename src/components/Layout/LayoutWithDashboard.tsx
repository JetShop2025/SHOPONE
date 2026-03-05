import React from 'react';
import DashboardSidebar from '../Dashboard/DashboardSidebar';

interface LayoutWithDashboardProps {
  children: React.ReactNode;
}

const LayoutWithDashboard: React.FC<LayoutWithDashboardProps> = ({ children }) => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
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
