import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { QueryProjectsDto } from './dto/query-projects.dto';

const IRC_SUMMARY = {
  id: true, ircCode: true, roleTitle: true, status: true,
} satisfies Prisma.IrcSelect;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: JwtPayload, query: QueryProjectsDto) {
    const where: Prisma.ProjectWhereInput = {
      // R18: manager sees only their own projects; R19: HR sees all
      ...(user.role === Role.manager && { managerId: user.sub }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { customer: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.project.findMany({
      where,
      include: { ircs: { select: IRC_SUMMARY } },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: number, user: JwtPayload) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { ircs: { select: IRC_SUMMARY } },
    });
    if (!project) throw new NotFoundException('Project not found');
    // R18: manager can only view their own project
    if (user.role === Role.manager && project.managerId !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
    return project;
  }

  async findIrcs(projectId: number, user: JwtPayload) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { ircs: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    // R18: manager must own the project to list its IRCs
    if (user.role === Role.manager && project.managerId !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
    return project.ircs;
  }
}
