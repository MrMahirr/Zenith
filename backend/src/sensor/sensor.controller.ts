import { Controller, Get, Query } from '@nestjs/common';
import { SensorService } from './sensor.service';

@Controller('sensors')
export class SensorController {
  constructor(private readonly sensorService: SensorService) {}

  /** En son sensör verisini döndür */
  @Get('latest')
  getLatest() {
    return this.sensorService.getLatest() ?? { message: 'Henüz veri yok' };
  }

  /** Geçmiş sensör verilerini döndür (?hours=24 varsayılan) */
  @Get('history')
  async getHistory(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours, 10) : 24;
    return this.sensorService.getHistory(h);
  }
}
