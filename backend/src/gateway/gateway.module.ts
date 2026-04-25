import { Module } from '@nestjs/common';
import { ZenithGateway } from './zenith.gateway';
import { SensorModule } from '../sensor/sensor.module';
import { PostureModule } from '../posture/posture.module';
import { ModeModule } from '../mode/mode.module';

@Module({
  imports: [SensorModule, PostureModule, ModeModule],
  providers: [ZenithGateway],
  exports: [ZenithGateway],
})
export class GatewayModule {}
