import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { Avatar } from '../../components/Card';
import { cn } from '../../lib/utils/cn';
import { pipelineApi } from '../../lib/api/pipeline.api';
import type { SearchResult } from '../../lib/api/search.api';

// Ranking context window cap — keeps row height to a single line of chips
const MAX_VISIBLE_SKILLS = 3;

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
  const menuRef              = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const shortlistMut = useMutation({
    mutationFn: () => pipelineApi.shortlist(r.employeeId, ircId),
    onSuccess:  (entry) => onShortlisted(r.employeeId, entry.id),
  });

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const visibleSkills = r.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenCount   = r.skills.length - visibleSkills.length;

  return (
    <tr className="hover:bg-culture-gray/40">
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={r.fullName} className="h-7 w-7 shrink-0 text-[10px]" />
          <div className="min-w-0">
            <p className="truncate font-medium text-network-blue">{r.fullName}</p>
            <p className="truncate text-xs text-[var(--fg-3)]">{r.roleTitle}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--fg-3)]">
        <p className="truncate">{r.businessUnit}</p>
        <p className="truncate">{r.location}</p>
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
        {/* overflow-hidden keeps chips inside the fixed column — no second-line wrapping */}
        <div className="flex items-center gap-1 overflow-hidden">
          {visibleSkills.map(s => (
            <span key={s} className="shrink-0 rounded-full border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-secure-gray">{s}</span>
          ))}
          {hiddenCount > 0 && (
            <span className="shrink-0 text-[10px] text-[var(--fg-3)]">+{hiddenCount}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {r.alreadyInPipeline
          ? <span className="rounded-full bg-celestial-blue/10 px-2 py-0.5 text-[10px] text-celestial-blue">In pipeline</span>
          : <span className="rounded-full bg-commerce-green/10 px-2 py-0.5 text-[10px] text-commerce-green">Available</span>}
      </td>
      <td className="px-4 py-3 text-center">
        <div ref={menuRef} className="relative inline-block">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="rounded p-1 text-secure-gray hover:bg-culture-gray">
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-[var(--border-subtle)] bg-white py-1 shadow-md text-xs">
              <button
                onClick={() => { onViewProfile(r.employeeId); setMenuOpen(false); }}
                className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray">
                View profile
              </button>
              <button
                disabled={r.alreadyInPipeline || shortlistMut.isPending}
                onClick={() => { shortlistMut.mutate(); setMenuOpen(false); }}
                className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray disabled:cursor-not-allowed disabled:opacity-50">
                {r.alreadyInPipeline ? 'In pipeline' : shortlistMut.isPending ? 'Shortlisting…' : 'Shortlist'}
              </button>
              <button
                onClick={() => setMenuOpen(false)}
                className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray">
                Schedule screening
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ResultTable({ results, ircId, onShortlisted, onViewProfile }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[25%]" />
          <col className="w-[16%]" />
          <col className="w-[7%]" />
          <col className="w-[8%]" />
          <col className="w-[25%]" />
          <col className="w-[13%]" />
          <col className="w-[6%]" />
        </colgroup>
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
