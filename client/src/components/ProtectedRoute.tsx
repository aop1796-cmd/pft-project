/**
 * ProtectedRoute – redirects to /login if user is not authenticated
 * or does not have the required role
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface Props {
  children: React.ReactNode;
  roles?: ('STUDENT' | 'TEACHER' | 'ADMIN')[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-card p-8 text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="font-heading text-2xl mb-2">Access Denied</h2>
          <p className="text-text-secondary text-sm">
            You need the <strong>{roles.join(' or ')}</strong> role to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
