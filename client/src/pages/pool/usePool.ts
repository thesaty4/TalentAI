import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { poolApi, type PoolFilters } from '../../lib/api/pool.api';

export function usePool() {
  const [filters, setFilters] = useState<PoolFilters>({
    page: 1, limit: 20, sortBy: 'fullName', sortOrder: 'asc',
  });
  const [skillInput, setSkillInput] = useState('');

  const query = useQuery({
    queryKey: ['pool', filters],
    queryFn:  () => poolApi.list(filters),
    placeholderData: (prev) => prev,
  });

  function setFilter<K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) {
    setFilters(f => ({ ...f, [key]: value, page: key === 'page' ? (value as number) : 1 }));
  }

  function setSkills(raw: string) {
    setSkillInput(raw);
    setFilter('skills', raw.trim() || undefined);
  }

  function toggleSort(col: string) {
    setFilters(f => ({
      ...f,
      sortBy:    col,
      sortOrder: f.sortBy === col && f.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  async function exportCsv() {
    const blob = await poolApi.export({ ...filters, page: undefined, limit: undefined });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'pool.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return { query, filters, skillInput, setFilter, setSkills, toggleSort, exportCsv };
}
