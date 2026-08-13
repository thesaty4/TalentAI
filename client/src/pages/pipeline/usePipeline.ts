import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, type PipelineEntry } from '../../lib/api/pipeline.api';
import { PIPELINE_STAGES } from '../../lib/constants/pipeline.constants';

const QUERY_KEY = ['pipeline', 'board'] as const;

export function usePipeline(params: Record<string, unknown>) {
  const qc  = useQueryClient();
  const qKey = [...QUERY_KEY, params] as const;

  const query = useQuery({
    queryKey: qKey,
    queryFn:  () => pipelineApi.list({ ...params, limit: 100 }),
  });

  const advanceMut = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      pipelineApi.updateStage(id, { stage, direction: 'forward' }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: qKey });
      const prev = qc.getQueryData(qKey);
      qc.setQueryData(qKey, (old: any) => old && {
        ...old,
        data: old.data.map((e: PipelineEntry) => e.id === id ? { ...e, stage } : e),
      });
      return { prev };
    },
    onError:   (_err, _vars, ctx) => qc.setQueryData(qKey, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const revertMut = useMutation({
    mutationFn: ({ id, stage, note }: { id: number; stage: string; note?: string }) =>
      pipelineApi.updateStage(id, { stage, direction: 'backward', note }),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const notFitMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      pipelineApi.notFit(id, reason),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: qKey });
      const prev = qc.getQueryData(qKey);
      qc.setQueryData(qKey, (old: any) => old && {
        ...old,
        data: old.data.map((e: PipelineEntry) => e.id === id ? { ...e, stage: 'Rejected' } : e),
      });
      return { prev };
    },
    onError:   (_err, _vars, ctx) => qc.setQueryData(qKey, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const shortlistMut = useMutation({
    mutationFn: ({ employeeId, ircId }: { employeeId: number; ircId: number }) =>
      pipelineApi.shortlist(employeeId, ircId),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const entries = query.data?.data ?? [];

  // Group by stage
  const byStage = PIPELINE_STAGES.reduce<Record<string, PipelineEntry[]>>((acc, s) => {
    acc[s] = entries.filter(e => e.stage === s);
    return acc;
  }, {});
  const rejected = entries.filter(e => e.stage === 'Rejected');

  return { query, entries, byStage, rejected, advanceMut, revertMut, notFitMut, shortlistMut };
}
