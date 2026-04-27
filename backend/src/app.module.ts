import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';

// Entities
import { SensorReading } from './database/entities/sensor-reading.entity';
import { PostureEvent } from './database/entities/posture-event.entity';
import { ModeChange } from './database/entities/mode-change.entity';
import { NfcChip } from './database/entities/nfc-chip.entity';
import { NfcScanLog } from './database/entities/nfc-scan-log.entity';

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
      entities: [SensorReading, PostureEvent, ModeChange, NfcChip, NfcScanLog],
      synchronize: true, // Geliştirme aşamasında – production'da migration kullanılacak
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
export class AppModule {}
