import { BadRequestException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { JD_TEXT_MAX_LENGTH, MIN_VECTOR_RESULTS, VECTOR_PRE_FILTER_LIMIT } from '../common/constants/search.constants';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDto } from './dto/search.dto';
import { LlmService, PoolCandidate, RankedItem, IrcWithProject } from './llm.service';
import { HeuristicService } from './heuristic.service';
import { EmbeddingService } from './embedding.service';
import { writeSearchLog } from '../common/utils/search-logger.util';

// Type for Employee with related data from Prisma
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
    private readonly config:     ConfigService,
    private readonly llm:        LlmService,
    private readonly heuristic:  HeuristicService,
    private readonly embedding:  EmbeddingService,
  ) {}

  async search(user: JwtPayload, dto: SearchDto, jdFilename?: string) {
    // Step 1: load IRC + project
    const irc = await this.prisma.irc.findUnique({
      where: { id: dto.ircId },
      include: { project: true },
    });
    if (!irc) throw new NotFoundException('IRC not found');
    if (irc.status !== 'Open') throw new BadRequestException('IRC is not Open (R2)');

    // Step 1.5: validate manager query against effective IRC/JD context before searching
    if (dto.query?.trim()) {
      await this.runQueryValidation(irc, dto.jdText, dto.query);
    }

    // Step 2: build candidate pool
    const pool = await this.buildPool(dto, irc.id);
    this.logger.log(
      `Pool built — ${pool.length} candidates | scope=${dto.scope} | query="${(dto.query ?? '').slice(0, 80)}" | jdText=${dto.jdText ? `${dto.jdText.length} chars` : 'none'}`,
    );
    if (pool.length === 0) return [];

    // Step 3: rank — LLM with heuristic fallback on any failure
    let ranked: RankedItem[];
    try {
      // Use heuristic directly when RANKING_PROVIDER=heuristic
      if (this.config.get<string>('rankingProvider') === 'heuristic') {
        throw new Error('heuristic-only mode');
      }
      ranked = await this.llm.rank(irc, pool, dto.query, dto.jdText);
      // Filter hallucinated employeeIds not present in our pool
      const poolIds = new Set(pool.map(c => c.employeeId));
      ranked = ranked.filter(r => poolIds.has(r.employeeId));
    } catch (err) {
      this.logger.warn(`LLM failed — heuristic fallback: ${(err as Error).message}`);
      ranked = this.heuristic.rank(irc, pool);
    }

    // Step 4: re-hydrate — ALL display fields from DB, never from model (per instructions)
    const employeeMap = await this.rehydrate(ranked.map(r => r.employeeId));

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
          // guard: never expose a note when conflict=false; supply fallback when conflict=true but model omitted it
          conflictNote:      r.conflict ? (r.conflictNote ?? 'Availability conflict with project start date') : null,
          isDuplicate:       !!dup,
          duplicateNote:     dup ?? null,
          alreadyInPipeline: inThisPipeline.has(r.employeeId),
          pipelineCandidateId: inThisPipeline.get(r.employeeId) ?? null,
          email:             emp.email,
        };
      });

    // R9: sort by matchPct descending
    results.sort((a, b) => b.matchPct - a.matchPct || a.employeeId - b.employeeId);

    // Write full debug entry to file: pool size, query, per-candidate ranking
    writeSearchLog({
      ircId:      dto.ircId,
      ircCode:    irc.ircCode,
      scope:      dto.scope,
      query:      dto.query ?? null,
      jdChars:    dto.jdText?.length ?? 0,
      poolSize:   pool.length,
      provider:   this.config.get<string>('rankingProvider'),
      rankings:   results.map(r => ({
        employeeId: r.employeeId,
        name:       r.fullName,
        matchPct:   r.matchPct,
        whyRecommend: r.whyRecommend,
        whyNot:     r.whyNot,
      })),
    });
    this.logger.log(`Top-3 rankings: ${results.slice(0, 3).map(r => `${r.fullName}(${r.matchPct}%)`).join(', ')}`);

    // Step 8: log every search regardless of AI or heuristic path
    await this.prisma.searchLog.create({
      data: { userId: user.sub, ircId: dto.ircId, queryText: dto.query ?? null, jdFilename: jdFilename ?? null },
    });

    return results;
  }

  // ─── Pool builder ──────────────────────────────────────────────────────────

  private async buildPool(dto: SearchDto, ircId: number): Promise<PoolCandidate[]> {
    const basePool = await this.buildBasePool(dto, ircId);
    return this.applyVectorPreFilter(basePool, dto);
  }

  private async buildBasePool(dto: SearchDto, ircId: number): Promise<PoolCandidate[]> {
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

    // R15: exclude employees Rejected for this IRC — everyone else goes to LLM
    const rejectedIds = await this.prisma.pipelineCandidate
      .findMany({ where: { ircId, stage: 'Rejected' }, select: { employeeId: true } })
      .then(rows => rows.map(r => r.employeeId));

    const where: Prisma.EmployeeWhereInput = {
      ...(rejectedIds.length > 0 && { id: { notIn: rejectedIds } }),
      // No mandatory-skill pre-filter: LLM ranks by the manager's query, not IRC skills
    };

    const employees = await this.prisma.employee.findMany({
      where,
      include: { skills: { include: { skill: true } }, projectHistory: true },
    });

    return employees.map(e => this.toPoolCandidate(e));
  }

  private async applyVectorPreFilter(pool: PoolCandidate[], dto: SearchDto): Promise<PoolCandidate[]> {
    const provider = this.config.get<string>('embeddingProvider') ?? 'none';
    if (provider === 'none' || pool.length <= VECTOR_PRE_FILTER_LIMIT) return pool;

    const queryText = [dto.query, dto.jdText?.slice(0, JD_TEXT_MAX_LENGTH)]
      .filter(Boolean).join(' ').trim();
    if (!queryText) return pool;

    try {
      const similarIds = await this.embedding.findSimilar(queryText, VECTOR_PRE_FILTER_LIMIT);
      const poolMap    = new Map(pool.map(c => [c.employeeId, c]));
      const filtered   = similarIds.filter(id => poolMap.has(id)).map(id => poolMap.get(id)!);

      if (filtered.length < MIN_VECTOR_RESULTS) {
        this.logger.warn(`Vector pre-filter yielded ${filtered.length} candidates — below MIN_VECTOR_RESULTS; using full pool`);
        return pool;
      }

      this.logger.log(`Vector pre-filter: ${pool.length} → ${filtered.length} candidates`);
      return filtered;
    } catch (err) {
      this.logger.warn(`Vector pre-filter failed — using full pool: ${(err as Error).message}`);
      return pool;
    }
  }

  private toPoolCandidate(e: EmployeeWithRelations): PoolCandidate {
    return {
      employeeId:        e.id,
      skills:            e.skills.map(es => es.skill.name),
      experienceYears:   Number(e.experienceYears),
      currentAllocation: e.currentAllocation,
      availableDate:     e.availableDate,
      joiningNotice:     e.joiningNotice,
      projectHistory:    e.projectHistory.map(p => ({
        projectName: p.projectName,
        duration:    p.duration,
        description: p.description,
      })),
    };
  }

  // ─── Re-hydration + checks ─────────────────────────────────────────────────

  private async rehydrate(employeeIds: number[]) {
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        skills: { include: { skill: true } },
        user:   { select: { email: true } },
      },
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
      email:             e.user?.email ?? null,
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

  // ─── Query scope validation ────────────────────────────────────────────────

  private ircHasUsefulDetails(irc: IrcWithProject): boolean {
    return (
      irc.mandatorySkills.trim().length > 0 ||
      (irc.preferredSkills?.trim()?.length ?? 0) > 0 ||
      irc.experienceRange.trim().length > 0
    );
  }

  private async runQueryValidation(
    irc: IrcWithProject,
    jdText: string | undefined,
    query: string,
  ): Promise<void> {
    const hasIrcContext = this.ircHasUsefulDetails(irc);
    const hasJdContext  = !!jdText?.trim();

    // No context to validate against — allow search without validation
    if (!hasIrcContext && !hasJdContext) return;

    let validation: { isValid: boolean; reason: string };
    try {
      validation = await this.llm.validateQuery(irc, jdText, query);
    } catch (err) {
      // Validation LLM failure — do not block search on model unavailability
      this.logger.warn(`Query validation unavailable — allowing search: ${(err as Error).message}`);
      return;
    }

    if (!validation.isValid) {
      throw new UnprocessableEntityException(validation.reason);
    }
  }

}
