import { cn } from '../lib/utils/cn';
import { STAGE_COLORS } from '../lib/constants/pipeline.constants';

export function StageChip({ stage }: { stage: string }) {
  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', STAGE_COLORS[stage] ?? 'bg-level-gray text-secure-gray')}>
      {stage}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  );
}
