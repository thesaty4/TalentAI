import { useQuery } from '@tanstack/react-query';
import { candidateApi, type MyPipelineEntry } from '../../lib/api/candidate.api';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { cn } from '../../lib/utils/cn';

const STEPPER_STAGES = ['AI Shortlisted', 'Manager Screening', 'Internal Tech Evaluation', 'Client Interview', 'Selected'] as const;

const NEXT_STEP_MSG: Record<string, string> = {
  'AI Shortlisted':           'Your profile is under review. A manager will reach out to schedule a screening.',
  'Manager Screening':        'Your manager screening is confirmed. Check Upcoming for the schedule.',
  'Internal Tech Evaluation': "You're progressing to the technical evaluation stage.",
  'Client Interview':         "Excellent! You're meeting the client. Prepare thoroughly.",
  'Selected':                 'Congratulations — you have been selected! HR will reach out with next steps.',
  'Allocated':                'You are allocated to this project. Welcome aboard!',
  'Rejected':                 'You were not selected for this position. Thank you for applying.',
};

const RATING_COLORS: Record<string, string> = {
  'Strong yes': 'bg-commerce-green/10 text-commerce-green',
  'Yes':        'bg-commerce-green/10 text-commerce-green',
  'Exceeding':  'bg-commerce-green/10 text-commerce-green',
  'Meeting':    'bg-celestial-blue/10 text-celestial-blue',
  'Scheduled':  'bg-celestial-blue/10 text-celestial-blue',
  'No':         'bg-power-orange/10 text-power-orange',
  'Below':      'bg-charge-yellow/20 text-[#8A6A00]',
};

function StageStepper({ stage }: { stage: string }) {
  const activeIdx = STEPPER_STAGES.indexOf(stage as any);
  const isRejected = stage === 'Rejected';
  return (
    <div className="flex items-center gap-0">
      {STEPPER_STAGES.map((s, i) => {
        const done    = activeIdx > i;
        const current = activeIdx === i;
        return (
          <div key={s} className="flex items-center">
            <div className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors shrink-0',
              isRejected   ? 'bg-[#8A8C8E] text-white'
              : done       ? 'bg-commerce-green text-white'
              : current    ? 'bg-power-orange text-white'
              :              'bg-level-gray text-secure-gray')}>
              {done ? '✓' : i + 1}
            </div>
            {i < STEPPER_STAGES.length - 1 && (
              <div className={cn('h-0.5 w-8 transition-colors',
                done ? 'bg-commerce-green' : 'bg-level-gray')} />
            )}
          </div>
        );
      })}
      {isRejected && (
        <div className="ml-2 flex h-6 items-center rounded-full bg-power-orange/10 px-2 text-[10px] font-medium text-power-orange">
          Not selected
        </div>
      )}
    </div>
  );
}

function PipelineEntryCard({ entry }: { entry: MyPipelineEntry }) {
  const msg = NEXT_STEP_MSG[entry.stage] ?? '';
  return (
    <Card className="p-5 space-y-4">
      {/* IRC header */}
      <div>
        <p className="text-xs font-semibold text-celestial-blue">{entry.irc.ircCode}</p>
        <p className="font-semibold text-network-blue">{entry.irc.roleTitle}</p>
        <p className="text-sm text-[var(--fg-3)]">{entry.irc.project.name}</p>
      </div>

      {/* Stepper */}
      <div className="overflow-x-auto"><StageStepper stage={entry.stage} /></div>

      {/* What happens next */}
      {msg && (
        <div className="rounded-lg bg-culture-gray px-3 py-2.5 text-xs text-secure-gray">
          <span className="font-medium text-network-blue">What happens next: </span>{msg}
        </div>
      )}

      {/* Feedback timeline */}
      {entry.feedbackRounds.length > 0 && (
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
          <p className="text-xs font-medium text-secure-gray">Interview history</p>
          {entry.feedbackRounds.map(r => (
            <div key={r.id} className="flex items-start gap-3 text-xs">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-celestial-blue" />
              <div>
                <p className="font-medium text-network-blue">{r.roundName}</p>
                <p className="text-[var(--fg-3)]">
                  {r.interviewer} · {r.roundDate ? new Date(r.roundDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                </p>
                {r.rating && (
                  <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', RATING_COLORS[r.rating] ?? 'bg-level-gray text-secure-gray')}>
                    {r.rating}
                  </span>
                )}
                {r.comments && <p className="mt-1 text-[var(--fg-3)]">{r.comments}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function MyPipelinePage() {
  const query = useQuery({ queryKey: ['my-pipeline'], queryFn: () => candidateApi.myPipeline() });
  if (query.isPending) return <Spinner />;
  if (query.isError)   return <ErrorBanner message="Failed to load your pipeline" onRetry={query.refetch} />;
  if (!query.data?.length) return <EmptyState title="No applications yet" description="Visit Open IRCs to apply to open positions." />;
  return <div className="space-y-4">{query.data.map(e => <PipelineEntryCard key={e.id} entry={e} />)}</div>;
}
