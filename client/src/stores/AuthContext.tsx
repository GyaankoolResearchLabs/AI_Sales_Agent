import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { http, setAccessToken, extractErrorMessage } from '../api/http';
import { User, Organization } from '../types';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, organizationName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setOrganization: (org: Organization) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganizationState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const res = await http.get('/auth/me');
      setUser(res.data.data.user);
      setOrganizationState(res.data.data.organization);
    } catch {
      setUser(null);
      setOrganizationState(null);
    }
  }, []);

  useEffect(() => {
    // Try a silent refresh on load (the refresh token lives in an httpOnly cookie).
    (async () => {
      try {
        const res = await http.post('/auth/refresh');
        setAccessToken(res.data.data.accessToken);
        await refreshMe();
      } catch {
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshMe]);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setOrganizationState(null);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await http.post('/auth/login', { email, password });
      setAccessToken(res.data.data.accessToken);
      setUser(res.data.data.user);
      setOrganizationState(res.data.data.organization);
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, organizationName: string) => {
    try {
      const res = await http.post('/auth/signup', { name, email, password, organizationName });
      setAccessToken(res.data.data.accessToken);
      setUser(res.data.data.user);
      setOrganizationState(res.data.data.organization);
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      setOrganizationState(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        signup,
        logout,
        refreshMe,
        setOrganization: setOrganizationState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
