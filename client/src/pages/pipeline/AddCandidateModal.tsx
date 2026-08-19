import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Feedback';
import { projectsApi } from '../../lib/api/projects.api';
import { pipelineApi } from '../../lib/api/pipeline.api';

// Re-uses pool count API; we need full employee list for search
import { apiClient } from '../../lib/api/client';

interface PoolEmployee { id: number; fullName: string; roleTitle: string; employeeCode: string; }
interface Props { open: boolean; onClose: () => void; onAdded: () => void; }

export function AddCandidateModal({ open, onClose, onAdded }: Props) {
  const [search,      setSearch]      = useState('');
  const [selectedEmp, setSelectedEmp] = useState<PoolEmployee | null>(null);
  const [selectedIrc, setSelectedIrc] = useState<number | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsApi.list(),
    enabled:  open,
  });

  const poolQ = useQuery({
    queryKey: ['pool-search', search],
    queryFn:  () =>
      apiClient.get<{ data: PoolEmployee[] }>('/pool', { params: { search, limit: 10 } }).then(r => r.data.data),
    enabled:  open && search.length >= 2,
  });

  const openIrcs = (projectsQ.data ?? []).flatMap(p =>
    p.ircs.filter(i => i.status === 'Open').map(i => ({ ...i, projectName: p.name }))
  );

  async function handleAdd() {
    if (!selectedEmp || !selectedIrc) return;
    setLoading(true); setError('');
    try {
      await pipelineApi.shortlist(selectedEmp.id, selectedIrc);
      onAdded();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to add candidate');
    } finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add candidate to pipeline">
      {error && <p className="mb-3 text-sm text-power-orange">{error}</p>}

      {/* Employee search */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-secure-gray">Search employee</label>
        <input value={search} onChange={e => { setSearch(e.target.value); setSelectedEmp(null); }}
          placeholder="Type name or role…"
          className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-power-orange focus:outline-none" />
        {poolQ.isFetching && <Spinner className="py-2" />}
        {poolQ.data && poolQ.data.length > 0 && !selectedEmp && (
          <div className="mt-1 rounded-lg border border-[var(--border-subtle)] bg-white shadow-sm">
            {poolQ.data.map(emp => (
              <button key={emp.id} onClick={() => { setSelectedEmp(emp); setSearch(emp.fullName); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-culture-gray">
                <span className="font-medium">{emp.fullName}</span>
                <span className="ml-2 text-xs text-[var(--fg-3)]">{emp.roleTitle}</span>
              </button>
            ))}
          </div>
        )}
        {selectedEmp && <p className="mt-1 text-xs text-commerce-green">✓ {selectedEmp.fullName} selected</p>}
      </div>

      {/* IRC selector */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-secure-gray">Open IRC (R2)</label>
        <select value={selectedIrc ?? ''} onChange={e => setSelectedIrc(e.target.value ? +e.target.value : null)}
          className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-power-orange focus:outline-none">
          <option value="">Select IRC…</option>
          {openIrcs.map(i => (
            <option key={i.id} value={i.id}>{i.ircCode} — {i.roleTitle} ({i.projectName})</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!selectedEmp || !selectedIrc || loading} onClick={handleAdd}>
          {loading ? 'Adding…' : 'Add to pipeline'}
        </Button>
      </div>
    </Modal>
  );
}
