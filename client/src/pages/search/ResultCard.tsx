import { useMutation } from '@tanstack/react-query';
import { CheckCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Card';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { cn } from '../../lib/utils/cn';
import { pipelineApi } from '../../lib/api/pipeline.api';
import type { SearchResult } from '../../lib/api/search.api';

const NOT_FIT_REASONS = [
  'Not enough domain exposure',
  'Wrong location',
  'Availability doesn\'t work',
  'Level mismatch',
  'Already staffed elsewhere',
] as const;

interface Props {
  result:     SearchResult;
  ircId:      number;
  onShortlisted: (employeeId: number, pipelineCandidateId: number) => void;
}

export function ResultCard({ result, ircId, onShortlisted }: Props) {
  const navigate   = useNavigate();
  const [notFitOpen,    setNotFitOpen]    = useState(false);
  const [confirmedReasons, setConfirmedReasons] = useState<Set<string>>(new Set());

  const shortlistMut = useMutation({
    mutationFn: () => pipelineApi.shortlist(result.employeeId, ircId),
    onSuccess:  (entry) => onShortlisted(result.employeeId, entry.id),
  });

  const notFitMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      pipelineApi.notFit(id, reason),
    onSuccess: (_data, { reason }) =>
      setConfirmedReasons(s => new Set([...s, reason])),
  });

  const firstName  = result.fullName.split(' ')[0];
  const matchColor = result.matchPct >= 70 ? 'bg-commerce-green'
                   : result.matchPct >= 40 ? 'bg-charge-yellow'
                   : 'bg-power-orange';

  return (
    <Card className="overflow-hidden">
      {/* Duplicate banner — R5 */}
      {result.isDuplicate && (
        <div className="bg-charge-yellow/20 px-5 py-2 text-xs font-medium text-[#8A6A00]">
          ⚠ Already in pipeline for {result.duplicateNote}
        </div>
      )}

      <div className="p-5">
        {/* Top: avatar + meta | match score */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar name={result.fullName} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-network-blue">{result.fullName}</p>
              <p className="text-sm text-secure-gray">{result.roleTitle}</p>
              <p className="mt-0.5 text-xs text-[var(--fg-3)]">
                {result.location} · {result.currentAllocation ?? 'Available'} · {result.businessUnit}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold text-network-blue">
              {result.matchPct}<span className="text-sm font-normal text-[var(--fg-3)]">%</span>
            </p>
            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-level-gray">
              <div className={cn('h-1.5 rounded-full', matchColor)} style={{ width: `${result.matchPct}%` }} />
            </div>
            <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
              result.conflict ? 'bg-charge-yellow/20 text-[#8A6A00]' : 'bg-commerce-green/10 text-commerce-green')}>
              {result.conflict ? 'Conflict — see details' : 'Available now'}
            </span>
          </div>
        </div>

        {/* Conflict strip — R8 */}
        {result.conflict && result.conflictNote && (
          <div className="mt-3 rounded-lg bg-charge-yellow/10 px-3 py-2 text-xs text-[#8A6A00]">
            ⚠ {result.conflictNote}
          </div>
        )}

        {/* Why recommend — R6 */}
        <div className="mt-3 flex gap-2 rounded-lg bg-commerce-green/5 px-3 py-2.5">
          <CheckCircle size={13} className="mt-0.5 shrink-0 text-commerce-green" />
          <p className="text-xs text-network-blue">
            <span className="font-medium">Why we recommend {firstName}: </span>
            {result.whyRecommend}
          </p>
        </div>

        {/* Why not — R7 */}
        <div className="mt-2 rounded-lg bg-culture-gray px-3 py-2.5">
          <p className="mb-1 text-xs font-medium text-secure-gray">What's missing</p>
          <ul className="space-y-0.5">
            {result.whyNot.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--fg-3)]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--fg-3)]" />{w}
              </li>
            ))}
          </ul>
        </div>

        {/* Skills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.skills.slice(0, 8).map(s => (
            <span key={s} className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-secure-gray">{s}</span>
          ))}
        </div>

        {/* Not-a-fit quick reasons — R16 */}
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <button onClick={() => setNotFitOpen(o => !o)}
            className="flex items-center gap-1 text-xs text-[var(--fg-3)] hover:text-secure-gray">
            <ChevronDown size={13} className={cn('transition-transform', notFitOpen && 'rotate-180')} />
            Quick feedback
          </button>
          {notFitOpen && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NOT_FIT_REASONS.map(reason => {
                const done = confirmedReasons.has(reason);
                return (
                  <button key={reason}
                    disabled={notFitMut.isPending || !result.pipelineCandidateId}
                    onClick={() => result.pipelineCandidateId && notFitMut.mutate({ id: result.pipelineCandidateId, reason })}
                    className={cn('rounded-full border px-2.5 py-1 text-[10px] transition-colors',
                      done ? 'border-commerce-green bg-commerce-green/10 text-commerce-green'
                           : 'border-[var(--border-default)] text-secure-gray hover:border-power-orange hover:text-power-orange')}>
                    {done ? '✓ ' : ''}{reason}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
          <Button size="sm" variant="secondary" onClick={() => navigate(`/employees/${result.employeeId}`)}>
            View profile
          </Button>
          <Button size="sm"
            disabled={result.alreadyInPipeline || shortlistMut.isPending}
            onClick={() => shortlistMut.mutate()}
            className={result.alreadyInPipeline ? 'bg-level-gray text-secure-gray' : ''}>
            {result.alreadyInPipeline ? 'In pipeline' : shortlistMut.isPending ? 'Shortlisting…' : 'Shortlist'}
          </Button>
          <Button size="sm" variant="ghost">Schedule screening</Button>
        </div>
      </div>
    </Card>
  );
}
