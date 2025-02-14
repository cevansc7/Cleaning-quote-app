import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import AdminDashboard from './AdminDashboard';
import ClientDashboard from './ClientDashboard';

const App = () => {
  return (
    <Routes>
      <Route path="/admin/dashboard" element={
        <PrivateRoute requiredRole="admin">
          <AdminDashboard />
        </PrivateRoute>
      } />
      <Route path="/dashboard" element={
        <PrivateRoute requiredRole="client">
          <ClientDashboard />
        </PrivateRoute>
      } />
      {/* ... other routes ... */}
    </Routes>
  );
};

export default App; 