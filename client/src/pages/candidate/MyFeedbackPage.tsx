import { useQuery } from '@tanstack/react-query';
import { candidateApi } from '../../lib/api/candidate.api';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { cn } from '../../lib/utils/cn';

const RATING_COLORS: Record<string, string> = {
  'Strong yes': 'bg-commerce-green/10 text-commerce-green',
  'Yes':        'bg-commerce-green/10 text-commerce-green',
  'Exceeding':  'bg-commerce-green/10 text-commerce-green',
  'Meeting':    'bg-celestial-blue/10 text-celestial-blue',
  'Scheduled':  'bg-celestial-blue/10 text-celestial-blue',
  'No':         'bg-power-orange/10 text-power-orange',
  'Below':      'bg-charge-yellow/20 text-[#8A6A00]',
};

export function MyFeedbackPage() {
  const query = useQuery({ queryKey: ['my-feedback'], queryFn: () => candidateApi.feedback() });
  if (query.isPending) return <Spinner />;
  if (query.isError)   return <ErrorBanner message="Failed to load feedback" onRetry={query.refetch} />;
  if (!query.data?.length) return <EmptyState title="No feedback yet" description="Feedback appears here after each interview or screening round." />;
  return (
    <div className="space-y-3">
      {query.data.map(r => (
        <Card key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-network-blue">{r.roundName}</p>
              <p className="mt-0.5 text-sm text-[var(--fg-3)]">
                {r.pipelineCandidate?.irc.ircCode} · {r.pipelineCandidate?.irc.project.name}
              </p>
              <p className="mt-1 text-xs text-[var(--fg-3)]">
                {r.interviewer ?? 'TBD'} · {r.roundDate ? new Date(r.roundDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
            {r.rating && (
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', RATING_COLORS[r.rating] ?? 'bg-level-gray text-secure-gray')}>
                {r.rating}
              </span>
            )}
          </div>
          {r.comments && <p className="mt-3 text-sm text-secure-gray">{r.comments}</p>}
        </Card>
      ))}
    </div>
  );
}
