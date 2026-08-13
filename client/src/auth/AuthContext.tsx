import { createContext, useEffect, useState } from 'react';
import type { JwtUser } from '../lib/api/auth.api';

export type { JwtUser };

interface AuthContextValue {
  user:            JwtUser | null;
  token:           string | null;
  login:           (token: string, user: JwtUser) => void;
  logout:          () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwt(token: string): JwtUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Reject expired tokens client-side
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { id: payload.sub, name: payload.name, email: payload.email, role: payload.role, employeeId: payload.employeeId };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user,  setUser]  = useState<JwtUser | null>(() => {
    const t = localStorage.getItem('token');
    return t ? decodeJwt(t) : null;
  });

  useEffect(() => {
    if (token) {
      const decoded = decodeJwt(token);
      if (!decoded) logout();
    }
  }, []);

  function login(newToken: string, newUser: JwtUser) {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token && !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
