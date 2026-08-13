import { STAGE_HEX } from '../lib/constants/pipeline.constants';

// Stage pill: solid color text + same color at 12% opacity background
export function StageChip({ stage }: { stage: string }) {
  const hex = STAGE_HEX[stage] ?? '#8A8C8E';
  return (
    <span style={{
      display: 'inline-block', borderRadius: 999, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.01em',
      background: hex + '1F',   // ~12% opacity hex suffix
      color: hex,
      border: `1px solid ${hex}33`,  // ~20% opacity border
    }}>
      {stage}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className ?? ''}`}>
      {children}
    </span>
  );
}
