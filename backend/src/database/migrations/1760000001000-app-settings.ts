import { MigrationInterface, QueryRunner } from 'typeorm';

/** Çalışma zamanında değiştirilebilen ayarlar için anahtar-değer deposu. */
export class AppSettings1760000001000 implements MigrationInterface {
  name = 'AppSettings1760000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "app_settings" (
         "key" TEXT PRIMARY KEY NOT NULL,
         "value" TEXT NOT NULL,
         "updatedAt" TEXT NOT NULL)`,
    );
  }

  public async down(): Promise<void> {
    // Ayar verisini silmemek için geri alma yapılmaz.
  }
}
