import { Module } from '@nestjs/common';
import { ZenithGateway } from './zenith.gateway';
import { SensorModule } from '../sensor/sensor.module';
import { PostureModule } from '../posture/posture.module';
import { ModeModule } from '../mode/mode.module';
import { NfcModule } from '../nfc/nfc.module';

import { LedModule } from '../led/led.module';
import { CameraModule } from '../camera/camera.module';
import { StatusModule } from '../status/status.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { HardwareModule } from '../hardware/hardware.module';

@Module({
  imports: [
    SensorModule,
    PostureModule,
    ModeModule,
    NfcModule,
    LedModule,
    CameraModule,
    StatusModule,
    PreferencesModule,
    HardwareModule,
  ],
  providers: [ZenithGateway],
  exports: [ZenithGateway],
})
export class GatewayModule {}

