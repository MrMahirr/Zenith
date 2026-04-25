import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS – frontend'in backend'e erişmesi için
  app.enableCors({
    origin: '*', // Geliştirme aşamasında – production'da kısıtlanacak
  });

  // Global API prefix – tüm REST endpoint'leri /api/ ile başlayacak
  app.setGlobalPrefix('api');

  // DTO doğrulama pipe'ı
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`\n🚀 Zenith Backend çalışıyor: http://localhost:${port}`);
  console.log(`📡 WebSocket aktif: ws://localhost:${port}`);
  console.log(`📊 API endpoint'leri: http://localhost:${port}/api\n`);
}
bootstrap();
