import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ModeChange } from '../database/entities/mode-change.entity';

/** Mod tanımları ve LED renk eşleştirmeleri */
export const MODE_CONFIG = {
  PASSIVE: { name: 'Serbest', color: '#94A3B8' },
  CODING: { name: 'Kodlama Modu', color: '#10B981' },
  FOCUS: { name: 'Odak Modu', color: '#3B82F6' },
  RELAX: { name: 'Relax Modu', color: '#F59E0B' },
  MEETING: { name: 'Toplantı Modu', color: '#EF4444' },
} as const;

export type ModeName = keyof typeof MODE_CONFIG;

@Injectable()
export class ModeService {
  private readonly logger = new Logger(ModeService.name);
  private currentMode: ModeName = 'PASSIVE';

  constructor(
    @InjectRepository(ModeChange)
    private readonly modeRepo: Repository<ModeChange>,
  ) {}

  /** Modu değiştir ve DB'ye kaydet */
  async changeMode(newMode: string): Promise<{ mode: ModeName; config: (typeof MODE_CONFIG)[ModeName] } | null> {
    // Geçerli bir mod mu kontrol et
    if (!(newMode in MODE_CONFIG)) {
      this.logger.warn(`Geçersiz mod: ${newMode}`);
      return null;
    }

    const validMode = newMode as ModeName;
    this.currentMode = validMode;

    // DB'ye kaydet
    const change = this.modeRepo.create({ mode: validMode });
    await this.modeRepo.save(change);

    this.logger.log(`Mod değiştirildi: ${MODE_CONFIG[validMode].name}`);
    return { mode: validMode, config: MODE_CONFIG[validMode] };
  }

  /** Aktif modu döndür */
  getCurrentMode() {
    return {
      mode: this.currentMode,
      config: MODE_CONFIG[this.currentMode],
    };
  }

  /** Mod değişim geçmişini getir */
  async getHistory(hours: number = 24): Promise<ModeChange[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.modeRepo.find({
      where: { createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'ASC' },
    });
  }

  /** Mod kullanım istatistikleri (pie chart için) */
  async getUsageStats(hours: number = 24) {
    const stats: Record<string, number> = {};
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await this.modeRepo
      .createQueryBuilder('mode_change')
      .select('mode_change.mode', 'mode')
      .addSelect('COUNT(*)', 'count')
      .where('mode_change.createdAt >= :since', { since })
      .groupBy('mode_change.mode')
      .getRawMany<{ mode: string; count: string }>();

    const rowMap = new Map(rows.map((row) => [row.mode, Number(row.count)]));

    for (const key of Object.keys(MODE_CONFIG)) {
      stats[key] = rowMap.get(key) ?? 0;
    }

    return stats;
  }
}
