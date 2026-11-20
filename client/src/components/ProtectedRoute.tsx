import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './ui';

const HOME: Record<string, string> = {
  professional: '/portal/professional',
  employer: '/portal/employer',
  admin: '/portal/admin'
};

export function ProtectedRoute({ role, children }: { role: 'professional' | 'employer' | 'admin'; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--cream)' }}>
        <Loading label="Checking your session…" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (user.role !== role) {
    return <Navigate to={HOME[user.role] || '/'} replace />;
  }
  return <>{children}</>;
}

export function PermissionGate({
  permissions,
  children
}: {
  permissions: string[];
  children: ReactNode;
}) {
  const { adminPermissions } = useAuth();
  const allowed = adminPermissions.includes('*') || permissions.some((permission) => adminPermissions.includes(permission));
  if (!allowed) {
    return (
      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <h2 className="card-title">Permission required</h2>
        <p className="page-sub" style={{ marginTop: 8 }}>
          Your administrator role does not include access to this area. Ask a super administrator if you need it.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
