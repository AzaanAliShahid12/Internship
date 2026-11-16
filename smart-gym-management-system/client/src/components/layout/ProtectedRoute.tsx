import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, homePathForRole } from '../../context/AuthContext';
import { PageLoading } from '../ui/feedback';
import type { Role } from '../../types';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    // Members/trainers hitting an admin URL go to their own home; staff hitting a wrong-role page see Unauthorized.
    if (user.role === 'member' || user.role === 'trainer') return <Navigate to={homePathForRole(user.role)} replace />;
    return <Navigate to="/unauthorized" replace />;
  }
  return <Outlet />;
}
