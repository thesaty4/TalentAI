import { apiClient } from './client';

export interface PoolEmployee {
  id:                number;
  employeeCode:      string;
  fullName:          string;
  roleTitle:         string;
  businessUnit:      string;
  location:          string;
  experienceYears:   number;
  benchStatus:       string;
  currentAllocation: string | null;
  availableDate:     string | null;
  skills:            string[];
  activeIrcCode:     string | null;
}

export interface PoolMeta { total: number; page: number; limit: number; pages: number; }
export interface PoolPage  { data: PoolEmployee[]; meta: PoolMeta; }

export interface PoolFilters {
  page?:         number;
  limit?:        number;
  search?:       string;
  location?:     string;
  businessUnit?: string;
  benchStatus?:  string;
  skills?:       string;
  minExp?:       number;
  maxExp?:       number;
  sortBy?:       string;
  sortOrder?:    'asc' | 'desc';
}

export const poolApi = {
  list: (params?: PoolFilters) =>
    apiClient.get<PoolPage>('/pool', { params }).then(r => r.data),

  // limit=1 to get only the meta count without loading all rows
  count: (benchStatus: 'Bench' | 'Allocated') =>
    apiClient.get<PoolPage>('/pool', { params: { benchStatus, limit: 1 } })
      .then(r => r.data.meta.total),

  export: (params?: PoolFilters) =>
    apiClient.get('/pool', {
      params:       { ...params, export: 'csv' },
      responseType: 'blob',
    }).then(r => r.data as Blob),
};
