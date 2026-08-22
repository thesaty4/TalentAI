import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: number, user: JwtPayload) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        skills:         { include: { skill: true } },
        projectHistory: true,
        ratings:        true,
        user:           { select: { email: true } },
        pipelineCandidates: {
          where:   { stage: { not: 'Rejected' } },
          include: { irc: { select: { id: true, ircCode: true, roleTitle: true } } },
        },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    const { pipelineCandidates, skills, user: linkedUser, ...rest } = employee;
    const shaped = {
      ...rest,
      email: linkedUser?.email ?? null,
      skills: skills.map(es => es.skill.name),
    };

    // R20: candidates cannot see another employee's pipeline status
    if (user.role === Role.candidate) return shaped;
    return { ...shaped, pipelineCandidates };
  }
}
