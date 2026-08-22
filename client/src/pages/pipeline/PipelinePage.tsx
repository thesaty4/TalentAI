import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Download, List, Plus, Search, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { cn } from '../../lib/utils/cn';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { MultiSelect } from '../../components/MultiSelect';
import { projectsApi } from '../../lib/api/projects.api';
import { PIPELINE_STAGES, STAGE_HEX } from '../../lib/constants/pipeline.constants';
import { useAuth } from '../../auth/useAuth';
import { usePipeline } from './usePipeline';
import { PipelineCard } from './PipelineCard';
import { AddCandidateModal } from './AddCandidateModal';
import { FeedbackHistoryModal } from './FeedbackHistoryModal';

export function PipelinePage() {
  const { user }             = useAuth();
  const [urlParams]          = useSearchParams();
  const [projectId,      setProjectId]    = useState<number | null>(() => { const v = urlParams.get('projectId'); return v ? +v : null; });
  const [roleSearch,     setRoleSearch]   = useState('');
  const [debouncedRole,  setDebouncedRole] = useState('');
  const [selectedStages, setSelectedStages] = useState<string[]>(() => {
    const v = urlParams.get('stage');
    // Support comma-separated stages or single stage from URL param
    return v ? v.split(',').map(s => decodeURIComponent(s.trim())).filter(s => (PIPELINE_STAGES as readonly string[]).includes(s)) : [...PIPELINE_STAGES];
  });
  const [selectedUsers,  setSelectedUsers]  = useState<string[]>([]);
  const [addOpen,        setAddOpen]      = useState(false);
  const [historyEntry,   setHistoryEntry] = useState<{ id: number; name: string; ircCode: string } | null>(null);

  // Debounce role input so the query key only changes after the user pauses typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRole(roleSearch.trim()), 400);
    return () => clearTimeout(t);
  }, [roleSearch]);

  const projectsQ = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });

  const apiParams: Record<string, unknown> = {};
  if (projectId) apiParams.projectId = projectId;
  if (debouncedRole) apiParams.role = debouncedRole;

  const { query, byStage, advanceMut, revertMut, notFitMut, addFeedbackMut } = usePipeline(apiParams);

  // Unique employee names for the user filter — must be above early returns to satisfy Rules of Hooks
  const allEntries = query.data?.data ?? [];
  const userOptions = useMemo(
    () => [...new Set(allEntries.map(e => e.employee.fullName))].sort(),
    [allEntries],
  );

  if (query.isPending) return <Spinner />;
  if (query.isError)   return <ErrorBanner message="Failed to load pipeline" onRetry={query.refetch} />;

  // Client-side user filter applied on top of the server-filtered data
  const visibleByStage = selectedUsers.length === 0
    ? byStage
    : Object.fromEntries(
        PIPELINE_STAGES.map(s => [s, (byStage[s] ?? []).filter(e => selectedUsers.includes(e.employee.fullName))]),
      );

  // Columns to render — only selected stages (preserving original order)
  const stageColumns = PIPELINE_STAGES.filter(s => selectedStages.includes(s));

  function handleStageChange(stages: string[]) {
    if (stages.length === 0) return; // at least 1 stage must stay visible
    setSelectedStages(stages);
  }

  function exportCSV() {
    const rows = stageColumns.flatMap(stage =>
      (visibleByStage[stage] ?? []).map(e => {
        // One cell per stage with all feedback records for that stage combined (newest first)
        const stageFeedback = PIPELINE_STAGES.map(s => {
          const records = (e.feedbackRounds ?? []).filter(fb => fb.roundName === s);
          if (!records.length) return '';
          return records
            .map(fb => {
              const parts: string[] = [];
              if (fb.roundDate) parts.push(new Date(fb.roundDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
              if (fb.rating)    parts.push(fb.rating);
              if (fb.comments)  parts.push(fb.comments.replace(/[\r\n]+/g, ' '));
              return parts.join(' - ');
            })
            .join('\n');
        });
        return [
          e.employee.fullName,
          e.employee.roleTitle,
          e.employee.location,
          e.stage,
          e.irc.ircCode,
          e.irc.roleTitle,
          e.matchPct ?? '',
          e.appliedDate ? new Date(e.appliedDate).toLocaleDateString() : '',
          ...stageFeedback,
        ];
      })
    );
    if (rows.length === 0) return;
    const stageFeedbackHeaders = PIPELINE_STAGES.map(s => `${s} Feedback`);
    const headers = ['Name', 'Role Title', 'Location', 'Stage', 'IRC Code', 'IRC Role', 'Match %', 'Applied Date', ...stageFeedbackHeaders];
    const csv = [headers, ...rows].map(r => r.map(v => JSON.stringify(v)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `pipeline-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalEntries = Object.values(byStage).reduce((sum, a) => sum + a.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {notFitMut.isError && (
        <ErrorBanner message="Rejection failed — please try again." />
      )}
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        {/* Project filter */}
        <div className="relative flex items-center">
          <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)] pointer-events-none z-10" />
          <select
            value={projectId ?? ''}
            onChange={e => setProjectId(e.target.value ? +e.target.value : null)}
            className={cn(
              'h-[34px] w-36 rounded-lg border pl-8 pr-3 text-sm focus:border-power-orange focus:outline-none',
              projectId !== null
                ? 'border-celestial-blue bg-celestial-blue/5'
                : 'border-[var(--border-default)]',
            )}>
            <option value="">All projects</option>
            {(projectsQ.data ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {/* Role filter */}
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)] pointer-events-none z-10" />
          <input
            value={roleSearch} onChange={e => setRoleSearch(e.target.value)}
            placeholder="Filter by role…"
            className={cn(
              'h-[34px] w-40 rounded-lg border pl-8 pr-3 text-sm focus:border-power-orange focus:outline-none',
              roleSearch !== ''
                ? 'border-celestial-blue bg-celestial-blue/5'
                : 'border-[var(--border-default)]',
            )} />
        </div>
        {/* Stage filter */}
        <div className="relative">
          <List size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)] pointer-events-none z-10" />
          <MultiSelect
            options={[...PIPELINE_STAGES]}
            selected={selectedStages}
            onChange={handleStageChange}
            placeholder="Stage filter"
            countLabel="Stage"
            className={cn(
              'w-36 [&>button]:h-[34px] [&>button]:pl-8',
              selectedStages.length < PIPELINE_STAGES.length
                ? '[&>button]:border-celestial-blue [&>button]:bg-celestial-blue/5'
                : '',
            )}
          />
        </div>
        {/* User filter */}
        <div className="relative">
          <Users size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)] pointer-events-none z-10" />
          <MultiSelect
            options={userOptions}
            selected={selectedUsers}
            onChange={setSelectedUsers}
            placeholder="User filter"
            countLabel="Users"
            className={cn(
              'w-36 [&>button]:h-[34px] [&>button]:pl-8',
              selectedUsers.length > 0
                ? '[&>button]:border-celestial-blue [&>button]:bg-celestial-blue/5'
                : '',
            )}
          />
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="ml-auto flex items-center gap-1.5">
          <Plus size={14} /> Add candidate
        </Button>
        <Button size="sm" variant="secondary" onClick={exportCSV} className="flex items-center gap-1.5">
          <Download size={14} /> Export
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
                      onAddFeedback={(id, roundName, comments, rating) =>
                        addFeedbackMut.mutateAsync({
                          id,
                          dto: { roundName, comments, rating, interviewer: user?.name },
                        })
                      }
                      onViewHistory={(id) => {
                        const found = allEntries.find(en => en.id === id);
                        if (found) setHistoryEntry({ id, name: found.employee.fullName, ircCode: found.irc.ircCode });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddCandidateModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => query.refetch()} />
      <FeedbackHistoryModal
        entryId={historyEntry?.id ?? null}
        entryName={historyEntry?.name ?? ''}
        ircCode={historyEntry?.ircCode ?? ''}
        onClose={() => setHistoryEntry(null)}
      />
    </div>
  );
}
