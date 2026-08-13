export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E3E5E9', borderRadius: 12 }}
      className={className ?? ''}>
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E3E5E9', borderRadius: 12, padding: 18 }}>
      <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#8891A0', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 30, fontWeight: 600, color: '#1B2430', lineHeight: 1, marginBottom: sub ? 6 : 0 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: '#8891A0' }}>{sub}</p>}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const init = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${className ?? ''}`}
      style={{ background: '#003057' }}>
      {init}
    </span>
  );
}
