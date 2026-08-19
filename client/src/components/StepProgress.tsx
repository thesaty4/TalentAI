import { Check, X } from 'lucide-react';
import { cn } from '../lib/utils/cn';

export type StepStatus = 'pending' | 'active' | 'done' | 'failed';

export interface Step {
  label: string;
  status: StepStatus;
  durationMs?: number;
}

export interface StepProgressProps {
  icon: React.ReactNode;
  title: string;
  steps: Step[];
  footerNote?: string;
  timingNote?: string;
}

// Primary token drives both the done-fill and the active ring
const ICON_CLS: Record<StepStatus, string> = {
  done:    'bg-power-orange',
  active:  'bg-white ring-2 ring-power-orange',
  pending: 'bg-level-gray',
  failed:  'bg-energy-orange',
};

const LABEL_CLS: Record<StepStatus, string> = {
  done:    'text-secure-gray',
  active:  'text-network-blue font-medium',
  pending: 'text-level-gray',
  failed:  'text-energy-orange font-medium',
};

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function StepProgress({ icon, title, steps, footerNote, timingNote }: StepProgressProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</div>
        <span className="text-sm font-semibold text-network-blue">{title}</span>
      </div>

      {/* Panel — surface token, 16px radius, no border */}
      <div className="rounded-2xl bg-culture-gray px-5 py-4">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-stretch gap-3.5">

            {/* Timeline column: icon + vertical connector */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                ICON_CLS[step.status],
              )}>
                {step.status === 'done'   && <Check size={11} strokeWidth={3} className="text-white" />}
                {step.status === 'failed' && <X     size={11} strokeWidth={3} className="text-white" />}
                {/* active: ring-only icon; header spinner already signals in-progress */}
              </div>
              {i < steps.length - 1 && (
                <div className="mt-1.5 w-px flex-1 bg-[var(--border-subtle)]" />
              )}
            </div>

            {/* Content */}
            <div className={cn(
              'flex flex-1 items-center gap-2 transition-all duration-200',
              i < steps.length - 1 ? 'pb-4' : 'pb-0',
            )}>
              <span className={cn('flex-1 text-[13px] leading-snug', LABEL_CLS[step.status])}>
                {step.label}
              </span>
              {step.status === 'done' && step.durationMs !== undefined && (
                <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--fg-3)]">
                  {formatDuration(step.durationMs)}
                </span>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* Footer captions — outside the panel, muted text tokens */}
      {(footerNote || timingNote) && (
        <div className="space-y-0.5 px-1">
          {footerNote && (
            <p className="text-xs leading-relaxed text-secure-gray">{footerNote}</p>
          )}
          {timingNote && (
            <p className="text-xs text-[var(--fg-3)]">{timingNote}</p>
          )}
        </div>
      )}
    </div>
  );
}
