import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IrcsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: number) {
    const irc = await this.prisma.irc.findUnique({
      where: { id },
      include: {
        // project context is needed by AI Search (R3)
        project: { select: { id: true, name: true, customer: true } },
      },
    });
    if (!irc) throw new NotFoundException('IRC not found');
    return irc;
  }
}
