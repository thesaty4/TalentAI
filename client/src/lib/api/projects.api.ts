import { apiClient } from './client';

export interface IrcSummary {
  id: number; ircCode: string; roleTitle: string; status: string;
}

export interface Project {
  id:        number;
  name:      string;
  customer:  string;
  status:    string;
  startDate: string | null;
  tags:      string[];
  managerId: number | null;
  ircs:      IrcSummary[];
}

export const projectsApi = {
  list:   (params?: Record<string, unknown>) =>
    apiClient.get<{ data: Project[] }>('/projects', { params }).then(r => r.data.data),
  getOne: (id: number) =>
    apiClient.get<{ data: Project }>(`/projects/${id}`).then(r => r.data.data),
};
