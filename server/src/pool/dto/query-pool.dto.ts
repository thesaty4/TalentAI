import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

const SORT_FIELDS  = ['fullName', 'experienceYears', 'benchStatus'] as const;
const SORT_ORDERS  = ['asc', 'desc'] as const;
const BENCH_VALUES = ['Bench', 'Allocated'] as const;

export class QueryPoolDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'fullName or roleTitle contains (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessUnit?: string;

  @ApiPropertyOptional({ enum: BENCH_VALUES })
  @IsOptional()
  @IsIn([...BENCH_VALUES])
  benchStatus?: string;

  @ApiPropertyOptional({ description: 'Comma-separated skill names; employee must have ALL' })
  @IsOptional()
  @IsString()
  skills?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minExp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxExp?: number;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'fullName' })
  @IsOptional()
  @IsIn([...SORT_FIELDS])
  sortBy?: (typeof SORT_FIELDS)[number] = 'fullName';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'asc' })
  @IsOptional()
  @IsIn([...SORT_ORDERS])
  sortOrder?: (typeof SORT_ORDERS)[number] = 'asc';

  @ApiPropertyOptional({ description: 'Pass "csv" to download as file' })
  @IsOptional()
  @IsString()
  export?: string;
}
