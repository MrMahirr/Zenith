import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { SensorReading } from './database/entities/sensor-reading.entity';
import { PostureEvent } from './database/entities/posture-event.entity';
import { ModeChange } from './database/entities/mode-change.entity';

// Feature Modules
import { SensorModule } from './sensor/sensor.module';
import { PostureModule } from './posture/posture.module';
import { ModeModule } from './mode/mode.module';
import { WeatherModule } from './weather/weather.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    // .env dosyasını yükle
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // SQLite veritabanı bağlantısı
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH || './zenith.sqlite',
      entities: [SensorReading, PostureEvent, ModeChange],
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
  ],
})
export class AppModule {}
