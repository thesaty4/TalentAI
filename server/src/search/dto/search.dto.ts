import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class SearchDto {
  @ApiProperty({ description: 'Open IRC to search against (R2: must be Open)' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  ircId!: number;

  @ApiPropertyOptional({ description: 'Free-text requirement from the manager' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({ enum: ['all', 'applied'], description: 'R10: applied = only pipeline candidates' })
  @IsIn(['all', 'applied'])
  scope!: 'all' | 'applied';

  @ApiPropertyOptional({ description: 'Extracted JD text — set by upload-jd or caller (R11)' })
  @IsOptional()
  @IsString()
  jdText?: string;

  @ApiPropertyOptional({ description: 'Limit results to top N candidates. Omit (or 0) to return all.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  topN?: number;
}
