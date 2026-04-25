import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { PostureEvent } from '../database/entities/posture-event.entity';

@Injectable()
export class PostureService {
  private readonly logger = new Logger(PostureService.name);
  private currentStatus: { isSlouching: boolean; distance: number } = {
    isSlouching: false,
    distance: 0,
  };

  constructor(
    @InjectRepository(PostureEvent)
    private readonly postureRepo: Repository<PostureEvent>,
  ) {}

  /** Yeni postür event'i kaydet (sadece durum değiştiğinde çağrılmalı) */
  async saveEvent(data: { kambur_mu: boolean; mesafe: number }): Promise<PostureEvent> {
    const event = this.postureRepo.create({
      isSlouching: data.kambur_mu,
      distance: data.mesafe,
    });

    const saved = await this.postureRepo.save(event);
    this.currentStatus = { isSlouching: data.kambur_mu, distance: data.mesafe };

    const durum = data.kambur_mu ? '⚠️ KAMBUR' : '✅ DÜZGÜN';
    this.logger.log(`Postür: ${durum} | Mesafe: ${data.mesafe.toFixed(3)}`);
    return saved;
  }

  /** Anlık postür durumunu döndür */
  getCurrentStatus() {
    return this.currentStatus;
  }

  /** Geçmiş postür event'lerini getir */
  async getHistory(hours: number = 24): Promise<PostureEvent[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.postureRepo.find({
      where: { createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'ASC' },
    });
  }

  /** İstatistik: Belirli sürede kambur kalma yüzdesi */
  async getStats(hours: number = 24) {
    const events = await this.getHistory(hours);
    if (events.length === 0) {
      return { totalEvents: 0, slouchPercentage: 0, goodPercentage: 100 };
    }

    const slouchCount = events.filter((e) => e.isSlouching).length;
    const slouchPercentage = Math.round((slouchCount / events.length) * 100);

    return {
      totalEvents: events.length,
      slouchPercentage,
      goodPercentage: 100 - slouchPercentage,
    };
  }
}
