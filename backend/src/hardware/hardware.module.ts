import { Module } from '@nestjs/common';
import { DisplayModule } from '../display/display.module';
import { StatusModule } from '../status/status.module';
import { HardwareController } from './hardware.controller';
import { HardwareService } from './hardware.service';

@Module({
  imports: [StatusModule, DisplayModule],
  controllers: [HardwareController],
  providers: [HardwareService],
  exports: [HardwareService],
})
export class HardwareModule {}
