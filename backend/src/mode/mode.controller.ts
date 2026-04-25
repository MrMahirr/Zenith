import { Controller, Get, Query } from '@nestjs/common';
import { ModeService } from './mode.service';

@Controller('modes')
export class ModeController {
  constructor(private readonly modeService: ModeService) {}

  /** Aktif modu döndür */
  @Get('current')
  getCurrent() {
    return this.modeService.getCurrentMode();
  }

  /** Mod değişim geçmişini döndür */
  @Get('history')
  async getHistory(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours, 10) : 24;
    return this.modeService.getHistory(h);
  }

  /** Mod kullanım istatistikleri */
  @Get('stats')
  async getStats(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours, 10) : 24;
    return this.modeService.getUsageStats(h);
  }
}
