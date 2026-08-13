import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CandidateService } from './candidate.service';

@ApiTags('candidate')
@ApiBearerAuth()
@Roles(Role.candidate)
@Controller('candidate')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get('open-ircs')
  @ApiOperation({ summary: 'Open IRCs the candidate can apply to; hasApplied flag per IRC' })
  getOpenIrcs(@CurrentUser() user: JwtPayload) {
    return this.candidateService.getOpenIrcs(user);
  }

  @Post('apply/:ircId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply to an Open IRC — R2, R4 enforced' })
  @ApiParam({ name: 'ircId', type: Number })
  apply(@CurrentUser() user: JwtPayload, @Param('ircId', ParseIntPipe) ircId: number) {
    return this.candidateService.apply(user, ircId);
  }

  @Get('my-pipeline')
  @ApiOperation({ summary: 'All pipeline entries for this candidate with stage + feedback (R20)' })
  getMyPipeline(@CurrentUser() user: JwtPayload) {
    return this.candidateService.getMyPipeline(user);
  }

  @Get('feedback')
  @ApiOperation({ summary: 'All feedback rounds across this candidate\'s pipeline entries (R17, R20)' })
  getFeedback(@CurrentUser() user: JwtPayload) {
    return this.candidateService.getFeedback(user);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Future-dated interview rounds for this candidate' })
  getUpcoming(@CurrentUser() user: JwtPayload) {
    return this.candidateService.getUpcoming(user);
  }
}
