import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostureEvent } from '../database/entities/posture-event.entity';
import { PostureMinuteSummary } from '../database/entities/posture-minute-summary.entity';
import { PostureService } from './posture.service';
import { PostureController } from './posture.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PostureEvent, PostureMinuteSummary])],
  controllers: [PostureController],
  providers: [PostureService],
  exports: [PostureService],
})
export class PostureModule {}
