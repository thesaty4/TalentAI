import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class ShortlistDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  employeeId!: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  ircId!: number;
}
