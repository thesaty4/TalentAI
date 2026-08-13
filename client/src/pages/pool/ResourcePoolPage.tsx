import { useNavigate } from 'react-router-dom';
import { Download, MoreVertical, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '../../components/Card';
import { Button } from '../../components/Button';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { SkillsMultiSelect } from '../../components/SkillsMultiSelect';
import { cn } from '../../lib/utils/cn';
import { usePool } from './usePool';

function SortIcon({ col, current }: { col: string; current?: string }) {
  return (
    <ArrowUpDown size={11} className={cn('inline ml-1', col === current ? 'text-celestial-blue' : 'text-level-gray')} />
  );
}

export function ResourcePoolPage() {
  const navigate = useNavigate();
  const { query, filters, skillInput, setFilter, setSearch, setSkills, toggleSort, exportCsv } = usePool();
  const [exportLoading, setExportLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const employees = query.data?.data ?? [];
  const meta      = query.data?.meta;

  async function handleExport() {
    setExportLoading(true);
    try { await exportCsv(); } finally { setExportLoading(false); }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <div className="flex-1 min-w-36">
          <label className="mb-1 block text-xs font-medium text-secure-gray">Search</label>
          <input value={filters.search ?? ''} onChange={e => setSearch(e.target.value)}
            placeholder="Name or role…"
            className="w-full rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm focus:border-celestial-blue focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-secure-gray">Status</label>
          <select value={filters.benchStatus ?? ''} onChange={e => setFilter('benchStatus', e.target.value || undefined)}
            className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm focus:border-celestial-blue focus:outline-none">
            <option value="">All</option>
            <option value="Bench">Bench</option>
            <option value="Allocated">Allocated</option>
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs font-medium text-secure-gray">Skills</label>
          <SkillsMultiSelect
            selected={skillInput ? skillInput.split(',').map(s => s.trim()).filter(Boolean) : []}
            onChange={skills => setSkills(skills.join(','))}
          />
        </div>
        <div className="flex gap-2">
          <input type="number" min={0} placeholder="Min exp" value={filters.minExp ?? ''} onChange={e => setFilter('minExp', e.target.value ? +e.target.value : undefined)}
            className="w-20 rounded-lg border border-[var(--border-default)] px-2 py-1.5 text-sm focus:border-celestial-blue focus:outline-none" />
          <input type="number" min={0} placeholder="Max exp" value={filters.maxExp ?? ''} onChange={e => setFilter('maxExp', e.target.value ? +e.target.value : undefined)}
            className="w-20 rounded-lg border border-[var(--border-default)] px-2 py-1.5 text-sm focus:border-celestial-blue focus:outline-none" />
        </div>
        <Button variant="secondary" size="sm" disabled={exportLoading} onClick={handleExport} className="flex items-center gap-1.5">
          <Download size={13} /> {exportLoading ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {/* States */}
      {query.isPending && <Spinner />}
      {query.isError   && <ErrorBanner message="Failed to load pool" onRetry={query.refetch} />}
      {!query.isPending && employees.length === 0 && <EmptyState title="No employees match filters" />}

      {/* Table */}
      {employees.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border-subtle)] bg-culture-gray text-xs font-medium text-secure-gray">
              <tr>
                <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('fullName')}>
                  Name <SortIcon col="fullName" current={filters.sortBy} />
                </th>
                <th className="px-4 py-3 text-left">Role / BU</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('experienceYears')}>
                  Exp <SortIcon col="experienceYears" current={filters.sortBy} />
                </th>
                <th className="px-4 py-3 text-left">Skills</th>
                <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('benchStatus')}>
                  Status <SortIcon col="benchStatus" current={filters.sortBy} />
                </th>
                <th className="px-4 py-3 text-left">Active IRC</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-culture-gray/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={emp.fullName} className="h-7 w-7 text-[10px] shrink-0" />
                      <span className="font-medium text-network-blue">{emp.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--fg-3)]">
                    <p>{emp.roleTitle}</p>
                    <p className="text-xs">{emp.businessUnit}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--fg-3)]">{emp.location}</td>
                  <td className="px-4 py-3 text-center">{emp.experienceYears}y</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {emp.skills.slice(0, 3).map(s => (
                        <span key={s} className="rounded-full border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-secure-gray">{s}</span>
                      ))}
                      {emp.skills.length > 3 && <span className="text-[10px] text-[var(--fg-3)]">+{emp.skills.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium',
                      emp.benchStatus === 'Bench' ? 'bg-commerce-green/10 text-commerce-green' : 'bg-celestial-blue/10 text-celestial-blue')}>
                      {emp.benchStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--fg-3)]">{emp.activeIrcCode ?? '—'}</td>
                  <td className="relative px-4 py-3">
                    <button onClick={() => setOpenMenu(openMenu === emp.id ? null : emp.id)}
                      className="rounded p-1 hover:bg-culture-gray text-secure-gray">
                      <MoreVertical size={14} />
                    </button>
                    {openMenu === emp.id && (
                      <div className="absolute right-4 top-8 z-20 w-40 rounded-lg border border-[var(--border-subtle)] bg-white py-1 text-xs shadow-md">
                        <button onClick={() => { navigate(`/employees/${emp.id}`); setOpenMenu(null); }}
                          className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray">View profile</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.pages > 1 && (
        <Pagination page={meta.page} pages={meta.pages} onChange={p => setFilter('page', p)} />
      )}
    </div>
  );
}
