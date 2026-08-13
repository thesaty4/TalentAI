import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MinLength } from 'class-validator';

export class AddFeedbackDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  roundName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  interviewer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  roundDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rating?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}
