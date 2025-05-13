import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginForm from './components/Login/LoginForm';
import MenuOptions from './components/Menu/MenuOptions';
import WorkOrdersTable from './components/WorkOrders/WorkOrdersTable';
import InventoryList from './components/Inventory/index';
import AuditLogTable from './components/Audit/AuditLogTable';
import PrivateRoute from './components/PrivateRoute';
import TrailasTable from './components/Trailers/TrailasTable';  

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
          <Route path="/menu" element={<PrivateRoute><MenuOptions /></PrivateRoute>} />
          <Route path="/work-orders" element={<PrivateRoute><WorkOrdersTable /></PrivateRoute>} />
          <Route path="/inventory" element={<PrivateRoute><InventoryList /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute><AuditLogTable /></PrivateRoute>} />
          <Route path="/trailas" element={<PrivateRoute><TrailasTable /></PrivateRoute>} />
        </Routes>
      </Router>
    </>
  );
};

export default App;
