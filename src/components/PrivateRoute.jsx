import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function PrivateRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  console.log('PrivateRoute check:', {
    requiredRole,
    userRole: user?.user_metadata?.role,
    user: user
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  const userRole = user.user_metadata?.role;
  console.log('PrivateRoute - User role:', userRole);
  console.log('PrivateRoute - Required role:', requiredRole);

  // Allow admin to access staff routes
  if (requiredRole === 'staff' && userRole === 'admin') {
    if (typeof children === 'function') {
      return children({ user });
    }
    return children;
  }

  // Check if user has required role
  if (requiredRole && userRole !== requiredRole) {
    console.log('Role mismatch:', {
      required: requiredRole,
      actual: userRole
    });
    return <Navigate to="/" />;
  }

  if (typeof children === 'function') {
    return children({ user });
  }

  return children;
}

export default PrivateRoute; 