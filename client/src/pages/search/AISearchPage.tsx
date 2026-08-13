import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorBanner, EmptyState } from '../../components/Feedback';
import { projectsApi } from '../../lib/api/projects.api';
import { SearchComposer } from './SearchComposer';
import { ResultCard } from './ResultCard';
import { useAISearch } from './useAISearch';

export function AISearchPage() {
  const [params] = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<number | null>(() => {
    const v = params.get('projectId'); return v ? +v : null;
  });
  const [selectedIrc, setSelectedIrc] = useState<number | null>(null);
  const [query,  setQuery]  = useState('');
  const [scope,  setScope]  = useState<'all' | 'applied'>('all');

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
    search({ ircId: selectedIrc, query: query.trim() || undefined, scope });
  }

  function handleJdUpload(file: File) {
    if (!selectedIrc) return;
    uploadJd({ ircId: selectedIrc, scope, file, query: query.trim() || undefined });
  }

  function handleShortlisted(employeeId: number, pipelineCandidateId: number) {
    updateResult(employeeId, { alreadyInPipeline: true, pipelineCandidateId });
  }

  return (
    <div className="-m-6 flex min-h-full flex-col">
      <SearchComposer
        projects={projectsQ.data ?? []}
        selectedProject={selectedProject}
        selectedIrc={selectedIrc}
        query={query}
        scope={scope}
        jdFilename={jdFilename}
        isPending={isPending}
        onProjectChange={setSelectedProject}
        onIrcChange={setSelectedIrc}
        onQueryChange={setQuery}
        onScopeChange={setScope}
        onSubmit={handleSubmit}
        onJdUpload={handleJdUpload}
        onJdRemove={() => {}}
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
        {!isPending && results && results.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--fg-3)]">
              {results.length} candidate{results.length !== 1 ? 's' : ''} matched
              {jdFilename && <span className="ml-1 text-celestial-blue">· JD: {jdFilename}</span>}
            </p>
            {results.map(r => (
              <ResultCard
                key={r.employeeId}
                result={r}
                ircId={selectedIrc!}
                onShortlisted={handleShortlisted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
