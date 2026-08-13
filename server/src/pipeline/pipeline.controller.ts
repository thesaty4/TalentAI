import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AddFeedbackDto } from './dto/add-feedback.dto';
import { NotFitDto } from './dto/not-fit.dto';
import { QueryPipelineDto } from './dto/query-pipeline.dto';
import { ShortlistDto } from './dto/shortlist.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { PipelineService } from './pipeline.service';

@ApiTags('pipeline')
@ApiBearerAuth()
@Roles(Role.manager, Role.hr)
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  @ApiOperation({ summary: 'List pipeline entries — manager: own projects only (R18)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() dto: QueryPipelineDto) {
    return this.pipelineService.findAll(user, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Shortlist a candidate to an IRC — R4 uniqueness enforced' })
  shortlist(@CurrentUser() user: JwtPayload, @Body() dto: ShortlistDto) {
    return this.pipelineService.shortlist(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Move stage forward (R12) or backward with note (R13)' })
  @ApiParam({ name: 'id', type: Number })
  updateStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pipelineService.updateStage(id, dto, user);
  }

  @Post(':id/not-fit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject with reason — R14; writes NotFitFeedback row' })
  @ApiParam({ name: 'id', type: Number })
  notFit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NotFitDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pipelineService.notFit(id, dto, user);
  }

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Re-add a rejected candidate as a fresh AI Shortlisted entry (R15a)' })
  @ApiParam({ name: 'id', type: Number })
  reactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pipelineService.reactivate(id, user);
  }

  @Get(':id/feedback')
  @ApiOperation({ summary: 'List feedback rounds for a pipeline entry' })
  @ApiParam({ name: 'id', type: Number })
  getFeedback(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pipelineService.getFeedback(id, user);
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Add a feedback/interview round — R17' })
  @ApiParam({ name: 'id', type: Number })
  addFeedback(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddFeedbackDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pipelineService.addFeedback(id, dto, user);
  }
}
