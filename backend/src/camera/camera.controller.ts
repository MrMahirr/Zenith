import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { CameraService } from './camera.service';
import { UpdateCameraConfigDto } from './dto/update-camera-config.dto';

/**
 * Kamera yapılandırması REST API'si.
 * Prefix: /api/camera
 */
@Controller('camera')
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  /** Ayarlanmış kamera adresini döndür (yoksa `url: null`). */
  @Get('config')
  async getConfig() {
    return { url: await this.cameraService.getUrl() };
  }

  /** Kamera adresini değiştir; kamera servisi yeniden başlatılmadan yeni adrese geçer. */
  @Put('config')
  async updateConfig(@Body() body: UpdateCameraConfigDto) {
    return { url: await this.cameraService.setUrl(body.url) };
  }

  /** Ayarı kaldır; kamera servisi kendi varsayılan adreslerine döner. */
  @Delete('config')
  async resetConfig() {
    await this.cameraService.reset();
    return { url: null };
  }
}
