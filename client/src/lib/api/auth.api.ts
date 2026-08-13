import { apiClient } from './client';

export interface JwtUser {
  id: number; name: string; email: string;
  role: 'manager' | 'hr' | 'candidate';
  employeeId?: number | null;
}

export interface AuthResponse { token: string; user: JwtUser; }

export const authApi = {
  login: (dto: { email: string; password: string }) =>
    apiClient.post<{ data: AuthResponse }>('/auth/login', dto).then(r => r.data.data),

  signup: (dto: { name: string; email: string; password: string; role?: string }) =>
    apiClient.post<{ data: AuthResponse }>('/auth/signup', dto).then(r => r.data.data),

  demoLogin: (role: 'manager' | 'hr' | 'candidate') =>
    apiClient.post<{ data: AuthResponse }>(`/auth/demo-login/${role}`).then(r => r.data.data),
};
