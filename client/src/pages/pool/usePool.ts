import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { poolApi, type PoolFilters } from '../../lib/api/pool.api';

const DEBOUNCE_MS = 400;

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function usePool() {
  // Instant state — bound to inputs so typing feels responsive
  const [search,      setSearch]      = useState('');
  const [skillInput,  setSkillInput]  = useState('');
  const [stableFilters, setStableFilters] = useState<Omit<PoolFilters, 'search' | 'skills'>>({
    page: 1, limit: 20, sortBy: 'fullName', sortOrder: 'asc',
  });

  // Debounced — only triggers API calls after the user pauses typing
  const debouncedSearch = useDebounce(search.trim(),      DEBOUNCE_MS);
  const debouncedSkills = useDebounce(skillInput.trim(),  DEBOUNCE_MS);

  // Full params sent to API — stable filters change immediately, text fields debounced
  const queryFilters: PoolFilters = {
    ...stableFilters,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(debouncedSkills && { skills: debouncedSkills }),
  };

  const query = useQuery({
    queryKey: ['pool', queryFilters],
    queryFn:  () => poolApi.list(queryFilters),
    placeholderData: (prev) => prev,
  });

  function setStable<K extends keyof typeof stableFilters>(key: K, value: (typeof stableFilters)[K]) {
    setStableFilters(f => ({ ...f, [key]: value, page: key === 'page' ? (value as number) : 1 }));
  }

  function toggleSort(col: string) {
    setStableFilters(f => ({
      ...f,
      sortBy:    col,
      sortOrder: f.sortBy === col && f.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  async function exportCsv() {
    const blob = await poolApi.export(queryFilters);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'pool.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return {
    query,
    filters:     { ...stableFilters, search, skills: skillInput },
    skillInput,
    setFilter:   setStable,
    setSearch,
    setSkills:   setSkillInput,
    toggleSort,
    exportCsv,
  };
}
