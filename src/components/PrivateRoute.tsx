import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const isAuth = !!localStorage.getItem('username');
  return isAuth ? <>{children}</> : <Navigate to="/" replace />;
};

export default PrivateRoute;