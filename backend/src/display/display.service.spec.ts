import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { PreferencesService } from '../preferences/preferences.service';
import type { BacklightDriver } from './backlight';
import { DisplayService, isNight } from './display.service';

class InMemorySettings {
  readonly store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
  }
}

class FakeBacklight implements BacklightDriver {
  writes: number[] = [];
  constructor(
    private present = true,
    private max = 255,
  ) {}
  read() {
    return this.present ? { value: this.writes.at(-1) ?? this.max, max: this.max } : null;
  }
  write(value: number) {
    this.writes.push(value);
  }
}

const at = (hour: number) => new Date(2026, 9, 14, hour, 0);

const create = (backlight = new FakeBacklight()) => {
  const settings = new InMemorySettings();
  const config = { get: (_k: string, d?: string) => d } as ConfigService;
  const preferences = new PreferencesService(settings as unknown as SettingsService, config);
  const service = new DisplayService(preferences, backlight);
  return { backlight, preferences, service };
};

describe('isNight', () => {
  it('covers 22:00-07:00 across midnight', () => {
    expect([22, 23, 0, 6].every((h) => isNight(at(h)))).toBe(true);
    expect([7, 12, 21].some((h) => isNight(at(h)))).toBe(false);
  });
});

describe('DisplayService', () => {
  it('does not touch the backlight when no preference is set', async () => {
    const { service, backlight } = create();
    await service.apply(at(12));
    expect(backlight.writes).toEqual([]);
  });

  it('applies the day brightness as a raw value', async () => {
    const { service, preferences, backlight } = create();
    await preferences.update({ displayBrightness: 50 });

    await service.apply(at(12));

    expect(backlight.writes).toEqual([128]); // round(255 * 0.5)
  });

  it('switches to the night brightness and back', async () => {
    const { service, preferences, backlight } = create();
    await preferences.update({ displayBrightness: 100, displayNightBrightness: 20 });

    await service.apply(at(23));
    await service.apply(at(12));

    expect(backlight.writes).toEqual([51, 255]);
  });

  it('restores full brightness by day when only a night level is set', async () => {
    const { service, preferences, backlight } = create();
    await preferences.update({ displayNightBrightness: 10 });

    await service.apply(at(23));
    await service.apply(at(9));

    expect(backlight.writes).toEqual([26, 255]);
  });

  it('restores full brightness when the preference is removed', async () => {
    const { service, preferences, backlight } = create();
    await preferences.update({ displayBrightness: 40 });
    await service.apply(at(12));

    await preferences.update({ displayBrightness: null });
    await service.apply(at(12));

    expect(backlight.writes).toEqual([102, 255]);
  });

  it('does not rewrite an unchanged value', async () => {
    const { service, preferences, backlight } = create();
    await preferences.update({ displayBrightness: 70 });

    await service.apply(at(10));
    await service.apply(at(11));

    expect(backlight.writes).toHaveLength(1);
  });

  it('never writes zero (the screen would go black)', async () => {
    const { service, preferences, backlight } = create(new FakeBacklight(true, 10));
    await preferences.update({ displayBrightness: 5 });

    await service.apply(at(12));

    expect(backlight.writes[0]).toBeGreaterThanOrEqual(1);
  });

  it('reports unavailable hardware without throwing', async () => {
    const { service, preferences } = create(new FakeBacklight(false));
    await preferences.update({ displayBrightness: 50 });

    await expect(service.apply(at(12))).resolves.toBeUndefined();
    expect(service.getView()).toEqual({ available: false, percent: null });
  });

  it('reports the current percentage', () => {
    const { service } = create();
    expect(service.getView()).toEqual({ available: true, percent: 100 });
  });
});
