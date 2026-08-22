import { cn } from '../lib/utils/cn';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #C8CAD3', borderRadius: 12 }}
      className={cn('shadow-sm', className)}>
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub, accent, onClick }: { label: string; value: string | number; sub?: string; accent?: string; onClick?: () => void }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #C8CAD3', borderRadius: 12, padding: '20px 18px' }}
      className={`shadow-sm${onClick ? ' cursor-pointer hover:border-power-orange transition-colors' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#858A9B', marginBottom: 10 }}>
        {label}
      </p>
      <p style={{ fontSize: 32, fontWeight: 700, color: accent ?? '#181A24', lineHeight: 1, marginBottom: sub ? 6 : 0 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: '#858A9B', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// Renders as a clickable GLO profile link when gloEmail is supplied; otherwise plain span
export function Avatar({ name, className, gloEmail }: { name: string; className?: string; gloEmail?: string | null }) {
  const init = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const base = cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white',
    className,
  );

  if (gloEmail) {
    const local = gloEmail.trim().split('@')[0]?.toLowerCase();
    if (local) {
      return (
        <a
          href={`https://glo.globallogic.com/users/profile/${local}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View GLO profile"
          onClick={e => e.stopPropagation()}
          className={cn(base, 'cursor-pointer transition-all duration-150 hover:scale-110 hover:ring-2 hover:ring-white hover:ring-offset-1 hover:brightness-110 active:scale-95')}
          style={{ background: '#484F6B' }}
        >
          {init}
        </a>
      );
    }
  }

  return (
    <span className={base} style={{ background: '#484F6B' }}>
      {init}
    </span>
  );
}
