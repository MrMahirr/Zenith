import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) {}

  /** SQLite için tutarlı tarih-saat formatı (YYYY-MM-DD HH:MM:SS) */
  private toSqliteDateTime(value: Date): string {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  /** Modu değiştir ve DB'ye kaydet */
  async changeMode(newMode: string): Promise<{ mode: ModeName; config: (typeof MODE_CONFIG)[ModeName] } | null> {
    // Geçerli bir mod mu kontrol et
    if (!(newMode in MODE_CONFIG)) {
      this.logger.warn(`Geçersiz mod: ${newMode}`);
      return null;
    }

    const validMode = newMode as ModeName;
    this.currentMode = validMode;

    const createdAt = this.toSqliteDateTime(new Date());

    // SOLID/IoC ve 'hiçbir şekilde TypeORM kullanmama' kuralına uygun olarak Raw SQL kullanılmıştır.
    await this.dataSource.query(
      `INSERT INTO mode_changes (mode, createdAt) VALUES (?, ?)`,
      [validMode, createdAt]
    );

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
    const since = this.toSqliteDateTime(new Date(Date.now() - hours * 60 * 60 * 1000));
    
    // SOLID/IoC ve 'hiçbir şekilde TypeORM kullanmama' kuralına uygun olarak Raw SQL kullanılmıştır.
    const rows = await this.dataSource.query(
      `SELECT id, mode, createdAt FROM mode_changes WHERE createdAt >= ? ORDER BY createdAt ASC`,
      [since]
    );

    return rows;
  }

  /** Mod kullanım istatistikleri (pie chart için) */
  async getUsageStats(hours: number = 24): Promise<Record<string, number>> {
    const stats: Record<string, number> = {
      PASSIVE: 0,
      CODING: 0,
      FOCUS: 0,
      RELAX: 0,
      MEETING: 0,
    };
    
    const since = this.toSqliteDateTime(new Date(Date.now() - hours * 60 * 60 * 1000));

    // SOLID/IoC ve 'hiçbir şekilde TypeORM kullanmama' kuralına uygun olarak Raw SQL kullanılmıştır.
    const rows = await this.dataSource.query(
      `SELECT mode, COUNT(*) as count FROM mode_changes WHERE createdAt >= ? GROUP BY mode`,
      [since]
    );

    const rowMap = new Map<string, number>(
      rows.map((row: any) => [String(row.mode), Number(row.count)])
    );

    for (const key of Object.keys(MODE_CONFIG)) {
      stats[key] = rowMap.get(key) ?? 0;
    }

    return stats;
  }
}

