import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ModeChange } from '../database/entities/mode-change.entity';
import { computeModeDurations } from './mode-usage';
import {
  DEFAULT_MODE,
  MODE_CONFIG,
  MODE_NAMES,
  ModeName,
  isModeName,
} from './mode.constants';

// Eski içe aktarmalar için yeniden dışa aktarım.
export { MODE_CONFIG, MODE_NAMES, isModeName } from './mode.constants';
export type { ModeName } from './mode.constants';

/** SQLite `datetime('now')` biçimi (UTC): "YYYY-MM-DD HH:MM:SS" */
function toSqliteDateTime(value: Date): string {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

function fromSqliteDateTime(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

@Injectable()
export class ModeService implements OnModuleInit {
  private readonly logger = new Logger(ModeService.name);
  private currentMode: ModeName = DEFAULT_MODE;

  constructor(private readonly dataSource: DataSource) {}

  /** Yeniden başlatmada son aktif modu veritabanından geri yükler. */
  async onModuleInit() {
    const rows: Array<{ mode: string }> = await this.dataSource.query(
      `SELECT mode FROM mode_changes ORDER BY createdAt DESC, id DESC LIMIT 1`,
    );

    if (rows.length > 0 && isModeName(rows[0].mode)) {
      this.currentMode = rows[0].mode;
      this.logger.log(`Son mod geri yüklendi: ${MODE_CONFIG[this.currentMode].name}`);
    }
  }

  /** Modu değiştir ve DB'ye kaydet. */
  async changeMode(
    newMode: string,
  ): Promise<{ mode: ModeName; config: (typeof MODE_CONFIG)[ModeName] } | null> {
    if (!isModeName(newMode)) {
      this.logger.warn(`Geçersiz mod: ${newMode}`);
      return null;
    }

    this.currentMode = newMode;

    await this.dataSource.query(`INSERT INTO mode_changes (mode, createdAt) VALUES (?, ?)`, [
      newMode,
      toSqliteDateTime(new Date()),
    ]);

    this.logger.log(`Mod değiştirildi: ${MODE_CONFIG[newMode].name}`);
    return { mode: newMode, config: MODE_CONFIG[newMode] };
  }

  /** Aktif modu döndür. */
  getCurrentMode() {
    return {
      mode: this.currentMode,
      config: MODE_CONFIG[this.currentMode],
    };
  }

  /** Arayüzlerin kullanacağı mod tanımları (tek kaynak). */
  getConfig() {
    return MODE_NAMES.map((mode) => ({
      mode,
      name: MODE_CONFIG[mode].name,
      label: MODE_CONFIG[mode].label,
      color: MODE_CONFIG[mode].color,
    }));
  }

  /** Mod değişim geçmişini getir. */
  async getHistory(hours = 24): Promise<ModeChange[]> {
    const since = toSqliteDateTime(new Date(Date.now() - hours * 60 * 60 * 1000));

    return this.dataSource.query(
      `SELECT id, mode, createdAt FROM mode_changes WHERE createdAt >= ? ORDER BY createdAt ASC`,
      [since],
    );
  }

  /**
   * Her modda geçirilen süre (dakika). Pasta grafiğin oranları süreye göre
   * hesaplanır; pencere başındaki aktif mod bir önceki kayıttan bulunur.
   */
  async getUsageStats(hours = 24, now: Date = new Date()): Promise<Record<ModeName, number>> {
    const windowStart = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const since = toSqliteDateTime(windowStart);

    const before: Array<{ mode: string }> = await this.dataSource.query(
      `SELECT mode FROM mode_changes WHERE createdAt < ? ORDER BY createdAt DESC, id DESC LIMIT 1`,
      [since],
    );
    const inWindow: Array<{ mode: string; createdAt: string }> = await this.dataSource.query(
      `SELECT mode, createdAt FROM mode_changes WHERE createdAt >= ? ORDER BY createdAt ASC, id ASC`,
      [since],
    );

    const seconds = computeModeDurations(
      inWindow.map((row) => ({ mode: row.mode, at: fromSqliteDateTime(row.createdAt) })),
      before.length > 0 ? before[0].mode : null,
      windowStart,
      now,
    );

    return Object.fromEntries(
      MODE_NAMES.map((mode) => [mode, Math.round((seconds[mode] / 60) * 10) / 10]),
    ) as Record<ModeName, number>;
  }
}
