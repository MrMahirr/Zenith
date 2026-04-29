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
}

interface PostureSummaryRow {
  minuteBucket: string;
  eventCount: number;
  slouchCount: number;
  avgDistance: number;
  sourceMaxCreatedAt: string;
}

@Injectable()
export class PostureService implements OnModuleInit {
  private readonly logger = new Logger(PostureService.name);
  private currentStatus: { isSlouching: boolean; distance: number } = {
    isSlouching: false,
    distance: 0,
  };

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
  }): Promise<PostureEvent> {
    const event = this.postureRepo.create({
      isSlouching: data.kambur_mu,
      distance: data.mesafe,
    });

    const saved = await this.postureRepo.save(event);
    this.currentStatus = {
      isSlouching: data.kambur_mu,
      distance: data.mesafe,
    };

    const status = data.kambur_mu ? 'SLOUCHING' : 'UPRIGHT';
    this.logger.log(`Posture: ${status} | Distance: ${data.mesafe.toFixed(3)}`);
    return saved;
  }

  getCurrentStatus() {
    return this.currentStatus;
  }

  async getHistory(hours = 24): Promise<PostureHistoryPoint[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rawCutoff = this.getRawCutoffDate();

    if (since >= rawCutoff) {
      const raw = await this.postureRepo.find({
        where: { createdAt: MoreThanOrEqual(since) },
        order: { createdAt: 'ASC' },
      });
      return this.downsample(this.mapRawHistory(raw));
    }

    const [summaryRows, rawRows] = await Promise.all([
      this.getSummaryRows(since, rawCutoff),
      this.postureRepo.find({
        where: { createdAt: MoreThanOrEqual(rawCutoff) },
        order: { createdAt: 'ASC' },
      }),
    ]);

    return this.downsample([
      ...this.mapSummaryHistory(summaryRows),
      ...this.mapRawHistory(rawRows),
    ]);
  }

  async getStats(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rawCutoff = this.getRawCutoffDate();

    if (since >= rawCutoff) {
      const raw = await this.postureRepo.find({
        where: { createdAt: MoreThanOrEqual(since) },
      });
      return this.buildStats(raw.length, raw.filter((row) => row.isSlouching).length);
    }

    const [summaryRows, rawRows] = await Promise.all([
      this.getSummaryRows(since, rawCutoff),
      this.postureRepo.find({
        where: { createdAt: MoreThanOrEqual(rawCutoff) },
      }),
    ]);

    const summaryEventCount = summaryRows.reduce(
      (total, row) => total + row.eventCount,
      0,
    );
    const summarySlouchCount = summaryRows.reduce(
      (total, row) => total + row.slouchCount,
      0,
    );
    const rawEventCount = rawRows.length;
    const rawSlouchCount = rawRows.filter((row) => row.isSlouching).length;

    return this.buildStats(
      summaryEventCount + rawEventCount,
      summarySlouchCount + rawSlouchCount,
    );
  }

  @Cron('0 */15 * * * *')
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

  private async getSummaryRows(start: Date, end: Date) {
    return this.postureSummaryRepo
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

  private mapRawHistory(rows: PostureEvent[]): PostureHistoryPoint[] {
    return rows.map((row) => ({
      createdAt: row.createdAt,
      isSlouching: row.isSlouching,
      distance: row.distance,
      sampleCount: 1,
    }));
  }

  private mapSummaryHistory(
    rows: PostureMinuteSummary[],
  ): PostureHistoryPoint[] {
    return rows.map((row) => ({
      createdAt: row.minuteBucket,
      isSlouching: row.slouchCount * 2 >= row.eventCount,
      distance: Number(row.avgDistance),
      sampleCount: row.eventCount,
    }));
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

  private downsample(data: PostureHistoryPoint[]) {
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
