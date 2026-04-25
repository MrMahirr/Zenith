import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModeChange } from '../database/entities/mode-change.entity';
import { ModeService } from './mode.service';
import { ModeController } from './mode.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ModeChange])],
  controllers: [ModeController],
  providers: [ModeService],
  exports: [ModeService],
})
export class ModeModule {}
