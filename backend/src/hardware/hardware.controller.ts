import { Controller, Get, HttpCode, Post, ServiceUnavailableException } from '@nestjs/common';
import { HardwareService } from './hardware.service';

/**
 * Donanım sağlığı REST API'si.
 * Prefix: /api/hardware
 */
@Controller('hardware')
export class HardwareController {
  constructor(private readonly hardware: HardwareService) {}

  /** Servis bazında cihaz durumları ve ekran (arka ışık) bilgisi. */
  @Get()
  getSnapshot() {
    return this.hardware.snapshot();
  }

  /**
   * Postürü kalibre eder: kamera servisi ~birkaç saniye dik oturuşu ölçer ve
   * sonucu `postureThreshold` tercihi olarak kaydeder. MQ135 için aşağıya bakın.
   *
   * MQ135'i temiz havada kalibre eder. Sensör servisi ~10 saniye ölçüm alır ve
   * sonucu `mq135CleanVoltage` tercihi olarak kaydeder.
   */
  @Post('posture/calibrate')
  @HttpCode(202)
  calibratePosture() {
    if (!this.hardware.requestPostureCalibration()) {
      throw new ServiceUnavailableException('Kamera servisi bağlı değil; kalibrasyon başlatılamadı.');
    }
    return { requested: true };
  }

  @Post('mq135/calibrate')
  @HttpCode(202)
  calibrate() {
    if (!this.hardware.requestMq135Calibration()) {
      throw new ServiceUnavailableException('Sensör servisi bağlı değil; kalibrasyon başlatılamadı.');
    }
    return { requested: true };
  }
}
