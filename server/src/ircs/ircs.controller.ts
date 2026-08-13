import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { IrcsService } from './ircs.service';

@ApiTags('ircs')
@ApiBearerAuth()
@Roles(Role.manager, Role.hr)
@Controller('ircs')
export class IrcsController {
  constructor(private readonly ircsService: IrcsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get full IRC detail — used by AI Search (R3)' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ircsService.findOne(id);
  }
}
