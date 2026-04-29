import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { SensorReading } from '../database/entities/sensor-reading.entity';
import { SensorMinuteSummary } from '../database/entities/sensor-minute-summary.entity';
import {
  MAX_HISTORY_POINTS,
  RAW_RETENTION_HOURS,
} from '../database/retention.constants';

export interface SensorHistoryPoint {
  createdAt: string | Date;
  temperature: number;
  humidity: number;
  pressure: number;
  sampleCount: number;
}

interface SensorSummaryRow {
  minuteBucket: string;
  avgTemperature: number;
  avgHumidity: number;
  avgPressure: number;
  sampleCount: number;
  sourceMaxCreatedAt: string;
}

@Injectable()
export class SensorService implements OnModuleInit {
  private readonly logger = new Logger(SensorService.name);
  private latestReading: Partial<SensorReading> | null = null;

  constructor(
    @InjectRepository(SensorReading)
    private readonly sensorRepo: Repository<SensorReading>,
    @InjectRepository(SensorMinuteSummary)
    private readonly sensorSummaryRepo: Repository<SensorMinuteSummary>,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    void this.compactOldReadings('startup');
  }

  async saveReading(data: {
    temp: number;
    humidity: number;
    pressure: number;
  }): Promise<SensorReading> {
    const reading = this.sensorRepo.create({
      temperature: data.temp,
      humidity: data.humidity,
      pressure: data.pressure,
    });

    const saved = await this.sensorRepo.save(reading);
    this.latestReading = saved;
    this.logger.log(
      `Sensor saved: ${data.temp}C | %${data.humidity} | ${data.pressure}hPa`,
    );
    return saved;
  }

  getLatest(): Partial<SensorReading> | null {
    return this.latestReading;
  }

  async getHistory(hours = 24): Promise<SensorHistoryPoint[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rawCutoff = this.getRawCutoffDate();

    if (since >= rawCutoff) {
      const raw = await this.sensorRepo.find({
        where: { createdAt: MoreThanOrEqual(since) },
        order: { createdAt: 'ASC' },
      });
      return this.downsample(this.mapRawHistory(raw));
    }

    const [summaryRows, rawRows] = await Promise.all([
      this.getSummaryRows(since, rawCutoff),
      this.sensorRepo.find({
        where: { createdAt: MoreThanOrEqual(rawCutoff) },
        order: { createdAt: 'ASC' },
      }),
    ]);

    return this.downsample([
      ...this.mapSummaryHistory(summaryRows),
      ...this.mapRawHistory(rawRows),
    ]);
  }

  @Cron('0 */15 * * * *')
  async handleRetentionCron() {
    await this.compactOldReadings('scheduled');
  }

  private async compactOldReadings(trigger: 'startup' | 'scheduled') {
    const cutoff = this.getRawCutoffDate();
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const rows = (await queryRunner.query(
        `
          SELECT
            strftime('%Y-%m-%d %H:%M:00', createdAt) AS minuteBucket,
            ROUND(AVG(temperature), 3) AS avgTemperature,
            ROUND(AVG(humidity), 3) AS avgHumidity,
            ROUND(AVG(pressure), 3) AS avgPressure,
            COUNT(*) AS sampleCount,
            MAX(createdAt) AS sourceMaxCreatedAt
          FROM sensor_readings
          WHERE createdAt < ?
          GROUP BY strftime('%Y-%m-%d %H:%M:00', createdAt)
          ORDER BY minuteBucket ASC
        `,
        [this.toSqliteDateTime(cutoff)],
      )) as SensorSummaryRow[];

      if (rows.length > 0) {
        await queryRunner.manager.getRepository(SensorMinuteSummary).upsert(
          rows.map((row) => ({
            minuteBucket: row.minuteBucket,
            avgTemperature: Number(row.avgTemperature),
            avgHumidity: Number(row.avgHumidity),
            avgPressure: Number(row.avgPressure),
            sampleCount: Number(row.sampleCount),
            sourceMaxCreatedAt: row.sourceMaxCreatedAt,
          })),
          ['minuteBucket'],
        );
      }

      const deleteResult = await queryRunner.manager
        .getRepository(SensorReading)
        .createQueryBuilder()
        .delete()
        .from(SensorReading)
        .where('createdAt < :cutoff', { cutoff })
        .execute();

      await queryRunner.commitTransaction();

      const deletedCount = deleteResult.affected ?? 0;
      if (rows.length > 0 || deletedCount > 0) {
        this.logger.log(
          `Sensor retention ${trigger}: ${deletedCount} raw rows compacted into ${rows.length} minute summaries`,
        );
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Sensor retention failed: ${error}`);
    } finally {
      await queryRunner.release();
    }
  }

  private getRawCutoffDate() {
    return new Date(Date.now() - RAW_RETENTION_HOURS * 60 * 60 * 1000);
  }

  private async getSummaryRows(start: Date, end: Date) {
    return this.sensorSummaryRepo
      .createQueryBuilder('summary')
      .where('summary.minuteBucket >= :start', {
        start: this.toSqliteDateTime(start),
      })
      .andWhere('summary.minuteBucket < :end', {
        end: this.toSqliteDateTime(end),
      })
      .orderBy('summary.minuteBucket', 'ASC')
      .getMany();
  }

  private mapRawHistory(rows: SensorReading[]): SensorHistoryPoint[] {
    return rows.map((row) => ({
      createdAt: row.createdAt,
      temperature: row.temperature,
      humidity: row.humidity,
      pressure: row.pressure,
      sampleCount: 1,
    }));
  }

  private mapSummaryHistory(rows: SensorMinuteSummary[]): SensorHistoryPoint[] {
    return rows.map((row) => ({
      createdAt: row.minuteBucket,
      temperature: Number(row.avgTemperature),
      humidity: Number(row.avgHumidity),
      pressure: Number(row.avgPressure),
      sampleCount: row.sampleCount,
    }));
  }

  private downsample(data: SensorHistoryPoint[]) {
    if (data.length <= MAX_HISTORY_POINTS) {
      return data;
    }

    const step = Math.ceil(data.length / MAX_HISTORY_POINTS);
    return data.filter((_, index) => index % step === 0);
  }

  private toSqliteDateTime(value: Date) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
}
