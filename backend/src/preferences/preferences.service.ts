import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';
import { SettingsService } from '../settings/settings.service';

const PREFERENCES_KEY = 'prefs';

/**
 * Kullanıcının panelden değiştirebildiği çalışma zamanı tercihleri.
 * `null`, "tercih yok; servisin kendi varsayılanı geçerli" demektir.
 */
export interface Preferences {
  /** Kambur duruş eşiği (omuz-burun mesafesi, 0.05–0.5). */
  postureThreshold: number | null;
  /** Sensör okuma aralığı, saniye (5–300). */
  sensorIntervalSeconds: number | null;
  /** Hava durumu şehri. */
  weatherCity: string | null;
  /** Ekran arka ışığı, gündüz, yüzde (5–100). */
  displayBrightness: number | null;
  /** Ekran arka ışığı, gece (22:00–07:00), yüzde (5–100). */
  displayNightBrightness: number | null;
  /** MQ135'in temiz havada ölçülen gerilimi (V); kalibrasyon sonucu. */
  mq135CleanVoltage: number | null;
}

/** Varsayılanlar (ai-service `config.py` ve `.env` ile aynı değerler). */
export const PREFERENCE_DEFAULTS = {
  postureThreshold: 0.15,
  sensorIntervalSeconds: 15,
  displayBrightness: 100,
} as const;

export const PREFERENCE_LIMITS = {
  postureThreshold: { min: 0.05, max: 0.5 },
  sensorIntervalSeconds: { min: 5, max: 300 },
  weatherCity: { maxLength: 60 },
  displayBrightness: { min: 5, max: 100 },
  displayNightBrightness: { min: 5, max: 100 },
  mq135CleanVoltage: { min: 0.05, max: 4 },
} as const;

const EMPTY: Preferences = {
  postureThreshold: null,
  sensorIntervalSeconds: null,
  weatherCity: null,
  displayBrightness: null,
  displayNightBrightness: null,
  mq135CleanVoltage: null,
};

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);
  private readonly changedSubject = new Subject<Preferences>();

  readonly changed$: Observable<Preferences> = this.changedSubject.asObservable();

  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  /** Kaydedilmiş tercihler; bozuk/eksik alanlar `null` sayılır. */
  async getOverrides(): Promise<Preferences> {
    return PreferencesService.parse(await this.settings.get(PREFERENCES_KEY));
  }

  /** Arayüz için: tercihler + varsayılanlar + izin verilen aralıklar. */
  async getView() {
    return {
      values: await this.getOverrides(),
      defaults: {
        ...PREFERENCE_DEFAULTS,
        weatherCity: this.envCity(),
      },
      limits: PREFERENCE_LIMITS,
    };
  }

  /** Verilen alanları günceller (`null` = tercihi kaldır, `undefined` = dokunma). */
  async update(patch: Partial<Preferences>): Promise<Preferences> {
    const current = await this.getOverrides();
    const next = { ...current } as Record<keyof Preferences, unknown>;

    for (const key of Object.keys(EMPTY) as Array<keyof Preferences>) {
      if (patch[key] !== undefined) {
        next[key] = patch[key];
      }
    }

    const saved = next as unknown as Preferences;
    await this.settings.set(PREFERENCES_KEY, JSON.stringify(saved));
    this.logger.log('Tercihler güncellendi');
    this.changedSubject.next(saved);
    return saved;
  }

  /** Hava durumu için etkin şehir: tercih varsa o, yoksa `.env`. */
  async getWeatherCity(): Promise<string> {
    return (await this.getOverrides()).weatherCity ?? this.envCity();
  }

  private envCity(): string {
    return this.config.get<string>('WEATHER_CITY', 'Izmir');
  }

  /** Kayıtlı JSON'u doğrular; geçersiz alanlar `null` olur. */
  static parse(raw: string | null): Preferences {
    if (!raw) return { ...EMPTY };

    try {
      const value = JSON.parse(raw) as Partial<Record<keyof Preferences, unknown>>;
      const limits = PREFERENCE_LIMITS;
      const interval = value.sensorIntervalSeconds;
      const city = value.weatherCity;

      return {
        postureThreshold: inRange(
          value.postureThreshold,
          limits.postureThreshold.min,
          limits.postureThreshold.max,
        )
          ? value.postureThreshold
          : null,
        sensorIntervalSeconds:
          inRange(interval, limits.sensorIntervalSeconds.min, limits.sensorIntervalSeconds.max) &&
          Number.isInteger(interval)
            ? interval
            : null,
        weatherCity:
          typeof city === 'string' && city.trim() && city.length <= limits.weatherCity.maxLength
            ? city.trim()
            : null,
        displayBrightness: inRange(
          value.displayBrightness,
          limits.displayBrightness.min,
          limits.displayBrightness.max,
        )
          ? Math.round(value.displayBrightness)
          : null,
        displayNightBrightness: inRange(
          value.displayNightBrightness,
          limits.displayNightBrightness.min,
          limits.displayNightBrightness.max,
        )
          ? Math.round(value.displayNightBrightness)
          : null,
        mq135CleanVoltage: inRange(
          value.mq135CleanVoltage,
          limits.mq135CleanVoltage.min,
          limits.mq135CleanVoltage.max,
        )
          ? value.mq135CleanVoltage
          : null,
      };
    } catch {
      return { ...EMPTY };
    }
  }
}
