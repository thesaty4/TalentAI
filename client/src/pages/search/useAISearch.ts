import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { searchApi, type SearchResult } from '../../lib/api/search.api';

const LOADING_MESSAGES = [
  'Searching resource pool…',
  'Analysing IRC & job description…',
  'Matching project experience…',
  'Ranking candidates…',
] as const;

export function useAISearch() {
  const [results,     setResults]     = useState<SearchResult[] | null>(null);
  const [jdFilename,  setJdFilename]  = useState<string | null>(null);
  const [loadingMsg,  setLoadingMsg]  = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const searchMutation = useMutation({
    mutationFn: searchApi.rank,
    onMutate:   () => { startCycle(); },
    onSuccess:  (data) => { stopCycle(); setResults(data); setJdFilename(null); },
    onError:    () => { stopCycle(); },
  });

  const jdMutation = useMutation({
    mutationFn: ({ ircId, scope, file, query }: { ircId: number; scope: string; file: File; query?: string }) =>
      searchApi.uploadJd(ircId, scope, file, query),
    onMutate:   () => { startCycle(); },
    onSuccess:  (data, vars) => { stopCycle(); setResults(data); setJdFilename(vars.file.name); },
    onError:    () => { stopCycle(); },
  });

  function startCycle() {
    setLoadingMsg(0);
    intervalRef.current = setInterval(() => {
      setLoadingMsg(i => (i + 1) % LOADING_MESSAGES.length);
    }, 1200);
  }

  function stopCycle() {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  useEffect(() => () => stopCycle(), []);

  function updateResult(employeeId: number, patch: Partial<SearchResult>) {
    setResults(prev => prev?.map(r => r.employeeId === employeeId ? { ...r, ...patch } : r) ?? null);
  }

  const isPending = searchMutation.isPending || jdMutation.isPending;
  const error     = searchMutation.error    || jdMutation.error;

  return {
    results,
    jdFilename,
    isPending,
    error,
    loadingMessage: LOADING_MESSAGES[loadingMsg],
    search:    searchMutation.mutate,
    uploadJd:  jdMutation.mutate,
    updateResult,
  };
}
