import { BadRequestException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { CameraConfig, CameraService } from './camera.service';

class InMemorySettings {
  readonly store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }
}

describe('CameraService', () => {
  let settings: InMemorySettings;
  let service: CameraService;
  let emitted: CameraConfig[];

  beforeEach(() => {
    settings = new InMemorySettings();
    service = new CameraService(settings as unknown as SettingsService);
    emitted = [];
    service.configChanged$.subscribe((config) => emitted.push(config));
  });

  it('has no url until one is set', async () => {
    await expect(service.getUrl()).resolves.toBeNull();
  });

  it('normalizes, persists and broadcasts a new url', async () => {
    const url = await service.setUrl('192.168.6.28');

    expect(url).toBe('http://192.168.6.28:4747/video');
    await expect(service.getUrl()).resolves.toBe(url);
    expect(emitted).toEqual([{ url }]);
  });

  it('rejects an invalid url without persisting or broadcasting', async () => {
    await expect(service.setUrl('ftp://nope')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(service.getUrl()).resolves.toBeNull();
    expect(emitted).toEqual([]);
  });

  it('reset clears the url and broadcasts null', async () => {
    await service.setUrl('10.0.0.5');
    await service.reset();

    await expect(service.getUrl()).resolves.toBeNull();
    expect(emitted[emitted.length - 1]).toEqual({ url: null });
  });
});
