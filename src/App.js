import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { NotificationSystemProvider } from './contexts/NotificationSystemContext';
import { Elements } from '@stripe/react-stripe-js';
import stripePromise from './lib/stripeClient.js';
import { LoadScript } from '@react-google-maps/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import ClientDashboard from './pages/ClientDashboard';
import QuoteCalculator from './pages/QuoteCalculator';
import PrivateRoute from './components/PrivateRoute';

// Remove the import of App.css if it exists
// import './App.css';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <NotificationSystemProvider>
          <Elements stripe={stripePromise}>
            <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
              <BrowserRouter>
                <div className="min-h-screen bg-background">
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<QuoteCalculator />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Dashboard route with role-based redirect */}
                    <Route 
                      path="/dashboard" 
                      element={
                        <PrivateRoute>
                          {({ user }) => {
                            // Redirect based on user role
                            if (user?.user_metadata?.role === 'admin') {
                              return <Navigate to="/admin/dashboard" replace />;
                            }
                            if (user?.user_metadata?.role === 'staff') {
                              return <Navigate to="/staff/dashboard" replace />;
                            }
                            return <Navigate to="/client/dashboard" replace />;
                          }}
                        </PrivateRoute>
                      } 
                    />

                    {/* Staff routes */}
                    <Route 
                      path="/staff/*" 
                      element={
                        <PrivateRoute requireRole="staff">
                          <Routes>
                            <Route path="/dashboard" element={<StaffDashboard />} />
                          </Routes>
                        </PrivateRoute>
                      } 
                    />

                    {/* Client routes */}
                    <Route 
                      path="/client/*" 
                      element={
                        <PrivateRoute requireRole="client">
                          <Routes>
                            <Route path="/dashboard" element={<ClientDashboard />} />
                          </Routes>
                        </PrivateRoute>
                      } 
                    />

                    {/* Admin routes */}
                    <Route 
                      path="/admin/*" 
                      element={
                        <PrivateRoute requireRole="admin">
                          <Routes>
                            <Route path="/dashboard" element={<AdminDashboard />} />
                          </Routes>
                        </PrivateRoute>
                      } 
                    />
                  </Routes>
                </div>
              </BrowserRouter>
            </LoadScript>
          </Elements>
        </NotificationSystemProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
