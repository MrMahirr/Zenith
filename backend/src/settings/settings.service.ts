import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Basit anahtar-değer ayar deposu.
 *
 * Çalışma sırasında değiştirilebilen ayarları (kamera adresi, LED durumu...)
 * veritabanında saklar. `app_settings` tablosu migration ile oluşturulur.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async get(key: string): Promise<string | null> {
    const rows: Array<{ value: string }> = await this.dataSource.query(
      `SELECT value FROM app_settings WHERE key = ?`,
      [key],
    );
    return rows.length > 0 ? rows[0].value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
      [key, value, new Date().toISOString()],
    );
    this.logger.log(`Ayar güncellendi: ${key}`);
  }

  async delete(key: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM app_settings WHERE key = ?`, [key]);
    this.logger.log(`Ayar silindi: ${key}`);
  }
}
