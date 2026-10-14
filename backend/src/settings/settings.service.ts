import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Basit anahtar-değer ayar deposu.
 *
 * Çalışma sırasında değiştirilebilen ayarları (ör. kamera adresi) veritabanında
 * saklar. Tablo yoksa ilk açılışta oluşturulur; mevcut veriye dokunulmaz.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS app_settings (
         key TEXT PRIMARY KEY,
         value TEXT NOT NULL,
         updatedAt TEXT NOT NULL
       )`,
    );
  }

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
