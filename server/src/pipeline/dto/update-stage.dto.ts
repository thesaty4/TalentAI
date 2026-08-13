import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PIPELINE_STAGES } from '../../common/constants/pipeline.constants';

const DIRECTIONS = ['forward', 'backward'] as const;

export class UpdateStageDto {
  @ApiProperty({ enum: PIPELINE_STAGES })
  @IsIn([...PIPELINE_STAGES])
  stage!: string;

  @ApiProperty({ enum: DIRECTIONS })
  @IsIn([...DIRECTIONS])
  direction!: (typeof DIRECTIONS)[number];

  @ApiPropertyOptional({ description: 'Required by UX for backward transitions (R13)' })
  @IsOptional()
  @IsString()
  note?: string;
}
