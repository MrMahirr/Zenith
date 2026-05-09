import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { PostureEvent } from '../database/entities/posture-event.entity';
import { PostureMinuteSummary } from '../database/entities/posture-minute-summary.entity';
import {
  MAX_HISTORY_POINTS,
  RAW_RETENTION_HOURS,
} from '../database/retention.constants';

export interface PostureHistoryPoint {
  createdAt: string | Date;
  isSlouching: boolean;
  distance: number;
  sampleCount: number;
  slouchPercentage: number;
}

interface PostureSummaryRow {
  minuteBucket: string;
  eventCount: number;
  slouchCount: number;
  avgDistance: number;
  sourceMaxCreatedAt: string;
}

interface PostureHistoryRow {
  createdAt: string;
  isSlouching: number;
  distance: number;
  sampleCount: number;
  slouchPercentage: number;
}

interface PostureStatsRow {
  totalEvents: number;
  slouchCount: number;
}

@Injectable()
export class PostureService implements OnModuleInit {
  private readonly logger = new Logger(PostureService.name);
  private currentStatus: { isSlouching: boolean; distance: number } = {
    isSlouching: false,
    distance: 0,
  };
  private writeBuffer: Array<{
    isSlouching: boolean;
    distance: number;
    createdAt: string;
  }> = [];
  private readonly BATCH_SIZE = 6; // ~30 saniyede bir toplu yazım (5s * 6)

  constructor(
    @InjectRepository(PostureEvent)
    private readonly postureRepo: Repository<PostureEvent>,
    @InjectRepository(PostureMinuteSummary)
    private readonly postureSummaryRepo: Repository<PostureMinuteSummary>,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    void this.compactOldEvents('startup');
  }

  async saveEvent(data: {
    kambur_mu: boolean;
    mesafe: number;
  }): Promise<void> {
    const now = new Date();
    const createdAtStr = this.toSqliteDateTime(now);

    this.currentStatus = {
      isSlouching: data.kambur_mu,
      distance: data.mesafe,
    };

    this.writeBuffer.push({
      isSlouching: data.kambur_mu,
      distance: data.mesafe,
      createdAt: createdAtStr,
    });

    const status = data.kambur_mu ? 'SLOUCHING' : 'UPRIGHT';
    this.logger.debug(
      `Posture cached: ${status} | Distance: ${data.mesafe.toFixed(3)} (Buffer size: ${this.writeBuffer.length}/${this.BATCH_SIZE})`,
    );

    if (this.writeBuffer.length >= this.BATCH_SIZE) {
      const bufferToInsert = [...this.writeBuffer];
      this.writeBuffer = [];

      // SQLite üzerinde tek tek yazmak yerine transaction ile toplu yazım (Batch Insert) yapıyoruz.
      // SOLID/IoC ve 'hiçbir şekilde TypeORM kullanmama' kuralına uygun olarak Raw SQL kullanılmıştır.
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        for (const item of bufferToInsert) {
          await queryRunner.query(
            `INSERT INTO posture_events (isSlouching, distance, createdAt)
             VALUES (?, ?, ?)`,
            [item.isSlouching ? 1 : 0, item.distance, item.createdAt],
          );
        }
        await queryRunner.commitTransaction();
        this.logger.log(`Successfully batch-inserted ${bufferToInsert.length} posture events via raw SQL transaction.`);
      } catch (err) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`Posture event batch insert transaction failed, restoring buffer: ${err}`);
        // Hata durumunda verinin kaybolmaması için buffer'ı geri yükleyelim
        this.writeBuffer = [...bufferToInsert, ...this.writeBuffer];
      } finally {
        await queryRunner.release();
      }
    }
  }

  getCurrentStatus() {
    return this.currentStatus;
  }

  setInactive() {
    this.currentStatus = {
      isSlouching: false,
      distance: 0,
    };
  }

  async getHistory(hours = 24): Promise<PostureHistoryPoint[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await this.queryBucketedHistory(since, hours);
    return rows.map((row) => ({
      createdAt: row.createdAt,
      isSlouching: Boolean(Number(row.isSlouching)),
      distance: Number(row.distance),
      sampleCount: Number(row.sampleCount),
      slouchPercentage: Number(row.slouchPercentage ?? 0),
    }));
  }

  async getStats(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const stats = await this.queryStats(since);
    return this.buildStats(
      Number(stats.totalEvents ?? 0),
      Number(stats.slouchCount ?? 0),
    );
  }

  /** Sadece kambur duruşları saniyelik detayda getiren log fonksiyonu */
  async getSlouchLogs(hours = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await this.dataSource.query(
      `
        SELECT id, isSlouching, distance, createdAt
        FROM posture_events
        WHERE isSlouching = 1 AND createdAt >= ?
        ORDER BY createdAt DESC
        LIMIT 100
      `,
      [this.toSqliteDateTime(since)],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      isSlouching: Boolean(Number(row.isSlouching)),
      distance: Number(row.distance),
      createdAt: row.createdAt,
    }));
  }

  @Cron('0 30 * * * *') // Her saat yarısında çalışacak şekilde hafifletildi ve sensör temizliğinden ayrıştırıldı
  async handleRetentionCron() {
    await this.compactOldEvents('scheduled');
  }

  private async compactOldEvents(trigger: 'startup' | 'scheduled') {
    const cutoff = this.getRawCutoffDate();
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const rows = (await queryRunner.query(
        `
          SELECT
            strftime('%Y-%m-%d %H:%M:00', createdAt) AS minuteBucket,
            COUNT(*) AS eventCount,
            SUM(CASE WHEN isSlouching = 1 THEN 1 ELSE 0 END) AS slouchCount,
            ROUND(AVG(distance), 4) AS avgDistance,
            MAX(createdAt) AS sourceMaxCreatedAt
          FROM posture_events
          WHERE createdAt < ?
          GROUP BY strftime('%Y-%m-%d %H:%M:00', createdAt)
          ORDER BY minuteBucket ASC
        `,
        [this.toSqliteDateTime(cutoff)],
      )) as PostureSummaryRow[];

      if (rows.length > 0) {
        await queryRunner.manager.getRepository(PostureMinuteSummary).upsert(
          rows.map((row) => ({
            minuteBucket: row.minuteBucket,
            eventCount: Number(row.eventCount),
            slouchCount: Number(row.slouchCount),
            avgDistance: Number(row.avgDistance),
            sourceMaxCreatedAt: row.sourceMaxCreatedAt,
          })),
          ['minuteBucket'],
        );
      }

      const deleteResult = await queryRunner.manager
        .getRepository(PostureEvent)
        .createQueryBuilder()
        .delete()
        .from(PostureEvent)
        .where('createdAt < :cutoff', { cutoff })
        .execute();

      await queryRunner.commitTransaction();

      const deletedCount = deleteResult.affected ?? 0;
      if (rows.length > 0 || deletedCount > 0) {
        this.logger.log(
          `Posture retention ${trigger}: ${deletedCount} raw rows compacted into ${rows.length} minute summaries`,
        );
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Posture retention failed: ${error}`);
    } finally {
      await queryRunner.release();
    }
  }

  private getRawCutoffDate() {
    return new Date(Date.now() - RAW_RETENTION_HOURS * 60 * 60 * 1000);
  }

  private buildStats(totalEvents: number, slouchCount: number) {
    if (totalEvents === 0) {
      return { totalEvents: 0, slouchPercentage: 0, goodPercentage: 100 };
    }

    const slouchPercentage = Math.round((slouchCount / totalEvents) * 100);
    return {
      totalEvents,
      slouchPercentage,
      goodPercentage: 100 - slouchPercentage,
    };
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
              CASE
                WHEN SUM(CASE WHEN isSlouching = 1 THEN 1 ELSE 0 END) * 2 >= COUNT(*)
                THEN 1
                ELSE 0
              END AS isSlouching,
              ROUND(SUM(CASE WHEN isSlouching = 1 THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 1) AS slouchPercentage,
              ROUND(AVG(distance), 4) AS distance,
              COUNT(*) AS sampleCount
            FROM posture_events
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
      ) as Promise<PostureHistoryRow[]>;
    }

    return this.dataSource.query(
      `
        SELECT *
        FROM (
          SELECT
            datetime(CAST(source.pointTs / ? AS INTEGER) * ?, 'unixepoch') AS createdAt,
            CASE
              WHEN SUM(source.slouchWeighted) * 2 >= SUM(source.sampleCount)
              THEN 1
              ELSE 0
            END AS isSlouching,
            ROUND(SUM(source.slouchWeighted) * 100.0 / SUM(source.sampleCount), 1) AS slouchPercentage,
            ROUND(SUM(source.distanceWeighted) / SUM(source.sampleCount), 4) AS distance,
            SUM(source.sampleCount) AS sampleCount
          FROM (
            SELECT
              CAST(strftime('%s', minuteBucket) AS INTEGER) AS pointTs,
              slouchCount AS slouchWeighted,
              avgDistance * eventCount AS distanceWeighted,
              eventCount AS sampleCount
            FROM posture_minute_summaries
            WHERE minuteBucket >= ?
              AND minuteBucket < ?

            UNION ALL

            SELECT
              CAST(strftime('%s', createdAt) AS INTEGER) AS pointTs,
              CASE WHEN isSlouching = 1 THEN 1 ELSE 0 END AS slouchWeighted,
              distance AS distanceWeighted,
              1 AS sampleCount
            FROM posture_events
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
    ) as Promise<PostureHistoryRow[]>;
  }

  private async queryStats(since: Date) {
    const rawCutoff = this.getRawCutoffDate();

    if (since >= rawCutoff) {
      const [row] = (await this.dataSource.query(
        `
          SELECT
            COUNT(*) AS totalEvents,
            SUM(CASE WHEN isSlouching = 1 THEN 1 ELSE 0 END) AS slouchCount
          FROM posture_events
          WHERE createdAt >= ?
        `,
        [this.toSqliteDateTime(since)],
      )) as PostureStatsRow[];

      return row ?? { totalEvents: 0, slouchCount: 0 };
    }

    const [row] = (await this.dataSource.query(
      `
        SELECT
          SUM(source.totalEvents) AS totalEvents,
          SUM(source.slouchCount) AS slouchCount
        FROM (
          SELECT
            eventCount AS totalEvents,
            slouchCount
          FROM posture_minute_summaries
          WHERE minuteBucket >= ?
            AND minuteBucket < ?

          UNION ALL

          SELECT
            1 AS totalEvents,
            CASE WHEN isSlouching = 1 THEN 1 ELSE 0 END AS slouchCount
          FROM posture_events
          WHERE createdAt >= ?
        ) AS source
      `,
      [
        this.toSqliteDateTime(since),
        this.toSqliteDateTime(rawCutoff),
        this.toSqliteDateTime(rawCutoff),
      ],
    )) as PostureStatsRow[];

    return row ?? { totalEvents: 0, slouchCount: 0 };
  }

  private getBucketSizeSeconds(hours: number) {
    return Math.max(60, Math.ceil((hours * 60 * 60) / MAX_HISTORY_POINTS));
  }

  private toSqliteDateTime(value: Date) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
}
