import { apiClient } from './client';

export interface PoolMeta { total: number; page: number; limit: number; pages: number; }

export const poolApi = {
  // limit=1 to get only the meta count without loading all rows
  count: (benchStatus: 'Bench' | 'Allocated') =>
    apiClient
      .get<{ data: unknown[]; meta: PoolMeta }>('/pool', { params: { benchStatus, limit: 1 } })
      .then(r => r.data.meta.total),
};
