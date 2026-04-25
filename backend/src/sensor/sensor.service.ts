import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { SensorReading } from '../database/entities/sensor-reading.entity';

@Injectable()
export class SensorService {
  private readonly logger = new Logger(SensorService.name);
  private latestReading: Partial<SensorReading> | null = null;

  constructor(
    @InjectRepository(SensorReading)
    private readonly sensorRepo: Repository<SensorReading>,
  ) {}

  /** Yeni sensör verisini DB'ye kaydet ve cache'le */
  async saveReading(data: { temp: number; humidity: number; pressure: number }): Promise<SensorReading> {
    const reading = this.sensorRepo.create({
      temperature: data.temp,
      humidity: data.humidity,
      pressure: data.pressure,
    });

    const saved = await this.sensorRepo.save(reading);
    this.latestReading = saved;
    this.logger.log(`Sensör kaydedildi: ${data.temp}°C | %${data.humidity} | ${data.pressure}hPa`);
    return saved;
  }

  /** En son okunan sensör değerini döndür */
  getLatest(): Partial<SensorReading> | null {
    return this.latestReading;
  }

  /** Belirli zaman aralığındaki geçmiş verileri getir */
  async getHistory(hours: number = 24): Promise<SensorReading[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.sensorRepo.find({
      where: { createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'ASC' },
    });
  }
}
