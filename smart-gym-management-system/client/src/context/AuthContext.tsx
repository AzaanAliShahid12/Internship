import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, tokenStore, ApiResponse } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!tokenStore.get()) { setLoading(false); return; }
      try {
        const res = await api.get<ApiResponse<User>>('/auth/me');
        setUser(res.data.data);
        connectSocket();
      } catch {
        tokenStore.set(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/login', { email, password });
    tokenStore.set(res.data.data.accessToken);
    setUser(res.data.data.user);
    connectSocket();
    return res.data.data.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/register', { name, email, password });
    tokenStore.set(res.data.data.accessToken);
    setUser(res.data.data.user);
    connectSocket();
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    tokenStore.set(null);
    setUser(null);
    disconnectSocket();
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function homePathForRole(role: string): string {
  switch (role) {
    case 'member': return '/portal';
    case 'trainer': return '/trainer-dashboard';
    case 'receptionist': return '/reception';
    default: return '/dashboard';
  }
}
