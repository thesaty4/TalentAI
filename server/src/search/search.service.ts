import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MAX_GEMINI_CANDIDATES } from '../common/constants/search.constants';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDto } from './dto/search.dto';
import { GeminiService, PoolCandidate, RankedItem } from './gemini.service';
import { HeuristicService } from './heuristic.service';

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
    private readonly gemini:     GeminiService,
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
    const pool = await this.buildPool(dto, irc.id, irc.mandatorySkills);
    if (pool.length === 0) return [];

    // Step 3: rank — Gemini with heuristic fallback on any error
    let ranked: RankedItem[];
    try {
      ranked = await this.gemini.rank(irc, pool, dto.query, dto.jdText);
      // Filter hallucinated employeeIds not present in our pool
      const poolIds = new Set(pool.map(c => c.employeeId));
      ranked = ranked.filter(r => poolIds.has(r.employeeId));
    } catch (err) {
      this.logger.warn(`Gemini failed — heuristic fallback: ${(err as Error).message}`);
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

    // R9: sort by matchPct descending
    results.sort((a, b) => b.matchPct - a.matchPct);

    // Step 8: log every search regardless of AI or heuristic path
    await this.prisma.searchLog.create({
      data: { userId: user.sub, ircId: dto.ircId, queryText: dto.query ?? null, jdFilename: jdFilename ?? null },
    });

    return results;
  }

  // ─── Pool builder ──────────────────────────────────────────────────────────

  private async buildPool(dto: SearchDto, ircId: number, mandatorySkills: string): Promise<PoolCandidate[]> {
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
      ...(mandatory.length === 0 && { take: MAX_GEMINI_CANDIDATES }),
    });

    if (mandatory.length === 0) return employees.map(e => this.toPoolCandidate(e));

    // Sort by mandatory-skill overlap descending; keep top MAX_GEMINI_CANDIDATES
    return employees
      .map(e => {
        const empSkills = e.skills.map(es => es.skill.name.toLowerCase());
        const overlap   = mandatory.filter(s => empSkills.includes(s.toLowerCase())).length;
        return { e, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, MAX_GEMINI_CANDIDATES)
      .map(({ e }) => this.toPoolCandidate(e));
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
