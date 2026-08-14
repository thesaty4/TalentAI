import { Injectable } from '@nestjs/common';
import { LOCATION_ALIASES } from '../common/constants/search.constants';
import { PoolCandidate, RankedItem } from './search.types';

interface IrcInfo {
  mandatorySkills:  string;
  preferredSkills?: string | null;
  experienceRange:  string;
  location:         string;
  remotePolicy:     string;
  project: { startDate: Date | null };
}

// Pure synchronous — no async, no DB, no external calls (per instructions)
@Injectable()
export class HeuristicService {
  rank(irc: IrcInfo, pool: PoolCandidate[]): RankedItem[] {
    const mandatory  = this.splitSkills(irc.mandatorySkills);
    const preferred  = this.splitSkills(irc.preferredSkills ?? '');
    const total      = mandatory.length || 1;
    const expRange   = this.parseExpRange(irc.experienceRange);
    const canonical  = (s: string) => LOCATION_ALIASES[s.toLowerCase()] ?? s.toLowerCase();
    const ircLoc     = canonical(irc.location.trim());

    const scored = pool.map(candidate => {
      const empSkills  = candidate.skills.map(s => s.toLowerCase());
      const matched    = mandatory.filter(s => empSkills.includes(s));
      const unmatched  = mandatory.filter(s => !empSkills.includes(s));

      // Primary: mandatory skill coverage (0–60 pts); cap at 30 if any skill missing
      const skillPct    = Math.round((matched.length / total) * 100);
      const skillScore  = matched.length < total ? Math.min(skillPct * 0.6, 30) : skillPct * 0.6;

      // Secondary: experience range match (0–20 pts)
      const inRange    = candidate.experienceYears >= expRange.min && candidate.experienceYears <= expRange.max;
      const expScore   = inRange ? 20 : 0;

      // Secondary: location match (0–15 pts)
      const locOk     = canonical(candidate.location).includes(ircLoc);
      const locScore  = locOk ? 15 : 0;

      // Tertiary: preferred skill coverage (0–10 pts)
      const prefMatched = preferred.filter(s => empSkills.includes(s));
      const prefScore   = preferred.length > 0 ? Math.round((prefMatched.length / preferred.length) * 10) : 0;

      // Capped at 85 — heuristic is a safety net, never a primary evidence-based score (R6)
      const matchPct = Math.min(Math.round(skillScore + expScore + locScore + prefScore), 85);

      const whyRecommend = matched.length > 0
        ? `Matches ${matched.length}/${total} mandatory skills: ${matched.join(', ')}${prefMatched.length > 0 ? `; preferred: ${prefMatched.join(', ')}` : ''}`
        : 'No mandatory skill overlap — profile included by broader pool criteria';

      // R7: every result must have at least one whyNot
      const whyNot: string[] = [
        ...unmatched.map(s => `Missing mandatory skill: ${s}`),
        ...(!inRange ? [`Experience ${candidate.experienceYears}yrs outside required ${irc.experienceRange}`] : []),
        ...(!locOk   ? [`Location ${candidate.location} does not match ${irc.location}`] : []),
      ];
      if (whyNot.length === 0) whyNot.push('No critical gaps identified — verify domain-specific project depth');

      const conflict =
        !!candidate.availableDate &&
        !!irc.project.startDate &&
        candidate.availableDate > irc.project.startDate;

      return {
        employeeId: candidate.employeeId,
        matchPct,
        whyRecommend,
        whyNot,
        conflict,
        ...(conflict && {
          conflictNote: `Available ${candidate.availableDate!.toISOString().slice(0, 10)} — check joining timeline against project start`,
        }),
      };
    });

    // Stable sort: matchPct DESC, then employeeId ASC (determinism)
    return scored.sort((a, b) =>
      b.matchPct !== a.matchPct ? b.matchPct - a.matchPct : a.employeeId - b.employeeId,
    );
  }

  private splitSkills(raw: string): string[] {
    return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }

  private parseExpRange(range: string): { min: number; max: number } {
    const plusMatch  = range?.match(/(\d+(?:\.\d+)?)\s*\+/);
    if (plusMatch)   return { min: Number(plusMatch[1]),  max: Infinity };
    const bandMatch  = range?.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
    if (bandMatch)   return { min: Number(bandMatch[1]),  max: Number(bandMatch[2]) };
    return { min: 0, max: Infinity };
  }
}
