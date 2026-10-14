import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { LedService } from './led.service';

@Module({
  imports: [SettingsModule],
  providers: [LedService],
  exports: [LedService],
})
export class LedModule {}
