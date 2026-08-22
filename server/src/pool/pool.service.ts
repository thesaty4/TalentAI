import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryPoolDto } from './dto/query-pool.dto';

const SKILLS_INCLUDE = {
  skills: { include: { skill: { select: { name: true } } } },
  pipelineCandidates: {
    where:   { stage: { not: 'Rejected' } },
    include: { irc: { select: { ircCode: true } } },
    orderBy: { id: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.EmployeeInclude;

type PoolEmployee = Prisma.EmployeeGetPayload<{ include: typeof SKILLS_INCLUDE }>;

const SORT_COLS: Record<string, Prisma.EmployeeOrderByWithRelationInput> = {
  fullName:        { fullName:        'asc' },
  experienceYears: { experienceYears: 'asc' },
  benchStatus:     { benchStatus:     'asc' },
};

@Injectable()
export class PoolService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: QueryPoolDto) {
    const where  = this.buildWhere(dto);
    const order  = dto.sortBy ?? 'fullName';
    const dir    = dto.sortOrder ?? 'asc';
    const orderBy: Prisma.EmployeeOrderByWithRelationInput = { ...SORT_COLS[order], [order]: dir };
    const page   = dto.page  ?? 1;
    const limit  = dto.limit ?? 20;

    const [total, rows] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where, include: SKILLS_INCLUDE, orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(r => this.toRow(r)),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async exportCsv(dto: QueryPoolDto): Promise<string> {
    const rows = await this.prisma.employee.findMany({
      where:   this.buildWhere(dto),
      include: SKILLS_INCLUDE,
      orderBy: { fullName: 'asc' },
    });

    const header = 'Employee Code,Name,Role,BU,Location,Exp (yrs),Status,Skills,Available Date';
    const lines  = rows.map(r => {
      const skills    = r.skills.map(es => es.skill.name).join('; ');
      const available = r.availableDate ? r.availableDate.toISOString().slice(0, 10) : '';
      return [
        r.employeeCode, `"${r.fullName}"`, `"${r.roleTitle}"`, `"${r.businessUnit}"`,
        r.location, Number(r.experienceYears), r.benchStatus, `"${skills}"`, available,
      ].join(',');
    });
    return [header, ...lines].join('\n');
  }

  private buildWhere(dto: QueryPoolDto): Prisma.EmployeeWhereInput {
    const skillNames = dto.skills?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    const expFilter  =
      dto.minExp !== undefined || dto.maxExp !== undefined
        ? {
            ...(dto.minExp !== undefined && { gte: dto.minExp }),
            ...(dto.maxExp !== undefined && { lte: dto.maxExp }),
          }
        : undefined;

    return {
      ...(dto.search && {
        OR: [
          { fullName:  { contains: dto.search, mode: 'insensitive' } },
          { roleTitle: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...(dto.location     && { location:     dto.location }),
      ...(dto.businessUnit && { businessUnit: dto.businessUnit }),
      ...(dto.benchStatus  && { benchStatus:  dto.benchStatus }),
      // Forecast to Pool = Allocated with a known return date
      ...(dto.forecasted   && { availableDate: { not: null } }),
      ...(expFilter        && { experienceYears: expFilter }),
      // All listed skills must be present — Prisma AND with multiple `some` conditions
      ...(skillNames.length > 0 && {
        AND: skillNames.map(name => ({
          skills: { some: { skill: { name } } },
        })),
      }),
    };
  }

  private toRow(r: PoolEmployee) {
    return {
      id:                r.id,
      employeeCode:      r.employeeCode,
      fullName:          r.fullName,
      roleTitle:         r.roleTitle,
      businessUnit:      r.businessUnit,
      location:          r.location,
      experienceYears:   Number(r.experienceYears),
      benchStatus:       r.benchStatus,
      currentAllocation: r.currentAllocation,
      availableDate:     r.availableDate,
      skills:            r.skills.map(es => es.skill.name),
      activeIrcCode:     r.pipelineCandidates[0]?.irc.ircCode ?? null,
    };
  }
}
