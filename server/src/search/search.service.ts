import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MAX_RANKING_CANDIDATES, KNOWN_LOCATIONS, LOCATION_ALIASES, DOMAIN_KEYWORD_MAP } from '../common/constants/search.constants';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDto } from './dto/search.dto';
import { HeuristicService } from './heuristic.service';
import { LlamaService } from './llama.service';
import { RetrievalService } from './retrieval.service';
import { PoolCandidate, RankedItem, QueryConstraints } from './search.types';

type EmployeeWithRelations = Prisma.EmployeeGetPayload<{
  include: {
    skills: { include: { skill: true } };
    projectHistory: true;
  };
}>;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly heuristic:  HeuristicService,
    private readonly retrieval:  RetrievalService,
    private readonly llama:      LlamaService,
    private readonly config:     ConfigService,
  ) {}

  async search(user: JwtPayload, dto: SearchDto, jdFilename?: string) {
    // Step 1: load IRC + project
    const irc = await this.prisma.irc.findUnique({
      where: { id: dto.ircId },
      include: { project: true },
    });
    if (!irc) throw new NotFoundException('IRC not found');
    if (irc.status !== 'Open') throw new BadRequestException('IRC is not Open (R2)');

    // Step 2: build candidate pool
    // When user explicitly asks for "all candidates", bypass IRC mandatory-skills pre-filter
    // so the domain filter — not skill overlap — drives the pool
    const qcEarly = this.parseQueryConstraints(dto.query);
    const poolSkillsFilter = qcEarly.isAllCandidates ? '' : irc.mandatorySkills;
    const pool = await this.buildPool(dto, irc.id, poolSkillsFilter);
    this.logger.log(`[search] irc=${irc.ircCode} scope=${dto.scope} pool=${pool.length} candidates${qcEarly.isAllCandidates ? ' (all-candidates mode)' : ''}`);
    if (pool.length === 0) return [];

    // Phase 1: parse query for explicit constraints — these have highest priority over IRC filters
    const qc           = qcEarly; // already parsed above
    const ircExpRange  = this.parseExperienceRange(irc.experienceRange);
    const effectiveExp = this.resolveEffectiveExp(qc, ircExpRange);
    const effectiveLocs = this.resolveLocations(irc.location, qc);

    // Domain filter: applied before eligibility; only candidates with matching project history pass
    const domainFiltered = this.filterByDomain(pool, qc.domains ?? []);
    // In strict mode, never fall back to full pool — user said "only X domain"
    const domainPool = domainFiltered.length > 0 ? domainFiltered
      : qc.isStrict ? [] : pool;
    if ((qc.domains ?? []).length > 0) {
      this.logger.log(`[search] domain filter [${qc.domains!.join(', ')}]: ${domainFiltered.length}/${pool.length} passed${qc.isStrict ? ' (STRICT)' : ''}`);
      if (domainFiltered.length === 0) {
        qc.isStrict
          ? this.logger.warn('[search] STRICT mode: domain filter 0 results — returning empty per user constraint')
          : this.logger.warn('[search] domain filter 0 — relaxing to full pool');
      }
    }
    if (domainPool.length === 0) return [];

    const eligiblePool = this.applyEligibilityFilter(domainPool, effectiveExp, effectiveLocs);
    // In strict mode, never fall back — return empty rather than violate user's constraint
    const rankingPool  = eligiblePool.length > 0 ? eligiblePool
      : qc.isStrict ? [] : domainPool;
    this.logger.log(
      `[search] Phase1 eligibility: ${eligiblePool.length}/${domainPool.length} passed ` +
      `(exp ${effectiveExp.min}–${effectiveExp.max === Infinity ? '+' : effectiveExp.max}yrs, ` +
      `loc=[${effectiveLocs.join(', ')}])${qc.isStrict ? ' STRICT' : ''}`,
    );
    if (eligiblePool.length === 0) {
      if (qc.isStrict) {
        this.logger.warn('[search] STRICT mode: eligibility 0 results — returning empty per user constraint');
        return [];
      }
      this.logger.warn('[search] no candidates passed eligibility — falling back to domain-filtered pool');
    }

    // Build a human-readable note of applied constraints for the Llama prompt
    const constraintNote = [
      qc.expExact    !== undefined && `Experience exactly ${qc.expExact} years`,
      qc.expRange                 && `Experience ${qc.expRange.min}–${qc.expRange.max === Infinity ? '+' : qc.expRange.max} years`,
      qc.locations?.isOverride    && `Location restricted to: ${qc.locations.cities.join(' or ')}`,
      qc.locations && !qc.locations.isOverride && `Location includes: ${qc.locations.cities.join(' + ')}`,
      (qc.domains ?? []).length   && `Domain required: ${qc.domains!.join(', ')}`,
      qc.remotePolicy             && `Remote policy: ${qc.remotePolicy}`,
      qc.joiningNoticeDays === 0  && 'Joining notice: immediate joiners only',
      (qc.joiningNoticeDays ?? -1) >  0  && `Joining notice: max ${qc.joiningNoticeDays} days`,
      qc.isStrict                 && 'STRICT MODE: all above constraints are non-negotiable',
    ].filter(Boolean).join('; ');

    // Step 3: rank — Llama with heuristic fallback; set RANKING_PROVIDER=heuristic to bypass Llama
    const provider = this.config.get<string>('rankingProvider') ?? 'llama';
    let ranked: RankedItem[];
    try {
      if (provider === 'heuristic') {
        throw new Error('heuristic provider selected via RANKING_PROVIDER env');
      }
      ranked = await this.rankWithLlama(dto, irc, rankingPool, constraintNote || undefined);
      const poolIds = new Set(rankingPool.map(c => c.employeeId));
      ranked = ranked.filter(r => poolIds.has(r.employeeId));
      this.logger.log(`[search] llama ranked ${ranked.length} candidates (pool was ${rankingPool.length})`);
    } catch (err) {
      this.logger.warn(`[search] Llama ranking failed — heuristic fallback: ${(err as Error).message}`);
      ranked = this.heuristic.rank(irc, rankingPool);
      this.logger.log(`[search] heuristic produced ${ranked.length} results`);
    }

    // Step 4: re-hydrate — ALL display fields from DB, never from model (per instructions)
    const employeeMap = await this.rehydrate(ranked.map(r => r.employeeId));
    this.logger.debug(`[search] rehydrated ${employeeMap.size} employees`);

    // Step 5: duplicate-check (R5) + alreadyInPipeline (R4)
    const activeElsewhere = await this.findActiveElsewhere(ranked.map(r => r.employeeId), irc.id);
    const inThisPipeline  = await this.findInThisPipeline(irc.id);

    const results = ranked
      .filter(r => employeeMap.has(r.employeeId))
      .map(r => {
        const emp = employeeMap.get(r.employeeId)!;
        const dup = activeElsewhere.get(r.employeeId);
        return {
          employeeId:        r.employeeId,
          fullName:          emp.fullName,
          roleTitle:         emp.roleTitle,
          location:          emp.location,
          businessUnit:      emp.businessUnit,
          experienceYears:   emp.experienceYears,
          skills:            emp.skills,
          currentAllocation: emp.currentAllocation,
          availableDate:     emp.availableDate?.toISOString().slice(0, 10) ?? null,
          matchPct:          r.matchPct,
          whyRecommend:      r.whyRecommend,
          whyNot:            r.whyNot,
          conflict:          r.conflict,
          conflictNote:      r.conflictNote ?? null,
          isDuplicate:       !!dup,
          duplicateNote:     dup ?? null,
          alreadyInPipeline: inThisPipeline.has(r.employeeId),
          pipelineCandidateId: inThisPipeline.get(r.employeeId) ?? null,
        };
      });

    // R9: sort descending by matchPct; stable tie-break by employeeId ASC (determinism)
    results.sort((a, b) => b.matchPct !== a.matchPct ? b.matchPct - a.matchPct : a.employeeId - b.employeeId);

    // Apply topN limit if requested; 0 or omitted returns all
    const limited = dto.topN && dto.topN > 0 ? results.slice(0, dto.topN) : results;
    this.logger.log(
      `[search] done — ${limited.length}${dto.topN ? `/${results.length}` : ''} results, preview: ${limited.slice(0, 3).map(r => `${r.fullName}:${r.matchPct}%`).join(' | ')}`,
    );

    // Step 8: log every search regardless of AI or heuristic path
    await this.prisma.searchLog.create({
      data: { userId: user.sub, ircId: dto.ircId, queryText: dto.query ?? null, jdFilename: jdFilename ?? null },
    });

    return limited;
  }

  // ─── Llama ranking path ────────────────────────────────────────────────────

  private async rankWithLlama(
    dto: SearchDto,
    irc: Prisma.IrcGetPayload<{ include: { project: true } }>,
    pool: PoolCandidate[],
    constraintNote?: string,
  ): Promise<RankedItem[]> {
    // Use query-first embedding: typed query preserves precise intent; JD only used when no query
    const embeddingInput = this.retrieval.buildEmbeddingQuery(dto.query, dto.jdText);
    this.logger.debug(`[llama] embeddingInput="${embeddingInput.slice(0, 80)}..." (queryDriven=${!!dto.query?.trim()})`);
    if (!embeddingInput) {
      this.logger.warn('[llama] no embeddingInput — skipping retrieval, ranking on raw pool');
      return this.llama.rank(irc, pool, dto.query, dto.jdText, constraintNote);
    }

    this.logger.debug('[llama] calling embedding service');
    const embedding = await this.retrieval.embedQuery(embeddingInput);
    this.logger.debug(`[llama] embedding received dims=${embedding.length}`);

    const mandatorySkills = irc.mandatorySkills
      .split(',').map(s => s.trim()).filter(Boolean);
    this.logger.debug(`[llama] retrieving context — pool=${pool.length} skills=[${mandatorySkills.join(', ')}]`);

    const retrievedRows = await this.retrieval.retrieveByContext(
      embedding,
      { employeeIds: pool.map(p => p.employeeId), requiredSkills: mandatorySkills },
    );
    this.logger.log(
      `[llama] retrieval: ${retrievedRows.length} rows` +
      (retrievedRows.length > 0
        ? ` top distances: ${retrievedRows.slice(0, 3).map(r => r.distance.toFixed(4)).join(', ')}`
        : ' — no embeddings found, will rank on raw projectHistory'),
    );

    // Group retrieved project rows by employeeId — gives Llama semantically-ranked evidence
    const byEmployee = new Map<number, typeof retrievedRows>();
    for (const row of retrievedRows) {
      const bucket = byEmployee.get(row.employeeId) ?? [];
      bucket.push(row);
      byEmployee.set(row.employeeId, bucket);
    }
    this.logger.debug(`[llama] ${byEmployee.size}/${pool.length} candidates have retrieved evidence`);

    // Replace each candidate's projectHistory with semantically-ordered evidence rows
    const enrichedPool: PoolCandidate[] = pool.map(c => ({
      ...c,
      projectHistory: byEmployee.get(c.employeeId)?.map(r => ({
        projectName: r.projectName,
        clientName:  null,
        duration:    r.duration ?? undefined,
        description: r.description,
        domainTags:  [],
      })) ?? c.projectHistory,
    }));

    this.logger.log(`[llama] sending ${enrichedPool.length} enriched candidates to Llama3`);
    const ranked = await this.llama.rank(irc, enrichedPool, dto.query, dto.jdText, constraintNote);
    this.logger.log(
      `[llama] Llama3 returned ${ranked.length} items: ${ranked.map(r => `emp${r.employeeId}:${r.matchPct}%`).join(' | ')}`,
    );
    return ranked;
  }

  // ─── Pool builder ──────────────────────────────────────────────────────────

  private async buildPool(dto: SearchDto, ircId: number, mandatorySkills: string): Promise<PoolCandidate[]> {
    this.logger.debug(`[pool] scope=${dto.scope} mandatorySkills="${mandatorySkills}"`);
    // R10: 'applied' scope = only employees already in this IRC's active pipeline
    if (dto.scope === 'applied') {
      const entries = await this.prisma.pipelineCandidate.findMany({
        where: { ircId, isActive: true, stage: { not: 'Rejected' } },
        include: {
          employee: { include: { skills: { include: { skill: true } }, projectHistory: true } },
        },
      });
      return entries.map(pe => this.toPoolCandidate(pe.employee));
    }

    // R15: exclude employees with a Rejected stage for this IRC
    const rejectedIds = await this.prisma.pipelineCandidate
      .findMany({ where: { ircId, stage: 'Rejected' }, select: { employeeId: true } })
      .then(rows => rows.map(r => r.employeeId));

    const mandatory = mandatorySkills.split(',').map(s => s.trim()).filter(Boolean);

    const where: Prisma.EmployeeWhereInput = {
      ...(rejectedIds.length > 0 && { id: { notIn: rejectedIds } }),
      ...(mandatory.length > 0 && {
        skills: { some: { skill: { name: { in: mandatory } } } },
      }),
    };

    const employees = await this.prisma.employee.findMany({
      where,
      include: { skills: { include: { skill: true } }, projectHistory: true },
      // When no mandatory filter, cap directly in Prisma to avoid loading all 65 rows
      ...(mandatory.length === 0 && { take: MAX_RANKING_CANDIDATES }),
    });

    if (mandatory.length === 0) return employees.map(e => this.toPoolCandidate(e));

    // Sort by mandatory-skill overlap descending; keep top MAX_RANKING_CANDIDATES
    return employees
      .map(e => {
        const empSkills = e.skills.map(es => es.skill.name.toLowerCase());
        const overlap   = mandatory.filter(s => empSkills.includes(s.toLowerCase())).length;
        return { e, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, MAX_RANKING_CANDIDATES)
      .map(({ e }) => this.toPoolCandidate(e));
  }

  private toPoolCandidate(e: EmployeeWithRelations): PoolCandidate {
    return {
      employeeId:        e.id,
      location:          e.location,
      benchStatus:       e.benchStatus,
      skills:            e.skills.map(es => es.skill.name),
      experienceYears:   Number(e.experienceYears),
      currentAllocation: e.currentAllocation,
      availableDate:     e.availableDate,
      joiningNotice:     e.joiningNotice,
      projectHistory:    e.projectHistory.map(p => ({
        projectName: p.projectName,
        clientName:  p.clientName,
        duration:    p.duration,
        description: p.description,
        domainTags:  p.domainTags,
      })),
    };
  }

  // ─── Re-hydration + checks ─────────────────────────────────────────────────

  private async rehydrate(employeeIds: number[]) {
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { skills: { include: { skill: true } } },
    });
    return new Map(employees.map(e => [e.id, {
      fullName:          e.fullName,
      roleTitle:         e.roleTitle,
      location:          e.location,
      businessUnit:      e.businessUnit,
      experienceYears:   Number(e.experienceYears),
      currentAllocation: e.currentAllocation,
      availableDate:     e.availableDate,
      skills:            e.skills.map(es => es.skill.name),
    }]));
  }

  private async findActiveElsewhere(employeeIds: number[], currentIrcId: number) {
    // R5: flag employees active in a DIFFERENT open IRC (visibility only, not a block)
    const rows = await this.prisma.pipelineCandidate.findMany({
      where: {
        employeeId: { in: employeeIds },
        isActive:   true,
        stage:      { not: 'Rejected' },
        ircId:      { not: currentIrcId },
        irc:        { status: 'Open' },
      },
      include: { irc: { include: { project: { select: { name: true } } } } },
    });

    const map = new Map<number, string>();
    for (const pc of rows) {
      if (!map.has(pc.employeeId)) {
        map.set(pc.employeeId, `Active in ${pc.irc.ircCode} · ${pc.irc.project.name}`);
      }
    }
    return map;
  }

  private async findInThisPipeline(ircId: number): Promise<Map<number, number>> {
    const rows = await this.prisma.pipelineCandidate.findMany({
      where: { ircId, isActive: true, stage: { not: 'Rejected' } },
      select: { employeeId: true, id: true },
    });
    return new Map(rows.map(r => [r.employeeId, r.id]));
  }

  // ─── Phase 1 eligibility helpers ──────────────────────────────────────────────────────

  /** Parses IRC experienceRange strings: "4-8 years", "5+ years", "6 years". */
  parseExperienceRange(range: string): { min: number; max: number } {
    const plusMatch  = range?.match(/(\d+(?:\.\d+)?)\s*\+/);
    if (plusMatch)  return { min: Number(plusMatch[1]),  max: Infinity };
    const bandMatch  = range?.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
    if (bandMatch)  return { min: Number(bandMatch[1]),  max: Number(bandMatch[2]) };
    const singleMatch = range?.match(/(\d+(?:\.\d+)?)/);
    if (singleMatch) return { min: Number(singleMatch[1]), max: Number(singleMatch[1]) };
    return { min: 0, max: Infinity };
  }

  /** Parses user query for an explicit experience override e.g. "only 6+ years" or "4–8 years". @deprecated use parseQueryConstraints */
  parseQueryExpOverride(query?: string): { min: number; max: number } | null {
    const qc = this.parseQueryConstraints(query);
    return qc.expRange ?? (qc.expExact !== undefined ? { min: qc.expExact, max: qc.expExact + 0.99 } : null);
  }

  /**
   * Builds the effective location set from IRC location + query constraints.
   * isOverride=true means query specified a location explicitly — IRC location is ignored.
   */
  resolveLocations(ircLocation: string, constraints: QueryConstraints): string[] {
    const canonical = (s: string) => LOCATION_ALIASES[s.toLowerCase()] ?? s.toLowerCase();
    if (constraints.locations?.isOverride && constraints.locations.cities.length > 0) {
      return [...new Set(constraints.locations.cities.map(canonical))];
    }
    const locations = new Set([canonical(ircLocation.trim())]);
    for (const city of (constraints.locations?.cities ?? [])) {
      locations.add(canonical(city));
    }
    return [...locations];
  }

  /** Resolves the effective experience range; query exact/range overrides IRC range. */
  private resolveEffectiveExp(
    qc: QueryConstraints,
    ircRange: { min: number; max: number },
  ): { min: number; max: number } {
    // Exact years: e.g. "3 years" → [3.0, 3.99]
    if (qc.expExact !== undefined) return { min: qc.expExact, max: qc.expExact + 0.99 };
    return qc.expRange ?? ircRange;
  }

  /**
   * Parses explicit constraints from the user's search input.
   * Query has highest priority over IRC filters.
   */
  parseQueryConstraints(query?: string): QueryConstraints {
    if (!query) return { isStrict: false, isAllCandidates: false };
    const q   = query.toLowerCase();
    const out: QueryConstraints = { isStrict: false, isAllCandidates: false };

    // Range patterns (check before exact to avoid misclassification)
    const toM  = query.match(/(\d+)\s+to\s+(\d+)\s*(?:years?|yrs?|exp(?:erience)?)?/i);
    const dashM = query.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:years?|yrs?|exp(?:erience)?)?/i);
    const betM  = query.match(/between\s+(\d+)\s+and\s+(\d+)/i);
    const plusM = query.match(/(\d+)\s*\+\s*(?:years?|yrs?)/i);

    if      (toM)   out.expRange = { min: Number(toM[1]),   max: Number(toM[2]) };
    else if (dashM) out.expRange = { min: Number(dashM[1]), max: Number(dashM[2]) };
    else if (betM)  out.expRange = { min: Number(betM[1]),  max: Number(betM[2]) };
    else if (plusM) out.expRange = { min: Number(plusM[1]), max: Infinity };

    // Exact years — only when no range detected
    if (!out.expRange) {
      const exactM = query.match(/\b(\d+)\s*(?:years?|yrs?)\b(?!\s*(?:to|[-–]|\+|\s*exp|rience))/i);
      if (exactM) out.expExact = Number(exactM[1]);
    }

    // Domain — extract the word immediately before "domain"
    const domainM   = q.match(/(\w+(?:\s+\w+)?)\s+domain/);
    const industryM = q.match(/(\w+)\s+(?:industry|sector)/);
    const domains: string[] = [];
    if (domainM)   domains.push(domainM[1].trim().split(/\s+/).pop()!);
    if (industryM) domains.push(industryM[1].trim());
    // Also catch bare domain names like "fintech", "banking" without the word "domain"
    for (const key of Object.keys(DOMAIN_KEYWORD_MAP)) {
      if (q.includes(key) && !domains.includes(key)) domains.push(key);
    }
    if (domains.length) out.domains = [...new Set(domains)];

    // Remote policy: "remote", "wfh", "work from home" → Remote; "hybrid" → Hybrid; "onsite/office" → On-site
    if (/\b(?:remote\s+only|fully\s+remote|work\s+from\s+home|wfh)\b/i.test(query)) {
      out.remotePolicy = 'Remote';
    } else if (/\bhybrid\b/i.test(query)) {
      out.remotePolicy = 'Hybrid';
    } else if (/\b(?:onsite|on-site|in.?office|office\s+only)\b/i.test(query)) {
      out.remotePolicy = 'On-site';
    }

    // Joining notice: "immediate", "can join in X days/weeks", "notice ≤ X"
    const immediateM = /\b(?:immediate(?:ly)?|can\s+join\s+immediately|available\s+now)\b/i.test(query);
    if (immediateM) out.joiningNoticeDays = 0;
    else {
      const noticeM = query.match(/(?:join\s+in|notice\s+(?:of|period)?|within)\s*(\d+)\s*(day|week|month)/i);
      if (noticeM) {
        const n = Number(noticeM[1]);
        const unit = noticeM[2].toLowerCase();
        out.joiningNoticeDays = unit.startsWith('week') ? n * 7 : unit.startsWith('month') ? n * 30 : n;
      }
    }
    const isExtend = /\b(?:also|include|consider|as well|too)\b/i.test(query);
    const cities: string[] = [];
    for (const city of KNOWN_LOCATIONS) {
      if (q.includes(city)) cities.push(LOCATION_ALIASES[city] ?? city);
    }
    // Only treat as explicit location if it follows a location indicator
    const hasLocIndicator = /\b(?:from|in|at|based in|located in)\b/i.test(query);
    if (cities.length > 0 && (hasLocIndicator || isExtend)) {
      out.locations = { cities: [...new Set(cities)], isOverride: hasLocIndicator && !isExtend };
    }

    // Strict mode: user used keywords that mean constraints are non-negotiable
    out.isStrict = /\b(?:only|strictly|must(?:\s+have)?|exact(?:ly)?|no\s+other|mandatory|required|restrict(?:ed)?|limit(?:ed)?\s+to)\b/i.test(query);

    // All-candidates mode: user wants the full set without IRC skill-overlap pre-filter
    out.isAllCandidates = /\ball\s+(?:candidates?|employees?|people|profiles?|results?|data|the\s+candidates?)\b/i.test(query)
      || /\b(?:show|give|get|fetch|list)\s+(?:me\s+)?all\b/i.test(query)
      || /\beveryone\b/i.test(query)
      || /\bfull\s+(?:list|results?|set)\b/i.test(query);

    return out;
  }

  /**
   * Filters pool to candidates whose projectHistory contains at least one domain keyword.
   * Returns full pool unchanged when no domains are requested.
   */
  filterByDomain(pool: PoolCandidate[], domains: string[]): PoolCandidate[] {
    if (!domains.length) return pool;
    const keywords = this.expandDomainKeywords(domains);
    return pool.filter(c =>
      c.projectHistory.some(p =>
        // Check explicit domain tags first (faster, more reliable), then fall back to description
        p.domainTags.some(tag => keywords.some(kw => tag.toLowerCase().includes(kw))) ||
        keywords.some(kw => p.description.toLowerCase().includes(kw)),
      ),
    );
  }

  private expandDomainKeywords(domains: string[]): string[] {
    const keywords = new Set<string>();
    for (const domain of domains) {
      keywords.add(domain.toLowerCase());
      const direct = DOMAIN_KEYWORD_MAP[domain.toLowerCase()];
      if (direct) direct.forEach(k => keywords.add(k));
      // Partial match against map keys
      for (const [key, vals] of Object.entries(DOMAIN_KEYWORD_MAP)) {
        if (domain.toLowerCase().includes(key) || key.includes(domain.toLowerCase())) {
          vals.forEach(k => keywords.add(k));
        }
      }
    }
    return [...keywords];
  }

  /** Filters pool to candidates who satisfy the experience range and location requirement. */
  applyEligibilityFilter(
    pool: PoolCandidate[],
    expRange: { min: number; max: number },
    effectiveLocations: string[],
  ): PoolCandidate[] {
    const canonical = (s: string) => (LOCATION_ALIASES[s.toLowerCase()] ?? s.toLowerCase());
    return pool.filter(c => {
      const expOk = c.experienceYears >= expRange.min && c.experienceYears <= expRange.max;
      const locOk = effectiveLocations.length === 0 ||
        effectiveLocations.some(l => canonical(c.location).includes(l));
      return expOk && locOk;
    });
  }
}