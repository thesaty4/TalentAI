import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class NotFitDto {
  @ApiProperty({ description: 'Reason for rejection — R14' })
  @IsString()
  @MinLength(3)
  reason!: string;
}
