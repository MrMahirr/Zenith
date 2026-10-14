import { Module } from '@nestjs/common';
import { PreferencesModule } from '../preferences/preferences.module';
import { DisplayService } from './display.service';

@Module({
  imports: [PreferencesModule],
  providers: [DisplayService],
  exports: [DisplayService],
})
export class DisplayModule {}
