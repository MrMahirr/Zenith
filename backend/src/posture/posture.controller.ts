import { Controller, Get, Query } from '@nestjs/common';
import { PostureService } from './posture.service';

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
  async getHistory(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours, 10) : 24;
    return this.postureService.getHistory(h);
  }

  /** Postür istatistiklerini döndür */
  @Get('stats')
  async getStats(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours, 10) : 24;
    return this.postureService.getStats(h);
  }
}
