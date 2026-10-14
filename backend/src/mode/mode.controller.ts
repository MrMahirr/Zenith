import { Controller, Get, Query } from '@nestjs/common';
import { HoursQueryDto } from '../common/dto/hours-query.dto';
import { ModeService } from './mode.service';

@Controller('modes')
export class ModeController {
  constructor(private readonly modeService: ModeService) {}

  /** Mod tanımları (ad, etiket, renk): arayüzlerin tek kaynağı. */
  @Get('config')
  getConfig() {
    return this.modeService.getConfig();
  }

  /** Aktif modu döndür. */
  @Get('current')
  getCurrent() {
    return this.modeService.getCurrentMode();
  }

  /** Mod değişim geçmişini döndür. */
  @Get('history')
  async getHistory(@Query() query: HoursQueryDto) {
    return this.modeService.getHistory(query.hours);
  }

  /** Modlarda geçirilen süre (dakika). */
  @Get('stats')
  async getStats(@Query() query: HoursQueryDto) {
    return this.modeService.getUsageStats(query.hours);
  }
}
