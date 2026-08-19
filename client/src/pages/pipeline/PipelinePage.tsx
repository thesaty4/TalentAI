import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { MultiSelect } from '../../components/MultiSelect';
import { projectsApi } from '../../lib/api/projects.api';
import { PIPELINE_STAGES, STAGE_HEX } from '../../lib/constants/pipeline.constants';
import { usePipeline } from './usePipeline';
import { PipelineCard } from './PipelineCard';
import { AddCandidateModal } from './AddCandidateModal';

export function PipelinePage() {
  const [urlParams] = useSearchParams();
  const [projectId,      setProjectId]    = useState<number | null>(() => { const v = urlParams.get('projectId'); return v ? +v : null; });
  const [roleSearch,     setRoleSearch]   = useState('');
  const [debouncedRole,  setDebouncedRole] = useState('');
  const [selectedStages, setSelectedStages] = useState<string[]>([...PIPELINE_STAGES]);
  const [selectedUsers,  setSelectedUsers]  = useState<string[]>([]);
  const [addOpen,        setAddOpen]      = useState(false);

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

  // Unique employee names for the user filter — derived from all fetched entries
  const allEntries = query.data?.data ?? [];
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const userOptions = useMemo(
    () => [...new Set(allEntries.map(e => e.employee.fullName))].sort(),
    [allEntries],
  );

  // Client-side user filter applied on top of the server-filtered data
  const visibleByStage = selectedUsers.length === 0
    ? byStage
    : Object.fromEntries(
        PIPELINE_STAGES.map(s => [s, (byStage[s] ?? []).filter(e => selectedUsers.includes(e.employee.fullName))]),
      );

  // Columns to render — only selected stages (preserving original order)
  const stageColumns = PIPELINE_STAGES.filter(s => selectedStages.includes(s));

  const isAllStages = selectedStages.length === PIPELINE_STAGES.length;
  function handleToggleAllStages() {
    setSelectedStages(isAllStages ? [PIPELINE_STAGES[0]] : [...PIPELINE_STAGES]);
  }
  function handleStageChange(stages: string[]) {
    if (stages.length === 0) return; // at least 1 stage must stay visible
    setSelectedStages(stages);
  }

  const totalEntries = Object.values(byStage).reduce((sum, a) => sum + a.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {notFitMut.isError && (
        <ErrorBanner message="Rejection failed — please try again." />
      )}
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
        <MultiSelect
          options={[...PIPELINE_STAGES]}
          selected={selectedStages}
          onChange={handleStageChange}
          placeholder="Stage filter"
          countLabel="Stage"
          className="w-44"
        />
        <MultiSelect
          options={userOptions}
          selected={selectedUsers}
          onChange={setSelectedUsers}
          placeholder="User filter"
          countLabel="Users"
          className="w-44"
        />
        <Button size="sm" onClick={() => setAddOpen(true)} className="ml-auto flex items-center gap-1.5">
          <Plus size={14} /> Add candidate
        </Button>
      </div>

      {totalEntries === 0 && !query.isPending && (
        <EmptyState title="No pipeline entries" description="Use AI Search to shortlist candidates, or add manually." />
      )}

      {/* Kanban columns — only render stages that are selected */}
      {totalEntries > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stageColumns.map(stage => {
            const entries = visibleByStage[stage] ?? [];
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
