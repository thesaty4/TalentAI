import { useMutation } from '@tanstack/react-query';
import { Avatar } from '../../components/Card';
import { Button } from '../../components/Button';
import { cn } from '../../lib/utils/cn';
import { pipelineApi } from '../../lib/api/pipeline.api';
import type { SearchResult } from '../../lib/api/search.api';

interface Props {
  results:       SearchResult[];
  ircId:         number;
  onShortlisted: (employeeId: number, pipelineCandidateId: number) => void;
  onViewProfile: (employeeId: number) => void;
}

function ResultTableRow({ r, ircId, onShortlisted, onViewProfile }: {
  r: SearchResult; ircId: number;
  onShortlisted: (employeeId: number, pipelineCandidateId: number) => void;
  onViewProfile: (employeeId: number) => void;
}) {
  const shortlistMut = useMutation({
    mutationFn: () => pipelineApi.shortlist(r.employeeId, ircId),
    onSuccess:  (entry) => onShortlisted(r.employeeId, entry.id),
  });

  return (
    <tr className="hover:bg-culture-gray/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={r.fullName} className="h-7 w-7 shrink-0 text-[10px]" />
          <div>
            <p className="font-medium text-network-blue">{r.fullName}</p>
            <p className="text-xs text-[var(--fg-3)]">{r.roleTitle}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--fg-3)]">
        <p>{r.businessUnit}</p>
        <p>{r.location}</p>
      </td>
      <td className="px-4 py-3 text-center text-xs">{r.experienceYears}y</td>
      <td className="px-4 py-3 text-center">
        <span className={cn('font-semibold text-sm',
          r.matchPct >= 70 ? 'text-commerce-green'
          : r.matchPct >= 40 ? 'text-charge-yellow'
          : 'text-power-orange')}>
          {r.matchPct}%
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {r.skills.slice(0, 3).map(s => (
            <span key={s} className="rounded-full border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-secure-gray">{s}</span>
          ))}
          {r.skills.length > 3 && <span className="text-[10px] text-[var(--fg-3)]">+{r.skills.length - 3}</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        {r.alreadyInPipeline
          ? <span className="rounded-full bg-celestial-blue/10 px-2 py-0.5 text-[10px] text-celestial-blue">In pipeline</span>
          : <span className="rounded-full bg-commerce-green/10 px-2 py-0.5 text-[10px] text-commerce-green">Available</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onViewProfile(r.employeeId)}>Profile</Button>
          <Button size="sm"
            disabled={r.alreadyInPipeline || shortlistMut.isPending}
            className={r.alreadyInPipeline ? 'bg-level-gray text-secure-gray' : ''}
            onClick={() => shortlistMut.mutate()}>
            {r.alreadyInPipeline ? 'In pipeline' : shortlistMut.isPending ? 'Shortlisting…' : 'Shortlist'}
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function ResultTable({ results, ircId, onShortlisted, onViewProfile }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border-subtle)] bg-culture-gray text-xs font-medium text-secure-gray">
          <tr>
            <th className="px-4 py-3 text-left">Candidate</th>
            <th className="px-4 py-3 text-left">BU / Location</th>
            <th className="px-4 py-3 text-center">Exp</th>
            <th className="px-4 py-3 text-center">Match</th>
            <th className="px-4 py-3 text-left">Skills</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {results.map(r => (
            <ResultTableRow key={r.employeeId} r={r} ircId={ircId}
              onShortlisted={onShortlisted} onViewProfile={onViewProfile} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
