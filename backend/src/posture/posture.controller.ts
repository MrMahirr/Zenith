import { Controller, Get, Query } from '@nestjs/common';
import { PostureService } from './posture.service';
import { HoursQueryDto } from '../common/dto/hours-query.dto';

@Controller('posture')
export class PostureController {
  constructor(private readonly postureService: PostureService) {}

  /** Anlık duruş durumunu döndür */
  @Get('current')
  getCurrent() {
    return this.postureService.getCurrentStatus();
  }

  /** Geçmiş postür event'lerini döndür */
  @Get('history')
  async getHistory(@Query() query: HoursQueryDto) {
    return this.postureService.getHistory(query.hours);
  }

  /** Postür istatistiklerini döndür */
  @Get('stats')
  async getStats(@Query() query: HoursQueryDto) {
    return this.postureService.getStats(query.hours);
  }

  /** Kambur duruş loglarını döndür */
  @Get('slouch-logs')
  async getSlouchLogs(@Query() query: HoursQueryDto) {
    return this.postureService.getSlouchLogs(query.hours);
  }
}
