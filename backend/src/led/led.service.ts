import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export interface LedState {
  color: string;
  brightness: number;
  isOn: boolean;
  mode: 'manual' | 'auto';
}

const STATE_KEY = 'led.state';
const AMBIENT_KEY = 'led.ambient';
const PERSIST_DELAY_MS = 300;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_STATE: LedState = {
  color: '#000000',
  brightness: 128,
  isOn: false,
  mode: 'auto',
};

/**
 * LED durumu.
 *
 * Durum (renk, parlaklık, açık/kapalı, manuel/otomatik) ve "ortam ışığı"
 * tercihi veritabanında saklanır; backend yeniden başlayınca geri yüklenir.
 * Ortam ışığı varsayılan olarak **kapalıdır**: kullanıcı açarsa aktif modun
 * rengi kalıcı olarak yanar, kapalıyken mod değişimi yalnızca kısa bir
 * yanıp sönmedir.
 */
@Injectable()
export class LedService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LedService.name);

  private state: LedState = { ...DEFAULT_STATE };
  private ambientEnabled = false;
  private persistTimer: NodeJS.Timeout | null = null;

  constructor(private readonly settings: SettingsService) {}

  async onModuleInit() {
    try {
      const [rawState, rawAmbient] = await Promise.all([
        this.settings.get(STATE_KEY),
        this.settings.get(AMBIENT_KEY),
      ]);

      const restored = LedService.parseState(rawState);
      if (restored) {
        this.state = restored;
      }
      this.ambientEnabled = rawAmbient === 'true';

      this.logger.log(
        `LED durumu geri yüklendi: ${this.state.mode}, ortam ışığı ${this.ambientEnabled ? 'açık' : 'kapalı'}`,
      );
    } catch (error) {
      this.logger.warn(`LED durumu okunamadı, varsayılan kullanılıyor: ${error}`);
    }
  }

  async onModuleDestroy() {
    await this.flush();
  }

  /** Kayıtlı JSON'u doğrular; bozuksa `null` döner. */
  static parseState(raw: string | null): LedState | null {
    if (!raw) return null;

    try {
      const value = JSON.parse(raw) as Partial<LedState>;
      const valid =
        typeof value.color === 'string' &&
        HEX_COLOR.test(value.color) &&
        typeof value.brightness === 'number' &&
        value.brightness >= 0 &&
        value.brightness <= 255 &&
        typeof value.isOn === 'boolean' &&
        (value.mode === 'manual' || value.mode === 'auto');

      return valid ? (value as LedState) : null;
    } catch {
      return null;
    }
  }

  /** Manuel LED kontrolünü aktif eder. */
  setManual(color: string, brightness: number): LedState {
    this.state = { ...this.state, color, brightness, isOn: true, mode: 'manual' };
    this.logger.log(`[LED] Manual Mode: Color=${color}, Brightness=${brightness}`);
    this.schedulePersist();
    return this.state;
  }

  /** Otomatik moda geri döner (duruş uyarıları ve ortam ışığı yeniden devreye girer). */
  setAuto(): LedState {
    this.state = { ...this.state, mode: 'auto' };
    this.logger.log('[LED] Auto Mode Activated');
    this.schedulePersist();
    return this.state;
  }

  /** LED'i söndürür ve manuel modda bırakır. */
  turnOff(): LedState {
    this.state = { ...this.state, isOn: false, mode: 'manual' };
    this.logger.log('[LED] Turned Off');
    this.schedulePersist();
    return this.state;
  }

  /** Yalnızca parlaklığı günceller (otomatik mod dahil). */
  setBrightness(brightness: number): LedState {
    this.state = { ...this.state, brightness };
    this.logger.log(`[LED] Brightness Updated: ${brightness}`);
    this.schedulePersist();
    return this.state;
  }

  getState(): LedState {
    return this.state;
  }

  isAmbientEnabled(): boolean {
    return this.ambientEnabled;
  }

  async setAmbientEnabled(enabled: boolean): Promise<void> {
    this.ambientEnabled = enabled;
    this.logger.log(`[LED] Ortam ışığı ${enabled ? 'açıldı' : 'kapatıldı'}`);
    await this.settings.set(AMBIENT_KEY, String(enabled));
  }

  // Parlaklık kaydırıcısı saniyede onlarca güncelleme üretebilir; SD kartı
  // yıpratmamak için yazma geciktirilip birleştirilir.
  private schedulePersist() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, PERSIST_DELAY_MS);
    this.persistTimer.unref?.();
  }

  private async persist() {
    try {
      await this.settings.set(STATE_KEY, JSON.stringify(this.state));
    } catch (error) {
      this.logger.error(`LED durumu kaydedilemedi: ${error}`);
    }
  }

  /** Bekleyen yazmayı hemen uygular (kapanışta ve testlerde). */
  async flush() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
      await this.persist();
    }
  }
}
