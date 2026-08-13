import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorBanner, EmptyState } from '../../components/Feedback';
import { projectsApi } from '../../lib/api/projects.api';
import { SearchComposer } from './SearchComposer';
import { ResultCard } from './ResultCard';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { useAISearch } from './useAISearch';

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
  const [resultLimit,  setResultLimit]  = useState<5 | 10 | null>(null);
  const [expSort,      setExpSort]      = useState<'asc' | 'desc' | null>(null);

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsApi.list(),
  });

  const {
    results, jdFilename, isPending, error,
    loadingMessage, search, uploadJd, updateResult,
  } = useAISearch();

  // Auto-select first project when data loads (if not pre-selected via URL)
  useEffect(() => {
    if (selectedProject == null && projectsQ.data?.length) {
      setSelectedProject(projectsQ.data[0].id);
    }
  }, [projectsQ.data]);

  // Auto-select first Open IRC when project changes
  useEffect(() => {
    const project = projectsQ.data?.find(p => p.id === selectedProject);
    const firstOpen = project?.ircs.find(i => i.status === 'Open');
    setSelectedIrc(firstOpen?.id ?? null);
  }, [selectedProject, projectsQ.data]);

  function handleSubmit() {
    if (!selectedIrc) return;
    setResultLimit(null);
    setExpSort(null);
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
        {/* Staged loading */}
        {isPending && (
          <div className="flex items-center gap-2 py-4 text-sm text-secure-gray">
            <Loader2 size={15} className="animate-spin text-celestial-blue" />
            <span className="transition-opacity">{loadingMessage}</span>
          </div>
        )}

        {/* Error state */}
        {error && !isPending && (
          <ErrorBanner message="Search failed — try again" onRetry={handleSubmit} />
        )}

        {/* Empty state — before first search */}
        {!isPending && !error && results === null && (
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
          // Apply experience sort before slicing
          let ordered = [...results];
          if (expSort === 'desc') ordered.sort((a, b) => b.experienceYears - a.experienceYears);
          if (expSort === 'asc')  ordered.sort((a, b) => a.experienceYears - b.experienceYears);
          const visible = resultLimit ? ordered.slice(0, resultLimit) : ordered;
          return (
            <div className="space-y-4">
              {/* Result count + filters */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-[var(--fg-3)]">
                  {results.length} candidate{results.length !== 1 ? 's' : ''} matched
                  {jdFilename && <span className="ml-1 text-celestial-blue">· JD: {jdFilename}</span>}
                </p>
                <div className="ml-auto flex flex-wrap gap-1">
                  {/* Limit pills */}
                  {([5, 10, null] as const).map(n => (
                    <button key={String(n)} onClick={() => setResultLimit(n)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        resultLimit === n ? 'bg-network-blue text-white' : 'bg-level-gray text-secure-gray hover:bg-culture-gray'
                      }`}>
                      {n === null ? 'All' : `Top ${n}`}
                    </button>
                  ))}
                  <span className="text-level-gray">|</span>
                  {/* Experience sort */}
                  <button onClick={() => setExpSort(s => s === 'desc' ? 'asc' : 'desc')}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      expSort ? 'bg-celestial-blue text-white' : 'bg-level-gray text-secure-gray hover:bg-culture-gray'
                    }`}>
                    Exp {expSort === 'asc' ? '↑' : expSort === 'desc' ? '↓' : '↕'}
                  </button>
                </div>
              </div>
              {visible.map(r => (
                <ResultCard
                  key={r.employeeId}
                  result={r}
                  ircId={selectedIrc!}
                  onShortlisted={handleShortlisted}
                  onViewProfile={setProfileId}
                />
              ))}
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
