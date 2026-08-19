import { cn } from '../lib/utils/cn';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #C8CAD3', borderRadius: 12 }}
      className={cn('shadow-sm', className)}>
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #C8CAD3', borderRadius: 12, padding: '20px 18px' }}
      className="shadow-sm">
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

// Neutral slate-navy background keeps profile identity distinct from any stage color
export function Avatar({ name, className }: { name: string; className?: string }) {
  const init = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white', className)}
      style={{ background: '#484F6B' }}
    >
      {init}
    </span>
  );
}
