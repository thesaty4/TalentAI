import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryProjectsDto {
  @ApiPropertyOptional({ description: 'Filter by status: Active | On hold | Closed' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive search on name or customer' })
  @IsOptional()
  @IsString()
  search?: string;
}
