import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Roles(Role.manager, Role.hr)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects — manager: own only (R18), HR: all (R19)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryProjectsDto) {
    return this.projectsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project with IRC summary list' })
  @ApiParam({ name: 'id', type: Number })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.findOne(id, user);
  }

  @Get(':id/ircs')
  @ApiOperation({ summary: 'Full IRC list for a project (manager: must own — R18)' })
  @ApiParam({ name: 'id', type: Number })
  findIrcs(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.findIrcs(id, user);
  }
}
