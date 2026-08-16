import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MAX_RANKING_CANDIDATES } from '../common/constants/search.constants';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDto } from './dto/search.dto';
import { LlmService, PoolCandidate, RankedItem, IrcWithProject } from './llm.service';
import { HeuristicService } from './heuristic.service';
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

}
