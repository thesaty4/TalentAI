import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StageChip } from '../../components/Badge';
import { Avatar } from '../../components/Card';
import { Button } from '../../components/Button';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { pipelineApi } from '../../lib/api/pipeline.api';
import { projectsApi } from '../../lib/api/projects.api';
import { PIPELINE_STAGES } from '../../lib/constants/pipeline.constants';
import { cn } from '../../lib/utils/cn';

export function IRCAppliedPage() {
  const navigate   = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [stage,     setStage]     = useState('');
  const [page,      setPage]      = useState(1);
  const [sortKey,   setSortKey]   = useState<'appliedDate' | 'matchPct'>('appliedDate');

  const projectsQ = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });

  const params: Record<string, unknown> = { page, limit: 20 };
  if (projectId) params.projectId = projectId;
  if (stage)     params.stage     = stage;

  const pipelineQ = useQuery({
    queryKey: ['pipeline', 'applied', params],
    queryFn:  () => pipelineApi.list(params),
    placeholderData: (prev) => prev,
  });

  // Build ircId → project name map from projects data
  const ircProject = new Map<number, string>();
  (projectsQ.data ?? []).forEach(p => p.ircs.forEach(i => ircProject.set(i.id, p.name)));

  const entries = pipelineQ.data?.data ?? [];
  const meta    = pipelineQ.data?.meta;

  // Client-side sort (API doesn't support appliedDate/matchPct sort)
  const sorted = [...entries].sort((a, b) => {
    if (sortKey === 'matchPct') return (b.matchPct ?? 0) - (a.matchPct ?? 0);
    return new Date(b.appliedDate ?? 0).getTime() - new Date(a.appliedDate ?? 0).getTime();
  });

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-secure-gray">Project</label>
          <select value={projectId ?? ''} onChange={e => { setProjectId(e.target.value ? +e.target.value : null); setPage(1); }}
            className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm focus:border-celestial-blue focus:outline-none">
            <option value="">All projects</option>
            {(projectsQ.data ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-secure-gray">Stage</label>
          <select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }}
            className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm focus:border-celestial-blue focus:outline-none">
            <option value="">All stages</option>
            {[...PIPELINE_STAGES, 'Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant={sortKey === 'appliedDate' ? 'primary' : 'secondary'} size="sm" onClick={() => setSortKey('appliedDate')}>
            By date
          </Button>
          <Button variant={sortKey === 'matchPct' ? 'primary' : 'secondary'} size="sm" onClick={() => setSortKey('matchPct')}>
            By match %
          </Button>
        </div>
      </div>

      {pipelineQ.isPending && <Spinner />}
      {pipelineQ.isError   && <ErrorBanner message="Failed to load applications" onRetry={pipelineQ.refetch} />}
      {!pipelineQ.isPending && entries.length === 0 && <EmptyState title="No candidates" description="No pipeline entries match the current filters." />}

      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border-subtle)] bg-culture-gray text-xs font-medium text-secure-gray">
              <tr>
                <th className="px-4 py-3 text-left">Candidate</th>
                <th className="px-4 py-3 text-left">IRC</th>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Applied</th>
                <th className="px-4 py-3 text-center">Match %</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {sorted.map(e => (
                <tr key={e.id} className="hover:bg-culture-gray/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.employee.fullName} className="h-7 w-7 shrink-0 text-[10px]" />
                      <div>
                        <p className="font-medium text-network-blue">{e.employee.fullName}</p>
                        <p className="text-xs text-[var(--fg-3)]">{e.employee.roleTitle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{e.irc.ircCode}</p>
                    <p className="text-xs text-[var(--fg-3)]">{e.irc.roleTitle}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--fg-3)]">{ircProject.get(e.irc.id) ?? '—'}</td>
                  <td className="px-4 py-3"><StageChip stage={e.stage} /></td>
                  <td className="px-4 py-3 text-xs text-[var(--fg-3)]">
                    {e.appliedDate ? new Date(e.appliedDate).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {e.matchPct != null ? (
                      <span className={cn('font-semibold', e.matchPct >= 70 ? 'text-commerce-green' : 'text-secure-gray')}>
                        {e.matchPct}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/employees/${e.employee.id}`)}>Profile</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.pages > 1 && (
        <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />
      )}
    </div>
  );
}
