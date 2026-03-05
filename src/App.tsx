import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginForm from './components/Login/LoginForm';
import MenuOptions from './components/Menu/MenuOptions';
import WorkOrdersTable from './components/WorkOrders/WorkOrdersTable';
import FinishedWorkOrdersTable from './components/WorkOrders/FinishedWorkOrdersTable';
import InventoryList from './components/Inventory/index';
import AuditLogTable from './components/Audit/AuditLogTable';
import PrivateRoute from './components/PrivateRoute';
import TrailasTable from './components/Trailers/TrailasTable';  
import TrailerLocation from './components/TrailerLocation/TrailerLocation';
import LayoutWithDashboard from './components/Layout/LayoutWithDashboard';
import './env-test';
import './services/keepAlive'; // Importar el servicio keep-alive

const App: React.FC = () => {
  return (
    <>
      <style>
        {`
          body, input, select, textarea, button, table, th, td, label, h1, h2, h3, h4, h5, h6, div, span {
            font-family: 'Courier New', Courier, monospace !important;
          }
        `}
      </style>
      <Router>
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/menu" element={<PrivateRoute><LayoutWithDashboard><MenuOptions /></LayoutWithDashboard></PrivateRoute>} />
          <Route path="/work-orders" element={<PrivateRoute><LayoutWithDashboard><WorkOrdersTable /></LayoutWithDashboard></PrivateRoute>} />
          <Route path="/finished-work-orders" element={<PrivateRoute><LayoutWithDashboard><FinishedWorkOrdersTable /></LayoutWithDashboard></PrivateRoute>} />
          <Route path="/inventory" element={<PrivateRoute><LayoutWithDashboard><InventoryList /></LayoutWithDashboard></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute><LayoutWithDashboard><AuditLogTable /></LayoutWithDashboard></PrivateRoute>} />
          <Route path="/trailas" element={<PrivateRoute><LayoutWithDashboard><TrailasTable /></LayoutWithDashboard></PrivateRoute>} />
          <Route path="/trailer-location" element={<PrivateRoute><LayoutWithDashboard><TrailerLocation /></LayoutWithDashboard></PrivateRoute>} />
        </Routes>
      </Router>
    </>
  );
};

export default App;
