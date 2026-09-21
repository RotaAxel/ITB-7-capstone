import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Spinner from '@/components/ui/Spinner'

export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(user?.role)) {
    // Send them to *their own* dashboard, not unconditionally the client one —
    // otherwise a staff/admin user hitting any role-mismatched route (including
    // a client-only one) bounces to a page they also can't access.
    const home = user?.role === 'administrator' ? '/admin/dashboard'
      : user?.role === 'staff' ? '/staff/dashboard'
      : '/dashboard'
    return <Navigate to={home} replace />
  }

  return <Outlet />
}
