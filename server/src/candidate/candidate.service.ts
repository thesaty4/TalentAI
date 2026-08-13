import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CandidateService {
  constructor(private readonly prisma: PrismaService) {}

  async getOpenIrcs(user: JwtPayload) {
    const ircs = await this.prisma.irc.findMany({
      where: { status: 'Open' },
      include: { project: { select: { id: true, name: true, customer: true } } },
      orderBy: { openingDate: 'desc' },
    });

    // hasApplied: any PipelineCandidate row for this candidate, regardless of stage (R20)
    const appliedIrcIds = user.employeeId
      ? await this.prisma.pipelineCandidate
          .findMany({ where: { employeeId: user.employeeId }, select: { ircId: true } })
          .then(rows => new Set(rows.map(r => r.ircId)))
      : new Set<number>();

    return ircs.map(irc => ({ ...irc, hasApplied: appliedIrcIds.has(irc.id) }));
  }

  async apply(user: JwtPayload, ircId: number) {
    // Candidate must have a linked employee row to apply
    if (!user.employeeId) {
      throw new BadRequestException('Your account is not linked to an employee profile');
    }

    const irc = await this.prisma.irc.findUnique({ where: { id: ircId } });
    if (!irc) throw new NotFoundException('IRC not found');
    if (irc.status !== 'Open') throw new BadRequestException('IRC is not Open (R2)');

    // R4: one active pipeline record per (employee, IRC)
    const existing = await this.prisma.pipelineCandidate.findFirst({
      where: { employeeId: user.employeeId, ircId, isActive: true },
    });
    if (existing) throw new ConflictException('You have already applied to this IRC');

    return this.prisma.pipelineCandidate.create({
      data: { employeeId: user.employeeId, ircId, stage: 'AI Shortlisted' },
      include: {
        irc: { select: { ircCode: true, roleTitle: true } },
      },
    });
  }

  async getMyPipeline(user: JwtPayload) {
    if (!user.employeeId) return [];

    return this.prisma.pipelineCandidate.findMany({
      where: { employeeId: user.employeeId },
      include: {
        irc: {
          select: {
            ircCode: true, roleTitle: true, location: true,
            project: { select: { name: true } },
          },
        },
        // stageHistory derived from feedbackRounds (R17 — visible to candidate)
        feedbackRounds: { orderBy: { roundDate: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getFeedback(user: JwtPayload) {
    if (!user.employeeId) return [];

    // R20: only this candidate's own feedback rounds
    const entries = await this.prisma.pipelineCandidate.findMany({
      where: { employeeId: user.employeeId },
      select: { id: true },
    });
    const entryIds = entries.map(e => e.id);

    return this.prisma.feedbackRound.findMany({
      where: { pipelineCandidateId: { in: entryIds } },
      include: {
        pipelineCandidate: {
          include: {
            irc: { select: { ircCode: true, project: { select: { name: true } } } },
          },
        },
      },
      orderBy: { roundDate: 'desc' },
    });
  }

  async getUpcoming(user: JwtPayload) {
    if (!user.employeeId) return [];

    const entries = await this.prisma.pipelineCandidate.findMany({
      where: { employeeId: user.employeeId },
      select: { id: true },
    });
    const entryIds = entries.map(e => e.id);

    return this.prisma.feedbackRound.findMany({
      where: {
        pipelineCandidateId: { in: entryIds },
        roundDate: { gte: new Date() },
      },
      include: {
        pipelineCandidate: {
          include: {
            irc: {
              select: {
                roleTitle: true,
                project: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { roundDate: 'asc' },
    });
  }
}
