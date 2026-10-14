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
}

/** Varsayılanlar (ai-service `config.py` ve `.env` ile aynı değerler). */
export const PREFERENCE_DEFAULTS = {
  postureThreshold: 0.15,
  sensorIntervalSeconds: 15,
} as const;

export const PREFERENCE_LIMITS = {
  postureThreshold: { min: 0.05, max: 0.5 },
  sensorIntervalSeconds: { min: 5, max: 300 },
  weatherCity: { maxLength: 60 },
} as const;

const EMPTY: Preferences = {
  postureThreshold: null,
  sensorIntervalSeconds: null,
  weatherCity: null,
};

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

  /** Arayüz için: tercihler + varsayılanlar. */
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
    const next: Preferences = {
      postureThreshold:
        patch.postureThreshold === undefined ? current.postureThreshold : patch.postureThreshold,
      sensorIntervalSeconds:
        patch.sensorIntervalSeconds === undefined
          ? current.sensorIntervalSeconds
          : patch.sensorIntervalSeconds,
      weatherCity: patch.weatherCity === undefined ? current.weatherCity : patch.weatherCity,
    };

    await this.settings.set(PREFERENCES_KEY, JSON.stringify(next));
    this.logger.log('Tercihler güncellendi');
    this.changedSubject.next(next);
    return next;
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
      const { postureThreshold: pt, sensorIntervalSeconds: si, weatherCity: wc } = value;
      const limits = PREFERENCE_LIMITS;

      return {
        postureThreshold:
          typeof pt === 'number' && pt >= limits.postureThreshold.min && pt <= limits.postureThreshold.max
            ? pt
            : null,
        sensorIntervalSeconds:
          typeof si === 'number' &&
          Number.isInteger(si) &&
          si >= limits.sensorIntervalSeconds.min &&
          si <= limits.sensorIntervalSeconds.max
            ? si
            : null,
        weatherCity:
          typeof wc === 'string' && wc.trim() && wc.length <= limits.weatherCity.maxLength
            ? wc.trim()
            : null,
      };
    } catch {
      return { ...EMPTY };
    }
  }
}
