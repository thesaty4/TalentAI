import { apiClient } from './client';

export interface LoginPayload  { email: string; password: string; }
export interface AuthResponse  { token: string; user: { id: number; name: string; email: string; role: string } }

export const authApi = {
  login:     (dto: LoginPayload) =>
    apiClient.post<{ data: AuthResponse }>('/auth/login', dto).then(r => r.data.data),
  demoLogin: (role: 'manager' | 'hr' | 'candidate') =>
    apiClient.post<{ data: AuthResponse }>(`/auth/demo-login/${role}`).then(r => r.data.data),
  signup:    (dto: { name: string; email: string; password: string; role?: string }) =>
    apiClient.post<{ data: AuthResponse }>('/auth/signup', dto).then(r => r.data.data),
};
