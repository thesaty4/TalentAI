import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Avatar } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { employeesApi } from '../../lib/api/employees.api';
import { cn } from '../../lib/utils/cn';
import { useAuth } from '../../auth/useAuth';

const RATING_COLORS: Record<string, string> = {
  Exceeding: 'bg-commerce-green/10 text-commerce-green',
  Meeting:   'bg-celestial-blue/10 text-celestial-blue',
  Below:     'bg-charge-yellow/20 text-secure-gray',
};

export function CandidateProfilePage() {
  const { id }    = useParams<{ id: string }>();
  const { user }  = useAuth();

  const query = useQuery({
    queryKey: ['employee', id],
    queryFn:  () => employeesApi.get(id!),
    enabled:  !!id,
  });

  if (query.isPending) return <Spinner />;
  if (query.isError)   return <ErrorBanner message="Failed to load profile" onRetry={query.refetch} />;
  if (!query.data)     return <EmptyState title="Profile not found" />;

  const emp = query.data;
  const isAvailable = emp.benchStatus === 'Bench';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-5 rounded-xl border border-[var(--border-subtle)] bg-white p-6">
        <Avatar name={emp.fullName} className="h-16 w-16 text-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-network-blue">{emp.fullName}</h1>
          <p className="text-sm text-secure-gray">{emp.roleTitle}</p>
          <p className="mt-0.5 text-xs text-[var(--fg-3)]">{emp.businessUnit} · {emp.location} · {emp.experienceYears}y exp</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', isAvailable ? 'bg-commerce-green/10 text-commerce-green' : 'bg-celestial-blue/10 text-celestial-blue')}>
              {isAvailable ? '✓ Available now' : emp.benchStatus}
            </span>
            {emp.availableDate && (
              <span className="rounded-full bg-charge-yellow/20 px-2.5 py-1 text-xs text-secure-gray">
                Free from {new Date(emp.availableDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          {emp.currentAllocation && (
            <p className="mt-1 text-xs text-[var(--fg-3)]">Currently: {emp.currentAllocation}</p>
          )}
        </div>
      </div>

      {/* Skills */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <h2 className="mb-3 font-semibold text-network-blue">Skills</h2>
        <div className="flex flex-wrap gap-1.5">
          {emp.skills.map(s => (
            <span key={s} className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-secure-gray">{s}</span>
          ))}
        </div>
      </section>

      {/* Career history */}
      {emp.projectHistory.length > 0 && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
          <h2 className="mb-4 font-semibold text-network-blue">Career history</h2>
          <div className="space-y-4">
            {emp.projectHistory.map(p => (
              <div key={p.id} className="border-l-2 border-celestial-blue pl-4">
                <p className="font-medium text-network-blue">{p.projectName}</p>
                <p className="text-xs text-[var(--fg-3)]">
                  {p.clientName ? `${p.clientName} · ` : ''}{p.duration ?? '—'}
                </p>
                <p className="mt-1 text-sm text-secure-gray">{p.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.domainTags.map(t => (
                    <span key={t} className="rounded-full bg-network-blue/10 px-2 py-0.5 text-[10px] font-medium text-network-blue">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ratings — visible to manager/HR; R20: candidates only see their own */}
      {user?.role !== 'candidate' && emp.ratings.length > 0 && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
          <h2 className="mb-3 font-semibold text-network-blue">Performance ratings</h2>
          <div className="space-y-2">
            {emp.ratings.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-secure-gray">{r.reviewCycle}</span>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', RATING_COLORS[r.rating] ?? 'bg-level-gray text-secure-gray')}>{r.rating}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
