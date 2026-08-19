import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { projectsApi } from '../../lib/api/projects.api';
import { PIPELINE_STAGES, STAGE_HEX } from '../../lib/constants/pipeline.constants';
import { usePipeline } from './usePipeline';
import { PipelineCard } from './PipelineCard';
import { AddCandidateModal } from './AddCandidateModal';

export function PipelinePage() {
  const [urlParams] = useSearchParams();
  const [projectId,    setProjectId]   = useState<number | null>(() => { const v = urlParams.get('projectId'); return v ? +v : null; });
  const [roleSearch,   setRoleSearch]  = useState('');
  const [debouncedRole, setDebouncedRole] = useState('');
  const [addOpen,      setAddOpen]     = useState(false);

  // Debounce role input so the query key only changes after the user pauses typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRole(roleSearch.trim()), 400);
    return () => clearTimeout(t);
  }, [roleSearch]);

  const projectsQ = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });

  const apiParams: Record<string, unknown> = {};
  if (projectId) apiParams.projectId = projectId;
  if (debouncedRole) apiParams.role = debouncedRole;

  const { query, byStage, advanceMut, revertMut, notFitMut } = usePipeline(apiParams);

  if (query.isPending) return <Spinner />;
  if (query.isError)   return <ErrorBanner message="Failed to load pipeline" onRetry={query.refetch} />;

  const totalEntries = Object.values(byStage).reduce((s, a) => s + a.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={projectId ?? ''}
          onChange={e => setProjectId(e.target.value ? +e.target.value : null)}
          className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none">
          <option value="">All projects</option>
          {(projectsQ.data ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          value={roleSearch} onChange={e => setRoleSearch(e.target.value)}
          placeholder="Filter by role…"
          className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none w-48" />
        <Button size="sm" onClick={() => setAddOpen(true)} className="ml-auto flex items-center gap-1.5">
          <Plus size={14} /> Add candidate
        </Button>
      </div>

      {totalEntries === 0 && !query.isPending && (
        <EmptyState title="No pipeline entries" description="Use AI Search to shortlist candidates, or add manually." />
      )}

      {/* Kanban columns */}
      {totalEntries > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map(stage => {
            const entries = byStage[stage] ?? [];
            return (
              <div key={stage} style={{
                  display: 'flex', flexDirection: 'column', width: 240, flexShrink: 0,
                  background: (STAGE_HEX[stage] ?? '#858A9B') + '12',
                  borderRadius: 12,
                  border: '1px solid ' + (STAGE_HEX[stage] ?? '#858A9B') + '28',
                }}>
                {/* Column header — top corners clipped by overflow:hidden on this row only */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: STAGE_HEX[stage] ?? '#858A9B', flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#181A24', letterSpacing: '0.01em' }}>{stage}</span>
                  </div>
                  <span style={{
                    background: STAGE_HEX[stage] ?? '#858A9B',
                    color: '#fff',
                    fontSize: 10, fontWeight: 800,
                    borderRadius: 999, padding: '2px 7px',
                    letterSpacing: '0.02em',
                  }}>{entries.length}</span>
                </div>
                {/* Cards — no overflow constraint so dropdown menus can escape the column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
                  {entries.length === 0 && (
                    <p style={{ textAlign: 'center', fontSize: 12, color: '#858A9B', padding: '12px 0', opacity: 0.7 }}>Empty</p>
                  )}
                  {entries.map(e => (
                    <PipelineCard
                      key={e.id}
                      entry={e}
                      onAdvance={(id, s) => advanceMut.mutate({ id, stage: s })}
                      onRevert={(id, s, note) => revertMut.mutate({ id, stage: s, note })}
                      onNotFit={(id, reason) => notFitMut.mutate({ id, reason })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddCandidateModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => query.refetch()} />
    </div>
  );
}
