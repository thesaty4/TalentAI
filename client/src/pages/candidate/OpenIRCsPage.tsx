import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { candidateApi, type OpenIrc } from '../../lib/api/candidate.api';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';

function IrcCard({ irc }: { irc: OpenIrc }) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const applyMut = useMutation({
    mutationFn: () => candidateApi.apply(irc.id),
    onSuccess:  () => {
      setConfirmOpen(false);
      qc.setQueryData<OpenIrc[]>(['candidate-open-ircs'], old =>
        old?.map(i => i.id === irc.id ? { ...i, hasApplied: true } : i) ?? old
      );
      // Invalidate so My Pipeline and Candidate Dashboard reflect the new entry immediately
      qc.invalidateQueries({ queryKey: ['my-pipeline'] });
    },
  });

  const mandatory  = irc.mandatorySkills.split(',').map(s => s.trim()).filter(Boolean);
  const preferred  = irc.preferredSkills?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

  return (
    <Card className="flex flex-col p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-celestial-blue">{irc.ircCode}</p>
          <p className="mt-0.5 font-semibold text-network-blue">{irc.roleTitle}</p>
          <p className="text-sm text-secure-gray">{irc.project.name} · {irc.project.customer}</p>
        </div>
        {irc.hasApplied ? (
          <span className="shrink-0 rounded-full bg-commerce-green/10 px-3 py-1 text-xs font-medium text-commerce-green">
            ✓ Applied
          </span>
        ) : (
          <Button size="sm" disabled={applyMut.isPending}
            className="shrink-0 bg-power-orange hover:bg-[#B5361E]"
            onClick={() => setConfirmOpen(true)}>
            Apply
          </Button>
        )}
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--fg-3)]">
        <span>📍 {irc.location}</span>
        <span>🌐 {irc.remotePolicy}</span>
        <span>⏱ {irc.experienceRange}</span>
      </div>

      {/* Skills */}
      <div className="mt-3 space-y-2">
        {mandatory.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] font-medium text-secure-gray">Required:</span>
            {mandatory.map(s => (
              <span key={s} className="rounded-full bg-network-blue/10 px-2 py-0.5 text-[10px] font-medium text-network-blue">{s}</span>
            ))}
          </div>
        )}
        {preferred.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] font-medium text-[var(--fg-3)]">Preferred:</span>
            {preferred.map(s => (
              <span key={s} className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-secure-gray">{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Apply error */}
      {applyMut.isError && (
        <p className="mt-2 text-xs text-power-orange">
          {(applyMut.error as any)?.response?.data?.message ?? 'Apply failed — try again'}
        </p>
      )}

      {/* Confirmation modal */}
      <Modal open={confirmOpen} onClose={() => !applyMut.isPending && setConfirmOpen(false)}
        title="Apply for this IRC?">
        <p className="mb-1 font-medium text-network-blue">{irc.roleTitle}</p>
        <p className="mb-4 text-sm text-secure-gray">{irc.project.name} · {irc.ircCode}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={applyMut.isPending}
            onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={applyMut.isPending}
            className="bg-power-orange hover:bg-[#B5361E]"
            onClick={() => applyMut.mutate()}>
            {applyMut.isPending ? 'Applying…' : 'Yes, Apply'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

export function OpenIRCsPage() {
  const query = useQuery({
    queryKey: ['candidate-open-ircs'],
    queryFn:  () => candidateApi.openIrcs(),
  });

  if (query.isPending) return <Spinner />;
  if (query.isError)   return <ErrorBanner message="Failed to load open IRCs" onRetry={query.refetch} />;
  if (!query.data?.length) return <EmptyState title="No open IRCs" description="Check back soon — new positions are posted regularly." />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {query.data.map(irc => <IrcCard key={irc.id} irc={irc} />)}
    </div>
  );
}
