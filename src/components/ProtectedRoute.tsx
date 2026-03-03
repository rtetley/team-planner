import { Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, the user must have this role (in addition to being authenticated) */
  requiredRole?: UserRole;
}

/**
 * Renders `children` only when the user is authenticated (and has the required
 * role if `requiredRole` is specified). Otherwise redirects to `/login`.
 */
export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // User is authenticated but lacks the required role → send to their home
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
