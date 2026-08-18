import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { Step } from '../../components/StepProgress';
import { searchApi, type SearchResult } from '../../lib/api/search.api';

const STEP_LABELS: readonly string[] = [
  'Reading the request against the pool',
  'Parsed the request: client, domain, office rules and start date',
  'Matched project context — domain, architecture, responsibilities',
  'Applied location, remote policy and availability constraints',
  'Ranking & wrote the evidence and the gaps for each engineer',
] as const;

// Advance one step every N ms while the mutation is in-flight
const STEP_INTERVAL_MS = 1200;

// 422 Unprocessable Entity = query is outside IRC/JD scope
function isMismatch(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 422;
}

function getMismatchReason(err: unknown): string | null {
  if (!isMismatch(err)) return null;
  const e = err as { response: { data?: { message?: string } } };
  return e.response.data?.message ?? 'Your search query is outside the IRC/JD scope.';
}

export function useAISearch() {
  const [results,     setResults]     = useState<SearchResult[] | null>(null);
  const [jdFilename,  setJdFilename]  = useState<string | null>(null);
  // -1 = not started; 0..N-1 = active step index; N = all done
  const [activeStep,     setActiveStep]     = useState(-1);
  const [stepDurations,  setStepDurations]  = useState<(number | undefined)[]>(() => STEP_LABELS.map(() => undefined));
  const [failedStep,     setFailedStep]     = useState(-1);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeStepRef  = useRef(-1);  // stable copy for timer callbacks
  const stepStartRef   = useRef(0);   // timestamp when the current step started

  const searchMutation = useMutation({
    mutationFn: searchApi.rank,
    onMutate:   () => { startCycle(); },
    onSuccess:  (data) => { stopCycle(); setResults(data); setJdFilename(null); },
    onError:    (err)  => { stopCycle(isMismatch(err)); if (isMismatch(err)) setResults(null); },
  });

  const jdMutation = useMutation({
    mutationFn: ({ ircId, scope, file, query }: { ircId: number; scope: string; file: File; query?: string }) =>
      searchApi.uploadJd(ircId, scope, file, query),
    onMutate:   () => { startCycle(); },
    onSuccess:  (data, vars) => { stopCycle(); setResults(data); setJdFilename(vars.file.name); },
    onError:    (err)  => { stopCycle(isMismatch(err)); if (isMismatch(err)) setResults(null); },
  });

  function startCycle() {
    const now = Date.now();
    activeStepRef.current = 0;
    stepStartRef.current  = now;
    setActiveStep(0);
    setStepDurations(STEP_LABELS.map(() => undefined));
    setFailedStep(-1);

    intervalRef.current = setInterval(() => {
      const elapsed  = Date.now() - stepStartRef.current;
      const nextStep = activeStepRef.current + 1;
      if (nextStep >= STEP_LABELS.length) return; // stay on last step until done

      const doneStep = activeStepRef.current;
      activeStepRef.current = nextStep;
      stepStartRef.current  = Date.now();

      setStepDurations(prev => {
        const updated = [...prev];
        updated[doneStep] = elapsed;
        return updated;
      });
      setActiveStep(nextStep);
    }, STEP_INTERVAL_MS);
  }

  function stopCycle(failed = false) {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (activeStepRef.current < 0) return;

    const elapsed  = Date.now() - stepStartRef.current;
    const doneStep = activeStepRef.current;
    activeStepRef.current = STEP_LABELS.length; // sentinel: all complete

    setStepDurations(prev => {
      const updated = [...prev];
      updated[doneStep] = elapsed;
      return updated;
    });
    if (failed) setFailedStep(doneStep);
    setActiveStep(STEP_LABELS.length);
  }

  useEffect(() => () => stopCycle(), []);

  function updateResult(employeeId: number, patch: Partial<SearchResult>) {
    setResults(prev => prev?.map(r => r.employeeId === employeeId ? { ...r, ...patch } : r) ?? null);
  }

  // Compute typed Step array from state — consumed by StepProgress
  const steps: Step[] = STEP_LABELS.map((label, i) => ({
    label,
    status: activeStep < 0                         ? 'pending'
          : failedStep === i                       ? 'failed'
          : failedStep >= 0 && i > failedStep      ? 'pending'
          : activeStep >= STEP_LABELS.length       ? 'done'
          : i < activeStep                         ? 'done'
          : i === activeStep                       ? 'active'
          : 'pending',
    durationMs: stepDurations[i],
  }));

  const isPending = searchMutation.isPending || jdMutation.isPending;
  const rawError  = searchMutation.error    || jdMutation.error;
  const mismatch  = getMismatchReason(rawError);
  const error     = rawError && !mismatch ? rawError : null;

  return {
    results,
    jdFilename,
    steps,
    mismatch,
    isPending,
    error,
    search:    searchMutation.mutate,
    uploadJd:  jdMutation.mutate,
    updateResult,
  };
}
