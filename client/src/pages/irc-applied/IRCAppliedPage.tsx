import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, History, List, Upload } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../auth/useAuth';
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
  const { user }   = useAuth();
  const qc         = useQueryClient();
  const fileRef    = useRef<HTMLInputElement>(null);
  const [projectId,   setProjectId]   = useState<number | null>(null);
  const [stage,       setStage]       = useState('');
  const [page,        setPage]        = useState(1);
  const [sortKey,     setSortKey]     = useState<'appliedDate' | 'matchPct'>('appliedDate');
  const [importModal, setImportModal] = useState(false);
  const [historyId,   setHistoryId]   = useState<number | null>(null);
  const [importRows,  setImportRows]  = useState<Array<{ employeeId: number; ircId: number; error?: string; done?: boolean }>>([]);
  const [importing,   setImporting]   = useState(false);
  const [importError, setImportError] = useState('');

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setImportError('Only .csv files are accepted.'); setImportModal(true); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = (ev.target?.result as string).split(/\r?\n/).filter(Boolean);
      const header = lines[0]?.toLowerCase().split(',').map(h => h.trim());
      const eIdx = header?.indexOf('employeeid') ?? -1;
      const iIdx = header?.indexOf('ircid') ?? -1;
      if (eIdx < 0 || iIdx < 0) {
        setImportError('CSV must have "employeeId" and "ircId" columns.');
        setImportRows([]);
        setImportModal(true);
        return;
      }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        const employeeId = Number(cols[eIdx]);
        const ircId      = Number(cols[iIdx]);
        if (!employeeId || !ircId) return { employeeId, ircId, error: 'Invalid row: non-numeric id' };
        return { employeeId, ircId };
      });
      setImportError('');
      setImportRows(rows);
      setImportModal(true);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    const updated = [...importRows];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].error) continue;
      try {
        await pipelineApi.shortlist(updated[i].employeeId, updated[i].ircId);
        updated[i] = { ...updated[i], done: true };
      } catch (err: any) {
        updated[i] = { ...updated[i], error: err?.response?.data?.message ?? 'Failed' };
      }
      setImportRows([...updated]);
    }
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['pipeline'] });
  }

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
      <div className="flex items-center gap-3">
        {/* Project filter */}
        <div className="relative">
          <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)] pointer-events-none z-10" />
          <select value={projectId ?? ''} onChange={e => { setProjectId(e.target.value ? +e.target.value : null); setPage(1); }}
            className={cn(
              'h-[34px] rounded-lg border pl-8 pr-3 text-sm focus:border-power-orange focus:outline-none',
              projectId !== null
                ? 'border-celestial-blue bg-celestial-blue/5'
                : 'border-[var(--border-default)]',
            )}>
            <option value="">All projects</option>
            {(projectsQ.data ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {/* Stage filter */}
        <div className="relative">
          <List size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)] pointer-events-none z-10" />
          <select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }}
            className={cn(
              'h-[34px] rounded-lg border pl-8 pr-3 text-sm focus:border-power-orange focus:outline-none',
              stage !== ''
                ? 'border-celestial-blue bg-celestial-blue/5'
                : 'border-[var(--border-default)]',
            )}>
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
          {user?.role === 'hr' && (
            <>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5">
                <Upload size={13} /> Import
              </Button>
            </>
          )}
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
                      <Avatar name={e.employee.fullName} className="h-7 w-7 shrink-0 text-[10px]" gloEmail={e.employee.email} />
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
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/employees/${e.employee.id}`)}>Profile</Button>
                      <Button size="sm" variant="ghost" onClick={() => setHistoryId(e.id)}
                        className="flex items-center gap-1" title="Stage history">
                        <History size={12} />
                      </Button>
                    </div>
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
      {/* CSV import modal — HR only */}
      <Modal open={importModal} onClose={() => { if (!importing) setImportModal(false); }} title="Import pipeline entries from CSV">
        {importError ? (
          <p className="mb-4 text-sm text-power-orange">{importError}</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-[var(--fg-3)]">
              Required columns: <code className="bg-culture-gray px-1">employeeId</code>, <code className="bg-culture-gray px-1">ircId</code>
            </p>
            <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
              <table className="w-full text-xs">
                <thead className="bg-culture-gray text-secure-gray">
                  <tr>
                    <th className="px-3 py-2 text-left">Employee ID</th>
                    <th className="px-3 py-2 text-left">IRC ID</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {importRows.map((row, i) => (
                    <tr key={i} className={row.error ? 'bg-power-orange/5' : row.done ? 'bg-commerce-green/5' : ''}>
                      <td className="px-3 py-1.5">{row.employeeId}</td>
                      <td className="px-3 py-1.5">{row.ircId}</td>
                      <td className="px-3 py-1.5">
                        {row.error ? <span className="text-power-orange">{row.error}</span>
                          : row.done ? <span className="text-commerce-green">✓ Added</span>
                          : <span className="text-[var(--fg-3)]">Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={importing} onClick={() => setImportModal(false)}>Close</Button>
          {!importError && importRows.some(r => !r.error && !r.done) && (
            <Button size="sm" disabled={importing} onClick={handleImport}>
              {importing ? 'Importing…' : `Import ${importRows.filter(r => !r.error).length} row(s)`}
            </Button>
          )}
        </div>
      </Modal>

      {/* Stage history modal */}
      {historyId !== null && (
        <StageHistoryModal id={historyId} onClose={() => setHistoryId(null)} />
      )}
    </div>
  );
}

function StageHistoryModal({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['stage-history', id],
    queryFn:  () => pipelineApi.getHistory(id),
    staleTime: 0, // always refetch on open — history grows after every stage change
  });
  return (
    <Modal open title="Stage history" onClose={onClose}>
      {q.isPending && <Spinner />}
      {q.isError   && <p className="text-sm text-power-orange">Failed to load history.</p>}
      {q.data?.length === 0 && <p className="text-sm text-[var(--fg-3)]">No stage changes recorded yet.</p>}
      {q.data && q.data.length > 0 && (
        <div className="space-y-3">
          {q.data.map(h => (
            <div key={h.id} className="flex items-start gap-3">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-celestial-blue" />
              <div className="text-sm">
                <p className="font-medium text-network-blue">
                  {h.fromStage} → {h.toStage}
                </p>
                <p className="text-xs text-[var(--fg-3)]">
                  {h.changedBy.name} · {new Date(h.changedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                {h.reason && <p className="mt-0.5 text-xs text-secure-gray">Reason: {h.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
