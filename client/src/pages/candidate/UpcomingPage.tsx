import { useQuery } from '@tanstack/react-query';
import { Calendar, Video } from 'lucide-react';
import { candidateApi } from '../../lib/api/candidate.api';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function UpcomingPage() {
  const query = useQuery({ queryKey: ['upcoming'], queryFn: () => candidateApi.upcoming() });
  if (query.isPending) return <Spinner />;
  if (query.isError)   return <ErrorBanner message="Failed to load upcoming sessions" onRetry={query.refetch} />;
  if (!query.data?.length) return (
    <EmptyState
      title="No interviews scheduled yet"
      description="Check back after your profile moves to screening."
    />
  );
  return (
    <div className="space-y-3">
      {query.data.map(r => (
        <Card key={r.id} className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-celestial-blue/10 text-celestial-blue">
              <Calendar size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-network-blue">{r.roundName}</p>
              <p className="mt-0.5 text-sm text-secure-gray">
                {r.roundDate ? formatDateTime(r.roundDate) : 'TBD'}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--fg-3)]">
                <span className="flex items-center gap-1"><Video size={11} /> Video call</span>
                {r.interviewer && <span>With: {r.interviewer}</span>}
                {r.pipelineCandidate && (
                  <span>{r.pipelineCandidate.irc.roleTitle} · {r.pipelineCandidate.irc.project.name}</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
