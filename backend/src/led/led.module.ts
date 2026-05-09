import { Module } from '@nestjs/common';
import { LedService } from './led.service';

@Module({
  providers: [LedService],
  exports: [LedService],
})
export class LedModule {}
