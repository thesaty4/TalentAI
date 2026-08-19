import { Loader2, Download, LayoutGrid, List, AlertTriangle, ChevronDown, MapPin, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorBanner, EmptyState } from '../../components/Feedback';
import { StepProgress } from '../../components/StepProgress';
import { projectsApi } from '../../lib/api/projects.api';
import { SearchComposer } from './SearchComposer';
import { ResultCard } from './ResultCard';
import { ResultTable } from './ResultTable';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { useAISearch } from './useAISearch';

type SortOption = '' | 'match-desc' | 'match-asc' | 'exp-desc' | 'exp-asc' | 'availDate-asc' | 'availDate-desc';

export function AISearchPage() {
  const [params] = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<number | null>(() => {
    const v = params.get('projectId'); return v ? +v : null;
  });
  const [selectedIrc, setSelectedIrc] = useState<number | null>(null);
  const [query,   setQuery]   = useState('');
  const [scope,   setScope]   = useState<'all' | 'applied'>('all');
  const [jdFile,       setJdFile]       = useState<File | null>(null);
  const [profileId,    setProfileId]    = useState<number | null>(null);
  const [resultLimit,      setResultLimit]      = useState<3 | 10 | null>(null);
  const [activeSort,       setActiveSort]       = useState<SortOption>('');
  const [viewMode,         setViewMode]         = useState<'card' | 'table'>('card');
  const [locationFilter,   setLocationFilter]   = useState<string[]>([]);
  const [poolStatusFilter, setPoolStatusFilter] = useState<('InPool' | 'ForecastToPool')[]>([]);
  const [locationDropOpen,   setLocationDropOpen]   = useState(false);
  const [poolStatusDropOpen, setPoolStatusDropOpen] = useState(false);
  const locationDropRef   = useRef<HTMLDivElement>(null);
  const poolStatusDropRef = useRef<HTMLDivElement>(null);

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsApi.list(),
  });

  const {
    results, jdFilename, steps, mismatch, isPending, error,
    search, uploadJd, updateResult,
  } = useAISearch();

  // Auto-select first Open IRC when project changes
  useEffect(() => {
    const project = projectsQ.data?.find(p => p.id === selectedProject);
    const firstOpen = project?.ircs.find(i => i.status === 'Open');
    setSelectedIrc(firstOpen?.id ?? null);
  }, [selectedProject, projectsQ.data]);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!locationDropRef.current?.contains(e.target as Node)) setLocationDropOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!poolStatusDropRef.current?.contains(e.target as Node)) setPoolStatusDropOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function handleSubmit() {
    if (!selectedIrc) return;
    setResultLimit(null);
    setActiveSort('');
    setLocationFilter([]);
    setPoolStatusFilter([]);
    if (jdFile) {
      // User attached a JD — run the JD-aware search path
      uploadJd({ ircId: selectedIrc, scope, file: jdFile, query: query.trim() || undefined });
    } else {
      search({ ircId: selectedIrc, query: query.trim() || undefined, scope });
    }
  }

  // Store file in state only — do NOT trigger search on upload (#8)
  function handleJdUpload(file: File) {
    setJdFile(file);
  }

  function handleJdRemove() {
    setJdFile(null);
  }

  function handleShortlisted(employeeId: number, pipelineCandidateId: number) {
    updateResult(employeeId, { alreadyInPipeline: true, pipelineCandidateId });
  }

  function buildVisible() {
    if (!results) return [];
    let pool = [...results];
    if (locationFilter.length > 0)
      pool = pool.filter(r => locationFilter.includes(r.location));
    if (poolStatusFilter.length > 0)
      pool = pool.filter(r => poolStatusFilter.includes(r.availableDate ? 'ForecastToPool' : 'InPool'));
    if (activeSort === 'match-desc')          pool.sort((a, b) => b.matchPct - a.matchPct);
    else if (activeSort === 'match-asc')      pool.sort((a, b) => a.matchPct - b.matchPct);
    else if (activeSort === 'exp-desc')       pool.sort((a, b) => b.experienceYears - a.experienceYears);
    else if (activeSort === 'exp-asc')        pool.sort((a, b) => a.experienceYears - b.experienceYears);
    else if (activeSort === 'availDate-asc')  pool.sort((a, b) => (a.availableDate ?? '9999').localeCompare(b.availableDate ?? '9999'));
    else if (activeSort === 'availDate-desc') pool.sort((a, b) => (b.availableDate ?? '').localeCompare(a.availableDate ?? ''));
    return resultLimit ? pool.slice(0, resultLimit) : pool;
  }

  function handleExportCsv() {
    const visible = buildVisible();
    const header  = 'Name,Role,BU,Location,Exp (yrs),Match %,Why Recommend,Skills,Available Date,In Pipeline';
    const rows    = visible.map(r => [
      `"${r.fullName}"`,
      `"${r.roleTitle}"`,
      `"${r.businessUnit}"`,
      r.location,
      r.experienceYears,
      r.matchPct,
      `"${r.whyRecommend.replace(/"/g, '""')}"`,
      `"${r.skills.slice(0, 6).join('; ')}"`,
      r.availableDate ?? '—',
      r.alreadyInPipeline ? 'Yes' : 'No',
    ].join(','));
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'ai-search-results.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="-m-6 flex min-h-full flex-col bg-culture-gray">
        <SearchComposer
        projects={projectsQ.data ?? []}
        selectedProject={selectedProject}
        selectedIrc={selectedIrc}
        query={query}
        scope={scope}
        jdFilename={jdFile?.name ?? null}
        isPending={isPending}
        onProjectChange={setSelectedProject}
        onIrcChange={setSelectedIrc}
        onQueryChange={setQuery}
        onScopeChange={setScope}
        onSubmit={handleSubmit}
        onJdUpload={handleJdUpload}
        onJdRemove={handleJdRemove}
      />

      <div className="flex-1 p-6">
        {/* Step progress — shown while search is in-flight or on scope mismatch */}
        {(isPending || !!mismatch) && (
          <StepProgress
            icon={
              mismatch
                ? <AlertTriangle size={14} className="text-charge-yellow" />
                : <Loader2 size={14} className="animate-spin text-celestial-blue" />
            }
            title="Searching candidates"
            steps={steps}
            footerNote={!mismatch ? "Evidence is retrieved before ranking, so every recommendation traces back to real delivery work \u2014 and every gap is named." : undefined}
            timingNote={!mismatch ? "This may take 20\u201330 seconds depending on pool size." : undefined}
          />
        )}

        {/* Error state */}
        {error && !mismatch && !isPending && (
          <ErrorBanner message="Search failed — try again" onRetry={handleSubmit} />
        )}

        {/* MISMATCH — query is outside IRC/JD scope */}
        {mismatch && !isPending && (
          <div className="mt-4 rounded-lg border border-charge-yellow/40 bg-charge-yellow/15 p-4">
            <p className="text-sm font-medium text-network-blue">Query outside IRC/JD scope</p>
            <p className="mt-1 text-sm text-secure-gray">{mismatch}</p>
          </div>
        )}

        {/* Empty state — before first search */}
        {!isPending && !error && !mismatch && results === null && (
          <EmptyState
            title="Ready to search"
            description="Type a requirement, upload a JD, or select an IRC above to see AI-ranked matches."
          />
        )}

        {/* Empty results */}
        {!isPending && results !== null && results.length === 0 && (
          <EmptyState title="No matches found" description="Try broadening the requirement or switching to All scope." />
        )}

        {/* Results */}
        {!isPending && results && results.length > 0 && (() => {
          const visible      = buildVisible();
          const allLocations = [...new Set(results.map(r => r.location))].sort();
          const hasInPool    = results.some(r => !r.availableDate);
          const hasForecast  = results.some(r => !!r.availableDate);
          return (
            <div className="space-y-4">
              {/* Result count + controls */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-[var(--fg-3)]">
                  {visible.length}/{results.length} candidate{results.length !== 1 ? 's' : ''}
                  {jdFilename && <span className="ml-1 text-celestial-blue">· JD: {jdFilename}</span>}
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-2">

                  {/* Location filter */}
                  <div ref={locationDropRef} className="relative">
                    <button onClick={() => setLocationDropOpen(o => !o)}
                      className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                        locationFilter.length > 0 ? 'border-celestial-blue bg-celestial-blue/5 text-celestial-blue' : 'border-[var(--border-subtle)] bg-white text-secure-gray hover:bg-culture-gray'
                      }`}>
                      <MapPin size={12} className="shrink-0" />
                      Location{locationFilter.length > 0 ? ` (${locationFilter.length})` : ''}
                      <ChevronDown size={10} />
                    </button>
                    {locationDropOpen && (
                      <div className="absolute left-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-[var(--border-subtle)] bg-white shadow-md">
                        <div className="border-b border-[var(--border-subtle)] px-3 py-1.5">
                          <button onClick={() => setLocationFilter([])} className="text-[10px] font-medium text-power-orange hover:underline">Clear</button>
                        </div>
                        {allLocations.map(loc => (
                          <label key={loc} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-culture-gray">
                            <input type="checkbox" checked={locationFilter.includes(loc)}
                              onChange={e => setLocationFilter(prev => e.target.checked ? [...prev, loc] : prev.filter(l => l !== loc))}
                              className="h-3.5 w-3.5 rounded accent-celestial-blue" />
                            <span className="text-xs">{loc}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pool Status filter */}
                  <div ref={poolStatusDropRef} className="relative">
                    <button onClick={() => setPoolStatusDropOpen(o => !o)}
                      className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                        poolStatusFilter.length > 0 ? 'border-celestial-blue bg-celestial-blue/5 text-celestial-blue' : 'border-[var(--border-subtle)] bg-white text-secure-gray hover:bg-culture-gray'
                      }`}>
                      <Users size={12} className="shrink-0" />
                      Pool Status{poolStatusFilter.length > 0 ? ` (${poolStatusFilter.length})` : ''}
                      <ChevronDown size={10} />
                    </button>
                    {poolStatusDropOpen && (
                      <div className="absolute left-0 top-full z-30 mt-1 min-w-[170px] rounded-lg border border-[var(--border-subtle)] bg-white shadow-md">
                        <div className="border-b border-[var(--border-subtle)] px-3 py-1.5">
                          <button onClick={() => setPoolStatusFilter([])} className="text-[10px] font-medium text-power-orange hover:underline">Clear</button>
                        </div>
                        {hasInPool && (
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-culture-gray">
                            <input type="checkbox" checked={poolStatusFilter.includes('InPool')}
                              onChange={e => setPoolStatusFilter(prev => e.target.checked ? [...prev, 'InPool'] : prev.filter(s => s !== 'InPool'))}
                              className="h-3.5 w-3.5 rounded accent-celestial-blue" />
                            <span className="text-xs">In Pool</span>
                          </label>
                        )}
                        {hasForecast && (
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-culture-gray">
                            <input type="checkbox" checked={poolStatusFilter.includes('ForecastToPool')}
                              onChange={e => setPoolStatusFilter(prev => e.target.checked ? [...prev, 'ForecastToPool'] : prev.filter(s => s !== 'ForecastToPool'))}
                              className="h-3.5 w-3.5 rounded accent-celestial-blue" />
                            <span className="text-xs">Forecast to Pool</span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  <span className="text-level-gray">|</span>

                  {/* Single sort dropdown — "No Sort" restores original AI Search order */}
                  <label className="flex items-center gap-1.5 text-xs text-secure-gray">
                    Sort by:
                    <select
                      value={activeSort}
                      onChange={e => setActiveSort(e.target.value as SortOption)}
                      className={`h-8 rounded-lg border px-2 text-xs focus:outline-none focus:border-celestial-blue ${
                        activeSort ? 'border-celestial-blue bg-celestial-blue/5 font-medium text-network-blue' : 'border-[var(--border-subtle)] bg-white text-secure-gray'
                      }`}>
                      <option value="">No Sort</option>
                      <option value="match-desc">Match % — High to Low</option>
                      <option value="match-asc">Match % — Low to High</option>
                      <option value="exp-desc">Experience — High to Low</option>
                      <option value="exp-asc">Experience — Low to High</option>
                      <option value="availDate-asc">Available Date — Earliest First</option>
                      <option value="availDate-desc">Available Date — Latest First</option>
                    </select>
                  </label>

                  <span className="text-level-gray">|</span>

                  {/* Result count dropdown */}
                  <select
                    value={resultLimit ?? ''}
                    onChange={e => setResultLimit(e.target.value === '' ? null : Number(e.target.value) as 3 | 10)}
                    className="h-8 rounded-lg border border-[var(--border-subtle)] bg-white px-2.5 text-xs text-secure-gray focus:border-celestial-blue focus:outline-none">
                    <option value="">Show Candidates</option>
                    <option value="3">Top 3</option>
                    <option value="10">Top 10</option>
                  </select>

                  <span className="text-level-gray">|</span>

                  {/* Export — exports the currently visible filtered/sorted set */}
                  <button onClick={handleExportCsv}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-white px-3 text-xs font-medium text-secure-gray hover:bg-culture-gray">
                    <Download size={12} /> Export
                  </button>
                  <span className="text-level-gray">|</span>

                  {/* View switcher */}
                  <button onClick={() => setViewMode('card')}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${viewMode === 'card' ? 'bg-network-blue text-white' : 'text-secure-gray hover:bg-culture-gray'}`}
                    title="Card view">
                    <LayoutGrid size={13} />
                  </button>
                  <button onClick={() => setViewMode('table')}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${viewMode === 'table' ? 'bg-network-blue text-white' : 'text-secure-gray hover:bg-culture-gray'}`}
                    title="Table view">
                    <List size={13} />
                  </button>
                </div>
              </div>
              {viewMode === 'table' ? (
                <ResultTable results={visible} ircId={selectedIrc!}
                  onShortlisted={handleShortlisted} onViewProfile={setProfileId} />
              ) : (
                visible.map(r => (
                  <ResultCard key={r.employeeId} result={r} ircId={selectedIrc!}
                    onShortlisted={handleShortlisted} onViewProfile={setProfileId} />
                ))
              )}
            </div>
          );
        })()}
      </div>
    </div>

    {profileId !== null && (
      <EmployeeProfileModal employeeId={profileId} onClose={() => setProfileId(null)} />
    )}
    </>
  );
}
