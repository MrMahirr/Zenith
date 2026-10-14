import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SettingsService } from '../settings/settings.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { Preferences, PreferencesService } from './preferences.service';

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

    expect(view.values).toEqual({
      postureThreshold: null,
      sensorIntervalSeconds: null,
      weatherCity: null,
    });
    expect(view.defaults).toMatchObject({ postureThreshold: 0.15, weatherCity: 'Ankara' });
    expect(view.limits.sensorIntervalSeconds).toEqual({ min: 5, max: 300 });
  });

  it('merges partial updates and treats null as "reset"', async () => {
    const { service } = create();
    await service.update({ postureThreshold: 0.2, weatherCity: 'Bursa' });
    await service.update({ sensorIntervalSeconds: 30 });
    const afterReset = await service.update({ weatherCity: null });

    expect(afterReset).toEqual({
      postureThreshold: 0.2,
      sensorIntervalSeconds: 30,
      weatherCity: null,
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

  it('parse drops invalid stored fields', () => {
    expect(
      PreferencesService.parse(
        '{"postureThreshold":9,"sensorIntervalSeconds":2.5,"weatherCity":"   "}',
      ),
    ).toEqual({ postureThreshold: null, sensorIntervalSeconds: null, weatherCity: null });
    expect(PreferencesService.parse('garbage')).toEqual({
      postureThreshold: null,
      sensorIntervalSeconds: null,
      weatherCity: null,
    });
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

  it('accepts Turkish city names and rejects URL/query injection', async () => {
    expect(await errorsFor({ weatherCity: 'Şanlıurfa' })).toHaveLength(0);
    expect(await errorsFor({ weatherCity: "K. Maraş" })).toHaveLength(0);
    expect(await errorsFor({ weatherCity: 'Izmir&appid=x' })).toContain('weatherCity');
    expect(await errorsFor({ weatherCity: 'a'.repeat(61) })).toContain('weatherCity');
  });
});
