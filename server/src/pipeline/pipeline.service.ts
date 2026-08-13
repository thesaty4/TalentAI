import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PIPELINE_STAGES } from '../common/constants/pipeline.constants';
import { PrismaService } from '../prisma/prisma.service';
import { AddFeedbackDto } from './dto/add-feedback.dto';
import { NotFitDto } from './dto/not-fit.dto';
import { QueryPipelineDto } from './dto/query-pipeline.dto';
import { ShortlistDto } from './dto/shortlist.dto';
import { UpdateStageDto } from './dto/update-stage.dto';

const ENTRY_INCLUDE = {
  employee: {
    include: { skills: { include: { skill: { select: { name: true } } } } },
  },
  irc: { select: { id: true, ircCode: true, roleTitle: true } },
} satisfies Prisma.PipelineCandidateInclude;

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: JwtPayload, dto: QueryPipelineDto) {
    const stages = dto.stage?.split(',').map(s => s.trim()).filter(Boolean);
    const ircFilter: Prisma.IrcWhereInput = {
      // R18: manager sees only their projects' pipeline entries
      ...(user.role === Role.manager && { project: { managerId: user.sub } }),
      ...(dto.projectId && { projectId: dto.projectId }),
    };

    const where: Prisma.PipelineCandidateWhereInput = {
      isActive: true,
      ...(Object.keys(ircFilter).length > 0 && { irc: ircFilter }),
      ...(dto.ircId   && { ircId: dto.ircId }),
      ...(stages?.length && { stage: { in: stages } }),
      ...(dto.role    && { employee: { roleTitle: { contains: dto.role, mode: 'insensitive' } } }),
    };

    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const [total, rows] = await Promise.all([
      this.prisma.pipelineCandidate.count({ where }),
      this.prisma.pipelineCandidate.findMany({
        where,
        include: ENTRY_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(r => this.toRow(r)),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async shortlist(user: JwtPayload, dto: ShortlistDto) {
    // R2: IRC must be Open
    const irc = await this.prisma.irc.findUnique({
      where: { id: dto.ircId },
      include: { project: { select: { managerId: true, name: true } } },
    });
    if (!irc) throw new NotFoundException('IRC not found');
    if (irc.status !== 'Open') throw new BadRequestException('IRC must be Open (R2)');

    // R18: manager can only shortlist into their own projects
    if (user.role === Role.manager && irc.project.managerId !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { fullName: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // R4: one active record per (employee, IRC)
    const existing = await this.prisma.pipelineCandidate.findFirst({
      where: { employeeId: dto.employeeId, ircId: dto.ircId, isActive: true, stage: { not: 'Rejected' } },
    });
    if (existing) throw new ConflictException('Candidate already in pipeline for this IRC');

    const entry = await this.prisma.pipelineCandidate.create({
      data: { employeeId: dto.employeeId, ircId: dto.ircId, stage: 'AI Shortlisted' },
      include: ENTRY_INCLUDE,
    });

    await this.notify(irc.project.managerId, user.sub,
      `${employee.fullName} shortlisted for ${irc.ircCode}`,
      `${irc.project.name} · ${irc.roleTitle}`,
    );

    return this.toRow(entry);
  }

  async updateStage(id: number, dto: UpdateStageDto, user: JwtPayload) {
    const entry = await this.findActiveEntry(id, user);

    // R15b: Allocated is terminal
    if (entry.stage === 'Allocated') {
      throw new BadRequestException('Allocated is terminal — use reactivate (R15a) to revisit');
    }

    const currentIdx = PIPELINE_STAGES.indexOf(entry.stage as (typeof PIPELINE_STAGES)[number]);
    const targetIdx  = PIPELINE_STAGES.indexOf(dto.stage as (typeof PIPELINE_STAGES)[number]);

    if (dto.direction === 'forward' && targetIdx !== currentIdx + 1) {
      throw new BadRequestException('Forward transition must advance exactly one stage (R12)');
    }
    if (dto.direction === 'backward' && targetIdx !== currentIdx - 1) {
      throw new BadRequestException('Backward transition must revert exactly one stage (R13)');
    }

    const updated = await this.prisma.pipelineCandidate.update({
      where: { id },
      data: {
        stage: dto.stage,
        ...(dto.direction === 'backward' && dto.note && { conflictNote: dto.note }),
      },
      include: ENTRY_INCLUDE,
    });

    // Write history row for every stage transition
    await this.prisma.pipelineStageHistory.create({
      data: {
        pipelineCandidateId: id,
        fromStage:   entry.stage,
        toStage:     dto.stage,
        changedById: user.sub,
        reason:      dto.direction === 'backward' ? (dto.note ?? null) : null,
      },
    });

    await this.notify(
      entry.irc.project.managerId,
      user.sub,
      `${entry.employee.fullName} moved to ${dto.stage}`,
      `${entry.irc.project.name} · ${entry.irc.ircCode}`,
    );

    return this.toRow(updated);
  }

  async notFit(id: number, dto: NotFitDto, user: JwtPayload) {
    const entry = await this.findActiveEntry(id, user);

    await this.prisma.$transaction([
      this.prisma.pipelineCandidate.update({
        where: { id },
        data: { stage: 'Rejected', isActive: false },
      }),
      this.prisma.notFitFeedback.create({
        data: { pipelineCandidateId: id, reason: dto.reason },
      }),
      this.prisma.pipelineStageHistory.create({
        data: {
          pipelineCandidateId: id,
          fromStage:   entry.stage,
          toStage:     'Rejected',
          changedById: user.sub,
          reason:      dto.reason,
        },
      }),
    ]);

    await this.notify(
      entry.irc.project.managerId,
      user.sub,
      `${entry.employee.fullName} marked not a fit`,
      `${entry.irc.project.name} · ${entry.irc.ircCode} — ${dto.reason}`,
    );

    return { message: 'Candidate marked as not a fit' };
  }

  async reactivate(id: number, user: JwtPayload) {
    // Find the specific rejected record
    const rejected = await this.prisma.pipelineCandidate.findUnique({
      where: { id },
      include: { irc: { include: { project: { select: { managerId: true, name: true } } } } },
    });
    if (!rejected) throw new NotFoundException('Pipeline entry not found');
    if (rejected.stage !== 'Rejected') throw new BadRequestException('Entry is not rejected');

    if (user.role === Role.manager && rejected.irc.project.managerId !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    // R15a: original Rejected row preserved; create a fresh record starting at AI Shortlisted
    const newEntry = await this.prisma.pipelineCandidate.create({
      data: {
        employeeId: rejected.employeeId,
        ircId:      rejected.ircId,
        stage:      'AI Shortlisted',
        isActive:   true,
      },
      include: ENTRY_INCLUDE,
    });

    return this.toRow(newEntry);
  }

  async getFeedback(id: number, user: JwtPayload) {
    await this.findActiveEntry(id, user);
    return this.prisma.feedbackRound.findMany({
      where: { pipelineCandidateId: id },
      orderBy: { roundDate: 'desc' },
    });
  }

  async addFeedback(id: number, dto: AddFeedbackDto, user: JwtPayload) {
    await this.findActiveEntry(id, user);
    return this.prisma.feedbackRound.create({
      data: { pipelineCandidateId: id, ...dto },
    });
  }

  async getStageHistory(id: number, user: JwtPayload) {
    await this.findActiveEntry(id, user);
    return this.prisma.pipelineStageHistory.findMany({
      where: { pipelineCandidateId: id },
      include: { changedBy: { select: { name: true, role: true } } },
      orderBy: { changedAt: 'desc' },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async findActiveEntry(id: number, user: JwtPayload) {
    const entry = await this.prisma.pipelineCandidate.findUnique({
      where: { id },
      include: {
        ...ENTRY_INCLUDE,
        irc: {
          include: { project: { select: { managerId: true, name: true } } },
        },
      },
    });
    if (!entry) throw new NotFoundException('Pipeline entry not found');
    if (user.role === Role.manager && entry.irc.project.managerId !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
    return entry;
  }

  private async notify(
    managerId: number | null,
    callerId: number,
    title: string,
    description: string,
  ) {
    // Only notify when the caller is not the manager themselves
    if (!managerId || managerId === callerId) return;
    await this.prisma.notification.create({
      data: { userId: managerId, title, description },
    });
  }

  private toRow(r: Prisma.PipelineCandidateGetPayload<{ include: typeof ENTRY_INCLUDE }>) {
    return {
      id:           r.id,
      stage:        r.stage,
      matchPct:     r.matchPct,
      whyRecommend: r.whyRecommend,
      whyNot:       r.whyNot,
      conflict:     r.conflict,
      conflictNote: r.conflictNote,
      appliedDate:  r.appliedDate,
      updatedAt:    r.updatedAt,
      employee: {
        id:            r.employee.id,
        fullName:      r.employee.fullName,
        roleTitle:     r.employee.roleTitle,
        location:      r.employee.location,
        experienceYears: Number(r.employee.experienceYears),
        skills:        r.employee.skills.map(es => es.skill.name),
      },
      irc: r.irc,
    };
  }
}
