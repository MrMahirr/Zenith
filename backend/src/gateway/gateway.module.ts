import { Module } from '@nestjs/common';
import { ZenithGateway } from './zenith.gateway';
import { SensorModule } from '../sensor/sensor.module';
import { PostureModule } from '../posture/posture.module';
import { ModeModule } from '../mode/mode.module';
import { NfcModule } from '../nfc/nfc.module';

import { LedModule } from '../led/led.module';
import { CameraModule } from '../camera/camera.module';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [
    SensorModule,
    PostureModule,
    ModeModule,
    NfcModule,
    LedModule,
    CameraModule,
    StatusModule,
  ],
  providers: [ZenithGateway],
  exports: [ZenithGateway],
})
export class GatewayModule {}

