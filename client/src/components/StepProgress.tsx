import { Check, Loader2, X } from 'lucide-react';
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

const ICON_CLS: Record<StepStatus, string> = {
  done:    'bg-commerce-green',
  active:  'bg-white ring-2 ring-celestial-blue',
  pending: 'bg-culture-gray',
  failed:  'bg-power-orange',
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</div>
        <span className="text-sm font-semibold text-network-blue">{title}</span>
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white shadow-sm">
        {steps.map((step, i) => (
          <div
            key={step.label}
            className={cn(
              'flex items-center gap-3.5 px-5 py-3.5 transition-all duration-200',
              i < steps.length - 1 && 'border-b border-[var(--border-subtle)]',
              step.status === 'active' && 'bg-celestial-blue/5',
              step.status === 'failed' && 'bg-power-orange/5',
            )}
          >
            {/* Status indicator */}
            <div className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
              ICON_CLS[step.status],
            )}>
              {step.status === 'done'   && <Check   size={11} strokeWidth={3} className="text-white" />}
              {step.status === 'active' && <Loader2 size={11} className="animate-spin text-celestial-blue" />}
              {step.status === 'failed' && <X       size={11} strokeWidth={3} className="text-white" />}
            </div>

            {/* Label */}
            <span className={cn('flex-1 text-[13px] leading-snug transition-all duration-200', LABEL_CLS[step.status])}>
              {step.label}
            </span>

            {/* Elapsed time pill — done rows only */}
            {step.status === 'done' && step.durationMs !== undefined && (
              <span className="rounded-full bg-commerce-green/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-commerce-green">
                {formatDuration(step.durationMs)}
              </span>
            )}
          </div>
        ))}
      </div>

      {(footerNote || timingNote) && (
        <div className="space-y-0.5">
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
