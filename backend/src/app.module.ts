import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { DataSource } from 'typeorm';

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
      synchronize: false, // RPi performansı ve boot süresi için senkronizasyon devre dışı bırakıldı
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
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      // SQLite performans pragmalarını uygulayarak okuma/yazma hızını katlıyoruz.
      // 1. WAL (Write-Ahead Logging) modunu açarak eş zamanlı okuma/yazma sağlıyoruz.
      await this.dataSource.query('PRAGMA journal_mode = WAL;');
      // 2. synchronous = NORMAL ile her disk yazımında disk kafasının fiziksel beklemesini önlüyoruz (Crash risk minimal).
      await this.dataSource.query('PRAGMA synchronous = NORMAL;');
      // 3. Cache boyutunu 8MB yapıyoruz (Varsayılan 2MB idi).
      await this.dataSource.query('PRAGMA cache_size = -8000;');
      // 4. Memory-mapped I/O boyutunu 64MB yaparak doğrudan RAM eşleşmesi sağlıyoruz.
      await this.dataSource.query('PRAGMA mmap_size = 67108864;');
      // 5. Geçici tabloların disk yerine RAM üzerinde oluşturulmasını sağlıyoruz.
      await this.dataSource.query('PRAGMA temp_store = MEMORY;');
    } catch (err) {
      console.error('[SQLite] Performans pragmaları uygulanamadı:', err);
    }
  }
}
