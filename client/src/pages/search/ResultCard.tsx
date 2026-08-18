import { useMutation } from '@tanstack/react-query';
import { Briefcase, Building2, CheckCircle, Clock, MapPin } from 'lucide-react';
import { Avatar } from '../../components/Card';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { pipelineApi } from '../../lib/api/pipeline.api';
import type { SearchResult } from '../../lib/api/search.api';

interface Props {
  result:        SearchResult;
  ircId:         number;
  onShortlisted: (employeeId: number, pipelineCandidateId: number) => void;
  onViewProfile: (employeeId: number) => void;
}

export function ResultCard({ result, ircId, onShortlisted, onViewProfile }: Props) {

  const shortlistMut = useMutation({
    mutationFn: () => pipelineApi.shortlist(result.employeeId, ircId),
    onSuccess:  (entry) => onShortlisted(result.employeeId, entry.id),
  });

  const firstName  = result.fullName.split(' ')[0];
  // Circular ring geometry — r=22 keeps stroke fully inside the 52px viewBox
  const r = 22, circ = 2 * Math.PI * r;
  const ringStroke = result.matchPct >= 80 ? '#2E776A' : result.matchPct >= 60 ? '#D97706' : '#FF5F2D';
  const ringFill   = (result.matchPct / 100) * circ;

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
              <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-0.5">
                <span className="flex items-center gap-1 text-[11px] text-[var(--fg-3)]">
                  <MapPin size={11} className="shrink-0" />{result.location}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[var(--fg-3)]">
                  <Building2 size={11} className="shrink-0" />{result.businessUnit}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[var(--fg-3)]">
                  <Clock size={11} className="shrink-0" />{result.currentAllocation ?? 'Available'}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[var(--fg-3)]">
                  <Briefcase size={11} className="shrink-0" />{result.experienceYears}y exp
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r={r} fill="none" stroke="#C8CAD3" strokeWidth="4" />
              <circle cx="26" cy="26" r={r} fill="none" stroke={ringStroke} strokeWidth="4"
                strokeDasharray={`${ringFill} ${circ - ringFill}`}
                strokeLinecap="round"
                transform="rotate(-90 26 26)" />
              <text x="26" y="26" textAnchor="middle" dominantBaseline="central"
                fontSize="11" fontWeight="700" fill="#181A24" fontFamily="Inter,sans-serif">
                {result.matchPct}%
              </text>
            </svg>
            <span className="inline-flex items-center gap-1 rounded-full bg-commerce-green/10 px-2 py-0.5 text-[10px] font-medium text-commerce-green">
              <span className="h-1.5 w-1.5 rounded-full bg-commerce-green" />
              Available now
            </span>
          </div>
        </div>

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

        {/* Action row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
          <Button size="sm" variant="secondary" onClick={() => onViewProfile(result.employeeId)}>
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
