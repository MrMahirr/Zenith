import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Başlangıç şeması.
 *
 * Proje migration'sız büyüdüğü için canlı veritabanları bu tabloları zaten
 * içerir; bu yüzden her ifade idempotenttir (`IF NOT EXISTS`, eksik sütun
 * kontrolü). Mevcut bir veritabanında hiçbir şeyi değiştirmeden "uygulanmış"
 * olarak kaydolur, boş bir veritabanında ise tüm şemayı kurar.
 */
export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS "mode_changes" (
         "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
         "mode" varchar(20) NOT NULL,
         "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
      `CREATE INDEX IF NOT EXISTS "idx_mode_changes_created_at" ON "mode_changes" ("createdAt")`,

      `CREATE TABLE IF NOT EXISTS "sensor_readings" (
         "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
         "temperature" float NOT NULL,
         "humidity" float NOT NULL,
         "pressure" float NOT NULL,
         "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
         "airQuality" float,
         "gasVoltage" float)`,
      `CREATE INDEX IF NOT EXISTS "idx_sensor_readings_created_at" ON "sensor_readings" ("createdAt")`,

      `CREATE TABLE IF NOT EXISTS "sensor_minute_summaries" (
         "minuteBucket" datetime PRIMARY KEY NOT NULL,
         "avgTemperature" float NOT NULL,
         "avgHumidity" float NOT NULL,
         "avgPressure" float NOT NULL,
         "sampleCount" integer NOT NULL,
         "sourceMaxCreatedAt" datetime NOT NULL,
         "avgAirQuality" float,
         "avgGasVoltage" float)`,

      `CREATE TABLE IF NOT EXISTS "posture_events" (
         "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
         "isSlouching" boolean NOT NULL,
         "distance" float NOT NULL,
         "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
      `CREATE INDEX IF NOT EXISTS "idx_posture_events_created_at" ON "posture_events" ("createdAt")`,

      `CREATE TABLE IF NOT EXISTS "posture_minute_summaries" (
         "minuteBucket" datetime PRIMARY KEY NOT NULL,
         "eventCount" integer NOT NULL,
         "slouchCount" integer NOT NULL,
         "avgDistance" float NOT NULL,
         "sourceMaxCreatedAt" datetime NOT NULL)`,

      `CREATE TABLE IF NOT EXISTS "nfc_chips" (
         "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
         "uid" varchar(50) NOT NULL,
         "label" varchar(100),
         "assignedMode" varchar(20),
         "isRegistered" boolean NOT NULL DEFAULT (0),
         "firstSeenAt" datetime NOT NULL DEFAULT (datetime('now')),
         "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
         "lastSeenAt" datetime,
         CONSTRAINT "UQ_nfc_chips_uid" UNIQUE ("uid"))`,
      `CREATE INDEX IF NOT EXISTS "idx_nfc_chips_is_registered" ON "nfc_chips" ("isRegistered")`,
      `CREATE INDEX IF NOT EXISTS "idx_nfc_chips_last_seen_at" ON "nfc_chips" ("lastSeenAt")`,
      `CREATE INDEX IF NOT EXISTS "idx_nfc_chips_registered_last_seen" ON "nfc_chips" ("isRegistered", "lastSeenAt")`,

      `CREATE TABLE IF NOT EXISTS "nfc_scan_logs" (
         "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
         "chipUid" varchar(50) NOT NULL,
         "triggeredMode" varchar(20),
         "wasRegistered" boolean NOT NULL DEFAULT (0),
         "scannedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
      `CREATE INDEX IF NOT EXISTS "idx_nfc_scan_logs_scanned_at" ON "nfc_scan_logs" ("scannedAt")`,
    ];

    for (const sql of statements) {
      await queryRunner.query(sql);
    }

    // Eski veritabanlarında sonradan eklenen sütunlar olmayabilir.
    await this.addColumnIfMissing(queryRunner, 'sensor_readings', 'airQuality', 'float');
    await this.addColumnIfMissing(queryRunner, 'sensor_readings', 'gasVoltage', 'float');
    await this.addColumnIfMissing(queryRunner, 'sensor_minute_summaries', 'avgAirQuality', 'float');
    await this.addColumnIfMissing(queryRunner, 'sensor_minute_summaries', 'avgGasVoltage', 'float');
  }

  public async down(): Promise<void> {
    // Başlangıç şeması geri alınmaz: tabloları silmek tüm geçmiş veriyi yok eder.
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    type: string,
  ): Promise<void> {
    const columns: Array<{ name: string }> = await queryRunner.query(
      `PRAGMA table_info("${table}")`,
    );
    if (!columns.some((existing) => existing.name === column)) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
    }
  }
}
