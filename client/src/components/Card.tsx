import { cn } from '../lib/utils/cn';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-[var(--border-subtle)] bg-white shadow-xs', className)}>
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--fg-3)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-network-blue">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--fg-3)]">{sub}</p>}
    </Card>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full bg-celestial-blue text-xs font-semibold text-white', className)}>
      {initials}
    </span>
  );
}
