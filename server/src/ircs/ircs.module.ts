import { Module } from '@nestjs/common';
import { IrcsController } from './ircs.controller';
import { IrcsService } from './ircs.service';

@Module({
  controllers: [IrcsController],
  providers: [IrcsService],
})
export class IrcsModule {}
