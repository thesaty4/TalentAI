import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { QueryPoolDto } from './dto/query-pool.dto';
import { PoolService } from './pool.service';

@ApiTags('pool')
@ApiBearerAuth()
@Roles(Role.manager, Role.hr)
@Controller('pool')
export class PoolController {
  constructor(private readonly poolService: PoolService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated resource pool — manager & HR only (R20)' })
  @ApiQuery({ name: 'export', required: false, description: 'Pass "csv" for file download' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() dto: QueryPoolDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (dto.export === 'csv') {
      const csv = await this.poolService.exportCsv(dto);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="pool.csv"');
      res.send(csv);
      return;
    }
    return this.poolService.findAll(dto);
  }
}
