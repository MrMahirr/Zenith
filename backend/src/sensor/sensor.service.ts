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

interface SensorHistoryRow {
  createdAt: string;
  temperature: number;
  humidity: number;
  pressure: number;
  sampleCount: number;
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
    const rows = await this.queryBucketedHistory(since, hours);
    return rows.map((row) => ({
      createdAt: row.createdAt,
      temperature: Number(row.temperature),
      humidity: Number(row.humidity),
      pressure: Number(row.pressure),
      sampleCount: Number(row.sampleCount),
    }));
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

  private async queryBucketedHistory(since: Date, hours: number) {
    const rawCutoff = this.getRawCutoffDate();
    const bucketSizeSeconds = this.getBucketSizeSeconds(hours);

    if (since >= rawCutoff) {
      return this.dataSource.query(
        `
          SELECT *
          FROM (
            SELECT
              datetime(
                CAST(CAST(strftime('%s', createdAt) AS INTEGER) / ? AS INTEGER) * ?,
                'unixepoch'
              ) AS createdAt,
              ROUND(AVG(temperature), 3) AS temperature,
              ROUND(AVG(humidity), 3) AS humidity,
              ROUND(AVG(pressure), 3) AS pressure,
              COUNT(*) AS sampleCount
            FROM sensor_readings
            WHERE createdAt >= ?
            GROUP BY CAST(CAST(strftime('%s', createdAt) AS INTEGER) / ? AS INTEGER)
            ORDER BY createdAt DESC
            LIMIT ?
          ) AS bucketed
          ORDER BY createdAt ASC
        `,
        [
          bucketSizeSeconds,
          bucketSizeSeconds,
          this.toSqliteDateTime(since),
          bucketSizeSeconds,
          MAX_HISTORY_POINTS,
        ],
      ) as Promise<SensorHistoryRow[]>;
    }

    return this.dataSource.query(
      `
        SELECT *
        FROM (
          SELECT
            datetime(CAST(source.pointTs / ? AS INTEGER) * ?, 'unixepoch') AS createdAt,
            ROUND(SUM(source.temperatureWeighted) / SUM(source.sampleCount), 3) AS temperature,
            ROUND(SUM(source.humidityWeighted) / SUM(source.sampleCount), 3) AS humidity,
            ROUND(SUM(source.pressureWeighted) / SUM(source.sampleCount), 3) AS pressure,
            SUM(source.sampleCount) AS sampleCount
          FROM (
            SELECT
              CAST(strftime('%s', minuteBucket) AS INTEGER) AS pointTs,
              avgTemperature * sampleCount AS temperatureWeighted,
              avgHumidity * sampleCount AS humidityWeighted,
              avgPressure * sampleCount AS pressureWeighted,
              sampleCount
            FROM sensor_minute_summaries
            WHERE minuteBucket >= ?
              AND minuteBucket < ?

            UNION ALL

            SELECT
              CAST(strftime('%s', createdAt) AS INTEGER) AS pointTs,
              temperature AS temperatureWeighted,
              humidity AS humidityWeighted,
              pressure AS pressureWeighted,
              1 AS sampleCount
            FROM sensor_readings
            WHERE createdAt >= ?
          ) AS source
          GROUP BY CAST(source.pointTs / ? AS INTEGER)
          ORDER BY createdAt DESC
          LIMIT ?
        ) AS bucketed
        ORDER BY createdAt ASC
      `,
      [
        bucketSizeSeconds,
        bucketSizeSeconds,
        this.toSqliteDateTime(since),
        this.toSqliteDateTime(rawCutoff),
        this.toSqliteDateTime(rawCutoff),
        bucketSizeSeconds,
        MAX_HISTORY_POINTS,
      ],
    ) as Promise<SensorHistoryRow[]>;
  }

  private getBucketSizeSeconds(hours: number) {
    return Math.max(60, Math.ceil((hours * 60 * 60) / MAX_HISTORY_POINTS));
  }

  private toSqliteDateTime(value: Date) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
}
