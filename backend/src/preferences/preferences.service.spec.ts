import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SettingsService } from '../settings/settings.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { Preferences, PreferencesService } from './preferences.service';

const EMPTY: Preferences = {
  postureThreshold: null,
  sensorIntervalSeconds: null,
  weatherCity: null,
  displayBrightness: null,
  displayNightBrightness: null,
  mq135CleanVoltage: null,
};

class InMemorySettings {
  readonly store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
  }
}

const create = (env: Record<string, string> = {}) => {
  const settings = new InMemorySettings();
  const config = { get: (key: string, fallback?: string) => env[key] ?? fallback } as ConfigService;
  const service = new PreferencesService(settings as unknown as SettingsService, config);
  return { settings, service };
};

const errorsFor = async (plain: object) =>
  (await validate(plainToInstance(UpdatePreferencesDto, plain))).map((error) => error.property);

describe('PreferencesService', () => {
  it('has no overrides by default and exposes defaults and limits', async () => {
    const { service } = create({ WEATHER_CITY: 'Ankara' });
    const view = await service.getView();

    expect(view.values).toEqual(EMPTY);
    expect(view.defaults).toMatchObject({ postureThreshold: 0.15, weatherCity: 'Ankara' });
    expect(view.limits.sensorIntervalSeconds).toEqual({ min: 5, max: 300 });
  });

  it('merges partial updates and treats null as "reset"', async () => {
    const { service } = create();
    await service.update({ postureThreshold: 0.2, weatherCity: 'Bursa' });
    await service.update({ sensorIntervalSeconds: 30 });
    const afterReset = await service.update({ weatherCity: null });

    expect(afterReset).toEqual({
      ...EMPTY,
      postureThreshold: 0.2,
      sensorIntervalSeconds: 30,
    });
  });

  it('broadcasts every change', async () => {
    const { service } = create();
    const seen: Preferences[] = [];
    service.changed$.subscribe((prefs) => seen.push(prefs));

    await service.update({ postureThreshold: 0.1 });

    expect(seen).toHaveLength(1);
    expect(seen[0].postureThreshold).toBe(0.1);
  });

  it('weather city prefers the override, then the environment', async () => {
    const { service } = create({ WEATHER_CITY: 'Izmir' });
    expect(await service.getWeatherCity()).toBe('Izmir');

    await service.update({ weatherCity: 'Antalya' });
    expect(await service.getWeatherCity()).toBe('Antalya');
  });

  it('stores display brightness and the MQ135 calibration', async () => {
    const { service } = create();
    const saved = await service.update({
      displayBrightness: 60,
      displayNightBrightness: 15,
      mq135CleanVoltage: 0.51,
    });

    expect(saved).toMatchObject({
      displayBrightness: 60,
      displayNightBrightness: 15,
      mq135CleanVoltage: 0.51,
    });
  });

  it('parse drops out-of-range display and calibration values', () => {
    const parsed = PreferencesService.parse(
      '{"displayBrightness":1,"displayNightBrightness":500,"mq135CleanVoltage":9}',
    );
    expect(parsed.displayBrightness).toBeNull();
    expect(parsed.displayNightBrightness).toBeNull();
    expect(parsed.mq135CleanVoltage).toBeNull();
  });

  it('parse drops invalid stored fields', () => {
    expect(
      PreferencesService.parse(
        '{"postureThreshold":9,"sensorIntervalSeconds":2.5,"weatherCity":"   "}',
      ),
    ).toEqual(EMPTY);
    expect(PreferencesService.parse('garbage')).toEqual(EMPTY);
  });
});

describe('UpdatePreferencesDto', () => {
  it('accepts in-range values and null resets', async () => {
    expect(await errorsFor({ postureThreshold: 0.2, sensorIntervalSeconds: 30 })).toHaveLength(0);
    expect(
      await errorsFor({ postureThreshold: null, sensorIntervalSeconds: null, weatherCity: null }),
    ).toHaveLength(0);
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('rejects out-of-range numbers', async () => {
    expect(await errorsFor({ postureThreshold: 0.9 })).toContain('postureThreshold');
    expect(await errorsFor({ postureThreshold: 0.01 })).toContain('postureThreshold');
    expect(await errorsFor({ sensorIntervalSeconds: 1 })).toContain('sensorIntervalSeconds');
    expect(await errorsFor({ sensorIntervalSeconds: 12.5 })).toContain('sensorIntervalSeconds');
  });

  it('validates display brightness and calibration ranges', async () => {
    expect(await errorsFor({ displayBrightness: 50, displayNightBrightness: 10 })).toHaveLength(0);
    expect(await errorsFor({ displayBrightness: 0 })).toContain('displayBrightness');
    expect(await errorsFor({ displayBrightness: 101 })).toContain('displayBrightness');
    expect(await errorsFor({ displayNightBrightness: 2 })).toContain('displayNightBrightness');
    expect(await errorsFor({ mq135CleanVoltage: 0.5 })).toHaveLength(0);
    expect(await errorsFor({ mq135CleanVoltage: 7 })).toContain('mq135CleanVoltage');
  });

  it('accepts Turkish city names and rejects URL/query injection', async () => {
    expect(await errorsFor({ weatherCity: 'Şanlıurfa' })).toHaveLength(0);
    expect(await errorsFor({ weatherCity: "K. Maraş" })).toHaveLength(0);
    expect(await errorsFor({ weatherCity: 'Izmir&appid=x' })).toContain('weatherCity');
    expect(await errorsFor({ weatherCity: 'a'.repeat(61) })).toContain('weatherCity');
  });
});
