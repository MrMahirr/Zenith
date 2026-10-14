import { SettingsService } from '../settings/settings.service';
import { LedService } from './led.service';

class InMemorySettings {
  readonly store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
  }
}

const create = (settings = new InMemorySettings()) => ({
  settings,
  service: new LedService(settings as unknown as SettingsService),
});

describe('LedService', () => {
  it('defaults to auto mode with ambient light off', async () => {
    const { service } = create();
    await service.onModuleInit();

    expect(service.getState()).toMatchObject({ mode: 'auto', isOn: false });
    expect(service.isAmbientEnabled()).toBe(false);
  });

  it('persists manual state and restores it after a restart', async () => {
    const first = create();
    first.service.setManual('#FF8800', 200);
    await first.service.flush();

    const second = create(first.settings);
    await second.service.onModuleInit();

    expect(second.service.getState()).toEqual({
      color: '#FF8800',
      brightness: 200,
      isOn: true,
      mode: 'manual',
    });
  });

  it('coalesces rapid brightness changes into one write', async () => {
    const settings = new InMemorySettings();
    const setSpy = jest.spyOn(settings, 'set');
    const { service } = create(settings);

    for (let value = 10; value <= 100; value += 10) {
      service.setBrightness(value);
    }
    await service.flush();

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(settings.store.get('led.state') as string).brightness).toBe(100);
  });

  it('persists the ambient preference', async () => {
    const first = create();
    await first.service.setAmbientEnabled(true);

    const second = create(first.settings);
    await second.service.onModuleInit();

    expect(second.service.isAmbientEnabled()).toBe(true);
  });

  it('ignores a corrupt saved state', async () => {
    const settings = new InMemorySettings();
    settings.store.set('led.state', '{"color":"red","brightness":999}');
    const { service } = create(settings);

    await service.onModuleInit();

    expect(service.getState().color).toBe('#000000');
  });

  it('parseState validates every field', () => {
    expect(LedService.parseState(null)).toBeNull();
    expect(LedService.parseState('not json')).toBeNull();
    expect(
      LedService.parseState('{"color":"#112233","brightness":10,"isOn":true,"mode":"auto"}'),
    ).not.toBeNull();
    expect(
      LedService.parseState('{"color":"#112233","brightness":10,"isOn":true,"mode":"x"}'),
    ).toBeNull();
  });
});
