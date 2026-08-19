import { useNavigate } from 'react-router-dom';
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '../../components/Card';
import { SkillsMultiSelect } from '../../components/SkillsMultiSelect';
import { ErrorBanner, Spinner } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { usePool } from './usePool';

const SORTABLE = new Set(['Name', 'Exp', 'Status']);

function SortIcon({ col, current, order }: { col: string; current?: string; order?: string }) {
  if (col !== current) return <ChevronDown size={11} className="text-[var(--fg-3)]" />;
  return order === 'asc'
    ? <ChevronUp   size={11} className="text-power-orange" />
    : <ChevronDown size={11} className="text-power-orange" />;
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
    <div className="flex flex-col gap-3.5">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-3)]" />
          <input
            value={filters.search ?? ''}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or role…"
            className="w-56 rounded-lg border border-[var(--border-default)] bg-white py-2 pl-8 pr-3 text-sm text-network-blue outline-none focus:border-celestial-blue"
          />
        </div>
        {/* Status filter */}
        <select
          value={filters.benchStatus ?? ''}
          onChange={e => setFilter('benchStatus', e.target.value || undefined)}
          className="rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-network-blue outline-none focus:border-celestial-blue"
        >
          <option value="">All Status</option>
          <option value="Bench">Bench</option>
          <option value="Allocated">Allocated</option>
        </select>
        {/* Exp range */}
        <div className="flex items-center gap-1.5">
          <input
            type="number" min={0} placeholder="Min exp"
            value={filters.minExp ?? ''}
            onChange={e => setFilter('minExp', e.target.value ? +e.target.value : undefined)}
            className="w-20 rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-2 text-sm text-network-blue outline-none focus:border-celestial-blue"
          />
          <span className="text-xs text-[var(--fg-3)]">–</span>
          <input
            type="number" min={0} placeholder="Max exp"
            value={filters.maxExp ?? ''}
            onChange={e => setFilter('maxExp', e.target.value ? +e.target.value : undefined)}
            className="w-20 rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-2 text-sm text-network-blue outline-none focus:border-celestial-blue"
          />
        </div>
        {/* Skills multi-select */}
        <div className="min-w-[200px] flex-1">
          <SkillsMultiSelect
            selected={skillInput ? skillInput.split(',').map(s => s.trim()).filter(Boolean) : []}
            onChange={skills => setSkills(skills.join(','))}
            placeholder="Filter by skills…"
          />
        </div>
        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exportLoading}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-network-blue transition-colors hover:bg-culture-gray disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={14} /> Export
        </button>
      </div>

      {/* ── States ── */}
      {query.isPending && <Spinner />}
      {query.isError   && <ErrorBanner message="Failed to load pool" onRetry={query.refetch} />}

      {/* ── Table card ── */}
      {!query.isPending && (
        <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-white shadow-sm">
          {/* Header row */}
          <div className="grid border-b border-[var(--border-default)] bg-culture-gray px-4 py-3"
            style={{ gridTemplateColumns: '1.5fr 0.8fr 1fr 0.8fr 1fr 1.3fr 0.5fr' }}>
            {['Name', 'Exp', 'Skills', 'Location', 'IRC', 'Status', ''].map(col => (
              <div key={col} className="flex items-center gap-1">
                {col && (
                  <button
                    onClick={() => SORTABLE.has(col) && toggleSort(
                      col === 'Name' ? 'fullName' : col === 'Exp' ? 'experienceYears' : 'benchStatus'
                    )}
                    className="flex items-center gap-1 border-none bg-transparent p-0 text-[11px] font-bold uppercase tracking-wide text-[var(--fg-3)] cursor-pointer"
                  >
                    {col}
                    {SORTABLE.has(col) && (
                      <SortIcon
                        col={col === 'Name' ? 'fullName' : col === 'Exp' ? 'experienceYears' : 'benchStatus'}
                        current={filters.sortBy}
                        order={filters.sortOrder}
                      />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Empty state */}
          {employees.length === 0 && (
            <p className="py-10 text-center text-sm text-[var(--fg-3)]">
              No matching candidates. Try adjusting your filters.
            </p>
          )}

          {/* Rows */}
          {employees.map(emp => (
            <div
              key={emp.id}
              className="grid items-center border-t border-[var(--border-subtle)] px-4 py-3.5 text-sm transition-colors hover:bg-culture-gray"
              style={{ gridTemplateColumns: '1.5fr 0.8fr 1fr 0.8fr 1fr 1.3fr 0.5fr' }}
            >
              {/* Name */}
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={emp.fullName} className="h-8 w-8 shrink-0 text-[11px]" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-network-blue">{emp.fullName}</p>
                  <p className="truncate text-xs text-[var(--fg-3)]">{emp.employeeCode}</p>
                </div>
              </div>
              {/* Exp */}
              <span className="text-secure-gray">{emp.experienceYears}y</span>
              {/* Skills */}
              <div className="flex flex-wrap gap-1">
                {emp.skills.slice(0, 3).map(s => (
                  <span key={s} className="rounded-full border border-[var(--border-subtle)] bg-culture-gray px-1.5 py-0.5 text-[10px] font-semibold text-secure-gray">
                    {s}
                  </span>
                ))}
                {emp.skills.length > 3 && (
                  <span className="text-[10px] text-[var(--fg-3)]">+{emp.skills.length - 3}</span>
                )}
              </div>
              {/* Location */}
              <span className="truncate text-secure-gray">{emp.location}</span>
              {/* Active IRC */}
              <span className="text-xs text-[var(--fg-3)]">{emp.activeIrcCode ?? '—'}</span>
              {/* Status pill */}
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                emp.benchStatus === 'Bench'
                  ? 'bg-power-orange/10 text-power-orange'
                  : 'bg-level-gray/50 text-secure-gray'
              }`}>
                {emp.benchStatus}
              </span>
              {/* Actions */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === emp.id ? null : emp.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-culture-gray text-base text-secure-gray transition-colors hover:bg-level-gray"
                >
                  ⋮
                </button>
                {openMenu === emp.id && (
                  <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white shadow-md">
                    <button
                      onClick={() => { navigate(`/employees/${emp.id}`); setOpenMenu(null); }}
                      className="block w-full px-3 py-2 text-left text-sm text-network-blue transition-colors hover:bg-culture-gray"
                    >
                      View profile
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      {meta && meta.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-[var(--fg-3)]">
            Showing {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </span>
          {meta.pages > 1 && (
            <Pagination page={meta.page} pages={meta.pages} onChange={p => setFilter('page', p)} />
          )}
        </div>
      )}
    </div>
  );
}
