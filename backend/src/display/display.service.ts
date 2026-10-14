import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { PreferencesService } from '../preferences/preferences.service';
import { SysfsBacklight } from './backlight';
import type { BacklightDriver } from './backlight';

export const BACKLIGHT_DRIVER = Symbol('BACKLIGHT_DRIVER');

export interface DisplayView {
  /** Bu cihazda yazılımla ayarlanabilir arka ışık var mı? */
  available: boolean;
  /** Şu anki parlaklık, yüzde (0–100); `available` false ise `null`. */
  percent: number | null;
}

/** Gece parlaklığının geçerli olduğu saat aralığı (sunucu yerel saati). */
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 7;
const SCHEDULE_CHECK_MS = 60_000;

export function isNight(date: Date): boolean {
  const hour = date.getHours();
  return NIGHT_START_HOUR > NIGHT_END_HOUR
    ? hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
    : hour >= NIGHT_START_HOUR && hour < NIGHT_END_HOUR;
}

/**
 * Ekran parlaklığı.
 *
 * Tercihlerdeki gündüz (`displayBrightness`) ve gece (`displayNightBrightness`)
 * yüzdelerini arka ışığa uygular. İkisi de ayarlı değilse arka ışığa hiç
 * dokunulmaz.
 */
@Injectable()
export class DisplayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DisplayService.name);
  private readonly driver: BacklightDriver;
  private timer: NodeJS.Timeout | null = null;
  private subscription?: Subscription;
  private lastAppliedPercent: number | null = null;

  constructor(
    private readonly preferences: PreferencesService,
    @Optional() @Inject(BACKLIGHT_DRIVER) driver?: BacklightDriver,
  ) {
    this.driver = driver ?? new SysfsBacklight();
  }

  async onModuleInit() {
    this.subscription = this.preferences.changed$.subscribe(() => void this.apply());
    this.timer = setInterval(() => void this.apply(), SCHEDULE_CHECK_MS);
    this.timer.unref?.();
    await this.apply();
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
    if (this.timer) clearInterval(this.timer);
  }

  getView(): DisplayView {
    const state = this.driver.read();
    if (!state) {
      return { available: false, percent: null };
    }
    return { available: true, percent: Math.round((state.value / state.max) * 100) };
  }

  /** Şu an geçerli yüzdeyi hesaplar; hiçbir tercih yoksa `null`. */
  async targetPercent(now: Date = new Date()): Promise<number | null> {
    const { displayBrightness, displayNightBrightness } = await this.preferences.getOverrides();

    if (displayBrightness === null && displayNightBrightness === null) {
      return null;
    }
    if (isNight(now) && displayNightBrightness !== null) {
      return displayNightBrightness;
    }
    return displayBrightness ?? 100;
  }

  /** Hedef parlaklığı arka ışığa uygular (değişmediyse yazmaz). */
  async apply(now: Date = new Date()): Promise<void> {
    let percent = await this.targetPercent(now);
    if (percent === null && this.lastAppliedPercent !== null) {
      // Tercih kaldırıldı: bizim değiştirdiğimiz parlaklığı varsayılana (tam) döndür.
      percent = 100;
    }
    if (percent === null || percent === this.lastAppliedPercent) {
      return;
    }

    const state = this.driver.read();
    if (!state) {
      return; // arka ışık yok: tercih saklanır ama uygulanacak donanım bulunmuyor
    }

    try {
      this.driver.write(Math.max(1, Math.round((percent / 100) * state.max)));
      this.lastAppliedPercent = percent;
      this.logger.log(`Ekran parlaklığı %${percent} yapıldı`);
    } catch (error) {
      this.logger.error(`Ekran parlaklığı ayarlanamadı: ${error}`);
    }
  }
}
