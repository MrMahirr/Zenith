import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import { normalizeCameraUrl } from './camera-url';

const CAMERA_URL_KEY = 'camera.url';

export interface CameraConfig {
  /** Kullanıcının ayarladığı adres; `null` ise AI servisi kendi varsayılanını kullanır. */
  url: string | null;
}

/**
 * Kamera adresi yapılandırması.
 *
 * Adres kalıcıdır ve değiştiğinde `configChanged$` ile yayınlanır; gateway bu
 * akışı dinleyip kamera servisine iletir. Adres yalnızca REST üzerinden
 * (kullanıcı isteğiyle) okunur, diğer tarayıcılara yayınlanmaz.
 */
@Injectable()
export class CameraService {
  private readonly logger = new Logger(CameraService.name);
  private readonly configChangedSubject = new Subject<CameraConfig>();

  readonly configChanged$: Observable<CameraConfig> =
    this.configChangedSubject.asObservable();

  constructor(private readonly settings: SettingsService) {}

  async getUrl(): Promise<string | null> {
    return this.settings.get(CAMERA_URL_KEY);
  }

  async setUrl(input: string): Promise<string> {
    const url = normalizeCameraUrl(input);
    if (url === null) {
      throw new BadRequestException(
        'Geçerli bir kamera adresi girin (ör. 192.168.1.20 veya http://192.168.1.20:4747/video).',
      );
    }

    await this.settings.set(CAMERA_URL_KEY, url);
    this.logger.log('Kamera adresi güncellendi');
    this.configChangedSubject.next({ url });
    return url;
  }

  async reset(): Promise<void> {
    await this.settings.delete(CAMERA_URL_KEY);
    this.logger.log('Kamera adresi varsayılana döndürüldü');
    this.configChangedSubject.next({ url: null });
  }
}
