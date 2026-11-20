import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setCsrfToken } from '../lib/api';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'professional' | 'employer' | 'admin';
  adminRole?: string | null;
  status: string;
  mfaEnabled: boolean;
  isDemo?: boolean;
};

type AuthState = {
  user: User | null;
  csrfToken: string | null;
  adminPermissions: string[];
  unreadNotifications: number;
  mfaEnrollmentRequired: boolean;
  loading: boolean;
  login: (email: string, password: string, code?: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [csrf, setCsrf] = useState<string | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((payload: any) => {
    setUser(payload.user || null);
    setCsrf(payload.csrfToken || null);
    setCsrfToken(payload.csrfToken || null);
    setAdminPermissions(payload.adminPermissions || []);
    setUnreadNotifications(payload.unreadNotifications || 0);
    setMfaEnrollmentRequired(Boolean(payload.mfaEnrollmentRequired));
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setCsrf(null);
    setCsrfToken(null);
    setAdminPermissions([]);
    setUnreadNotifications(0);
    setMfaEnrollmentRequired(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const payload = await api('/auth/me');
      applySession(payload);
    } catch {
      clear();
    } finally {
      setLoading(false);
    }
  }, [applySession, clear]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => clear();
    window.addEventListener('flamingo:unauthorized', handler);
    return () => window.removeEventListener('flamingo:unauthorized', handler);
  }, [clear]);

  const login = useCallback(
    async (email: string, password: string, code?: string) => {
      const payload = await api('/auth/login', {
        method: 'POST',
        body: { email, password, ...(code ? { code } : {}) }
      });
      applySession({ ...payload, unreadNotifications: payload.unreadNotifications || 0 });
      return payload.user as User;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Session may already be invalid.
    }
    clear();
  }, [clear]);

  const value = useMemo(
    () => ({
      user,
      csrfToken: csrf,
      adminPermissions,
      unreadNotifications,
      mfaEnrollmentRequired,
      loading,
      login,
      logout,
      refresh
    }),
    [
      user,
      csrf,
      adminPermissions,
      unreadNotifications,
      mfaEnrollmentRequired,
      loading,
      login,
      logout,
      refresh
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
