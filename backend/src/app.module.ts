import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { MIGRATIONS } from './database/migrations';

// Entities
import { SensorReading } from './database/entities/sensor-reading.entity';
import { PostureEvent } from './database/entities/posture-event.entity';
import { ModeChange } from './database/entities/mode-change.entity';
import { NfcChip } from './database/entities/nfc-chip.entity';
import { NfcScanLog } from './database/entities/nfc-scan-log.entity';
import { SensorMinuteSummary } from './database/entities/sensor-minute-summary.entity';
import { PostureMinuteSummary } from './database/entities/posture-minute-summary.entity';

// Feature Modules
import { SensorModule } from './sensor/sensor.module';
import { PostureModule } from './posture/posture.module';
import { ModeModule } from './mode/mode.module';
import { WeatherModule } from './weather/weather.module';
import { GatewayModule } from './gateway/gateway.module';
import { NfcModule } from './nfc/nfc.module';
import { LedModule } from './led/led.module';
import { CameraModule } from './camera/camera.module';
import { SettingsModule } from './settings/settings.module';
import { StatusModule } from './status/status.module';
import { PreferencesModule } from './preferences/preferences.module';
import { HardwareModule } from './hardware/hardware.module';
import { DisplayModule } from './display/display.module';

@Module({
  controllers: [AppController],
  imports: [
    // .env dosyasını yükle
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // SQLite veritabanı bağlantısı
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH || './zenith.sqlite',
      entities: [
        SensorReading,
        PostureEvent,
        ModeChange,
        NfcChip,
        NfcScanLog,
        SensorMinuteSummary,
        PostureMinuteSummary,
      ],
      // Şema değişiklikleri migration'larla yönetilir (src/database/migrations).
      // Açılışta bekleyen migration'lar otomatik uygulanır; şema yoksa kurulur.
      synchronize: false,
      migrations: MIGRATIONS,
      migrationsRun: true,
      // WAL: eşzamanlı okuma/yazma ve daha az fsync (SD kart ömrü). Bağlantı
      // açılırken uygulanır; sonradan bir transaction içinde değiştirilemez.
      enableWAL: true,
      prepareDatabase: (db: { pragma(source: string): unknown }) => {
        db.pragma('synchronous = NORMAL'); // WAL ile güvenli, daha az disk beklemesi
        db.pragma('cache_size = -8000'); // 8 MB önbellek
        db.pragma('mmap_size = 67108864'); // 64 MB memory-mapped I/O
        db.pragma('temp_store = MEMORY');
      },
    }),

    // Zamanlayıcı (hava durumu güncellemesi vb.)
    ScheduleModule.forRoot(),

    // Özellik modülleri
    SensorModule,
    PostureModule,
    ModeModule,
    WeatherModule,
    GatewayModule,
    NfcModule,
    LedModule,
    SettingsModule,
    CameraModule,
    StatusModule,
    PreferencesModule,
    DisplayModule,
    HardwareModule,
  ],
})
export class AppModule {}
