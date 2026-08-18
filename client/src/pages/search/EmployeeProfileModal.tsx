import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Avatar } from '../../components/Card';
import { Spinner } from '../../components/Feedback';
import { cn } from '../../lib/utils/cn';
import { employeesApi } from '../../lib/api/employees.api';
import { useAuth } from '../../auth/useAuth';

const RATING_COLORS: Record<string, string> = {
  Exceeding: 'bg-commerce-green/10 text-commerce-green',
  Meeting:   'bg-celestial-blue/10 text-celestial-blue',
  Below:     'bg-charge-yellow/20 text-[#484F6B]',
};

interface Props { employeeId: number; onClose: () => void; }

export function EmployeeProfileModal({ employeeId, onClose }: Props) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['employee', employeeId],
    queryFn:  () => employeesApi.get(employeeId),
  });

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      {/* Centered popup panel */}
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-white px-5 py-3">
          <p className="text-sm font-semibold text-network-blue">
            {query.data?.fullName ?? 'Employee Profile'}
          </p>
          <button onClick={onClose} className="rounded p-1 text-secure-gray hover:bg-culture-gray">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {query.isPending && <Spinner />}
          {query.isError && <p className="text-sm text-power-orange">Failed to load profile.</p>}

          {query.data && (() => {
            const emp = query.data;
            return (
              <>
                {/* Header */}
                <div className="flex items-start gap-4">
                  <Avatar name={emp.fullName} className="h-14 w-14 shrink-0 text-lg" />
                  <div>
                    <p className="font-bold text-network-blue">{emp.fullName}</p>
                    <p className="text-sm text-secure-gray">{emp.roleTitle}</p>
                    <p className="mt-0.5 text-xs text-[var(--fg-3)]">{emp.businessUnit} · {emp.location} · {emp.experienceYears}y exp</p>
                    <span className={cn('mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                      emp.benchStatus === 'Bench' ? 'bg-commerce-green/10 text-commerce-green' : 'bg-celestial-blue/10 text-celestial-blue')}>
                      {emp.benchStatus === 'Bench' ? '✓ Available' : emp.benchStatus}
                    </span>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-secure-gray uppercase tracking-wide">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {emp.skills.map(s => (
                      <span key={s} className="rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-xs text-secure-gray">{s}</span>
                    ))}
                  </div>
                </div>

                {/* Career history */}
                {emp.projectHistory.length > 0 && (
                  <div>
                    <p className="mb-3 text-xs font-semibold text-secure-gray uppercase tracking-wide">Career history</p>
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
                  </div>
                )}

                {/* Ratings — not shown to candidates (R20) */}
                {user?.role !== 'candidate' && emp.ratings.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-secure-gray uppercase tracking-wide">Performance</p>
                    <div className="space-y-2">
                      {emp.ratings.map(r => (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <span className="text-secure-gray">{r.reviewCycle}</span>
                          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', RATING_COLORS[r.rating] ?? 'bg-level-gray text-secure-gray')}>{r.rating}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
