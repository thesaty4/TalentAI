import { useNavigate } from 'react-router-dom';
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { SkillsMultiSelect } from '../../components/SkillsMultiSelect';
import { ErrorBanner, Spinner } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { usePool } from './usePool';

const C = { fg1: '#181A24', fg2: '#484F6B', fg3: '#858A9B', border: '#C8CAD3',
            headerBg: '#F2F3F6', accent: '#FF5F2D', danger: '#CF3708' };

const GRID = '1.5fr 0.8fr 1fr 0.8fr 1fr 1.3fr 0.5fr';
const COLS = ['Name', 'Exp', 'Skills', 'Location', 'IRC', 'Status', ''];

function avatar(name: string) {
  const init = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', background: '#00018B',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>{init}</div>
  );
}

function SortIcon({ col, current, order }: { col: string; current?: string; order?: string }) {
  if (col !== current) return <ChevronDown size={11} color={C.fg3} />;
  return order === 'asc' ? <ChevronUp size={11} color={C.accent} /> : <ChevronDown size={11} color={C.accent} />;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Search size={14} color={C.fg3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={filters.search ?? ''} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or role…"
            style={{
              padding: '9px 13px 9px 34px', border: `1px solid ${C.border}`, borderRadius: 9,
              fontSize: 13, color: C.fg1, outline: 'none', background: '#fff', width: 220,
            }} />
        </div>
        {/* Status filter */}
        <select value={filters.benchStatus ?? ''} onChange={e => setFilter('benchStatus', e.target.value || undefined)}
          style={{
            padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 9,
            fontSize: 13, color: C.fg1, background: '#fff', cursor: 'pointer',
          }}>
          <option value="">All Status</option>
          <option value="Bench">Bench</option>
          <option value="Allocated">Allocated</option>
        </select>
        {/* Exp range */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="number" min={0} placeholder="Min exp" value={filters.minExp ?? ''}
            onChange={e => setFilter('minExp', e.target.value ? +e.target.value : undefined)}
            style={{ width: 76, padding: '9px 10px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.fg1, outline: 'none' }} />
          <span style={{ color: C.fg3, fontSize: 12 }}>–</span>
          <input type="number" min={0} placeholder="Max exp" value={filters.maxExp ?? ''}
            onChange={e => setFilter('maxExp', e.target.value ? +e.target.value : undefined)}
            style={{ width: 76, padding: '9px 10px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.fg1, outline: 'none' }} />
        </div>
        {/* Skills multi-select */}
        <div style={{ flex: '1 1 200px', minWidth: 200 }}>
          <SkillsMultiSelect
            selected={skillInput ? skillInput.split(',').map(s => s.trim()).filter(Boolean) : []}
            onChange={skills => setSkills(skills.join(','))}
            placeholder="Filter by skills…"
          />
        </div>
        {/* Export */}
        <button onClick={handleExport} disabled={exportLoading} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px',
          border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13,
          background: '#fff', color: C.fg1, cursor: 'pointer', marginLeft: 'auto',
        }}>
          <Download size={14} /> Export
        </button>
      </div>

      {/* ── States ── */}
      {query.isPending && <Spinner />}
      {query.isError   && <ErrorBanner message="Failed to load pool" onRetry={query.refetch} />}

      {/* ── Table card ── */}
      {!query.isPending && (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: GRID,
            background: C.headerBg, padding: '12px 18px',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {COLS.map((col) => (
              <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {col && (
                  <button onClick={() => col && ['Name','Exp','Status'].includes(col) && toggleSort(
                    col === 'Name' ? 'fullName' : col === 'Exp' ? 'experienceYears' : 'benchStatus'
                  )} style={{
                    display: 'flex', alignItems: 'center', gap: 4, background: 'none',
                    border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.03em', color: C.fg3,
                  }}>
                    {col}
                    {['Name','Exp','Status'].includes(col) && (
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

          {/* Rows */}
          {employees.length === 0 && (
            <div style={{ padding: '40px 18px', textAlign: 'center', fontSize: 13, color: C.fg3 }}>
              No matching candidates. Try adjusting your filters.
            </div>
          )}
          {employees.map(emp => (
            <div key={emp.id} style={{
              display: 'grid', gridTemplateColumns: GRID,
              padding: '14px 18px', borderTop: `1px solid ${C.border}`,
              alignItems: 'center', fontSize: 13,
            }} onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
               onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {avatar(emp.fullName)}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: C.fg1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.fullName}</p>
                  <p style={{ fontSize: 11.5, color: C.fg3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.employeeCode}</p>
                </div>
              </div>
              {/* Exp */}
              <span style={{ color: C.fg2 }}>{emp.experienceYears}y</span>
              {/* Skills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {emp.skills.slice(0, 3).map(s => (
                  <span key={s} style={{
                    borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 600,
                    background: '#F2F3F6', color: C.fg2, border: `1px solid ${C.border}`,
                  }}>{s}</span>
                ))}
                {emp.skills.length > 3 && <span style={{ fontSize: 10, color: C.fg3 }}>+{emp.skills.length - 3}</span>}
              </div>
              {/* Location */}
              <span style={{ color: C.fg2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.location}</span>
              {/* Active IRC */}
              <span style={{ color: C.fg3, fontSize: 12 }}>{emp.activeIrcCode ?? '—'}</span>
              {/* Status pill */}
              <span style={{
                display: 'inline-block', borderRadius: 999, padding: '3px 10px',
                fontSize: 11, fontWeight: 700,
                background: emp.benchStatus === 'Bench' ? 'rgba(255,95,45,0.12)' : 'rgba(133,138,155,0.15)',
                color:      emp.benchStatus === 'Bench' ? '#FF5F2D'               : '#858A9B',
              }}>{emp.benchStatus}</span>
              {/* Actions */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setOpenMenu(openMenu === emp.id ? null : emp.id)} style={{
                  width: 30, height: 30, borderRadius: 7, background: '#F2F3F6',
                  border: 'none', cursor: 'pointer', fontSize: 16, color: C.fg2,
                }}>⋮</button>
                {openMenu === emp.id && (
                  <div style={{
                    position: 'absolute', right: 0, top: 34, zIndex: 20, width: 160,
                    background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
                    boxShadow: '0 14px 32px rgba(24,26,36,0.10)', padding: '4px',
                  }}>
                    <button onClick={() => { navigate(`/employees/${emp.id}`); setOpenMenu(null); }} style={{
                      display: 'block', width: '100%', padding: '8px 12px', border: 'none',
                      background: 'none', cursor: 'pointer', fontSize: 13, color: C.fg1,
                      textAlign: 'left', borderRadius: 7,
                    }}>View profile</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      {meta && meta.total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: C.fg3 }}>
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
