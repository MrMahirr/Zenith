import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';

@Module({
  imports: [SettingsModule],
  controllers: [CameraController],
  providers: [CameraService],
  exports: [CameraService],
})
export class CameraModule {}
