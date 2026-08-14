import { Injectable } from '@nestjs/common';
import { PoolCandidate, RankedItem } from './llama.service';

interface IrcInfo {
  mandatorySkills: string;
  project: { startDate: Date | null };
}

// Pure synchronous — no async, no DB, no external calls
@Injectable()
export class HeuristicService {
  rank(irc: IrcInfo, pool: PoolCandidate[]): RankedItem[] {
    const mandatory = irc.mandatorySkills
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    const total = mandatory.length || 1;

    return pool.map(candidate => {
      const empSkills = candidate.skills.map(s => s.toLowerCase());
      const matched   = mandatory.filter(s => empSkills.includes(s));
      const unmatched = mandatory.filter(s => !empSkills.includes(s));

      // Capped at 85 — heuristic never fully displaces evidence-based Gemini scores (R6)
      const matchPct = Math.min(Math.round((matched.length / total) * 100), 85);

      const whyRecommend = matched.length > 0
        ? `Matches ${matched.length} of ${total} mandatory skills: ${matched.join(', ')}`
        : 'No mandatory skill overlap — profile included by broader pool criteria';

      // R7: every result must have at least one whyNot
      const whyNot = unmatched.length > 0
        ? unmatched.map(s => `Missing mandatory skill: ${s}`)
        : ['No critical skill gaps identified — verify domain-specific project depth'];

      const conflict =
        !!candidate.availableDate &&
        !!irc.project.startDate &&
        candidate.availableDate > irc.project.startDate;

      return {
        employeeId:   candidate.employeeId,
        matchPct,
        whyRecommend,
        whyNot,
        conflict,
        ...(conflict && {
          conflictNote: `Available ${candidate.availableDate!.toISOString().slice(0, 10)} — check joining timeline against project start`,
        }),
      };
    });
  }
}
