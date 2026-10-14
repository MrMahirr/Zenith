import { Controller, Get, Query } from '@nestjs/common';
import { SensorService } from './sensor.service';
import { HoursQueryDto } from '../common/dto/hours-query.dto';

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
  async getHistory(@Query() query: HoursQueryDto) {
    return this.sensorService.getHistory(query.hours);
  }
}
