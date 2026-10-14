import { DisplayService } from '../display/display.service';
import { ServiceRegistry } from '../status/service-registry.service';
import { parseHardwareDevices } from './hardware-payload';
import { HardwareService } from './hardware.service';

const display = {
  getView: () => ({ available: true, percent: 80 }),
} as unknown as DisplayService;

const create = () => {
  const registry = new ServiceRegistry();
  return { registry, service: new HardwareService(registry, display) };
};

describe('parseHardwareDevices', () => {
  it('keeps valid rows and sanitizes them', () => {
    const result = parseHardwareDevices({
      devices: [
        { id: 'bme280', name: ' BME280 ', state: 'ok', detail: 'Yanit veriyor' },
        { id: 'power', name: 'Guc', state: 'weird', detail: 42 },
      ],
    });

    expect(result).toEqual([
      { id: 'bme280', name: 'BME280', state: 'ok', detail: 'Yanit veriyor' },
      { id: 'power', name: 'Guc', state: 'unknown', detail: '' },
    ]);
  });

  it('drops malformed rows and rejects empty payloads', () => {
    expect(parseHardwareDevices(null)).toBeNull();
    expect(parseHardwareDevices({ devices: 'x' })).toBeNull();
    expect(parseHardwareDevices({ devices: [{ id: 'BAD ID', name: 'x' }, { id: 'ok', name: '' }] })).toBeNull();
  });

  it('truncates long details and caps the number of devices', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `d${i}`,
      name: 'x',
      state: 'ok',
      detail: 'a'.repeat(500),
    }));
    const result = parseHardwareDevices({ devices: many });

    expect(result).toHaveLength(20);
    expect(result?.[0].detail).toHaveLength(200);
  });
});

describe('HardwareService', () => {
  it('merges per device and only signals real changes', () => {
    const { service } = create();
    let changes = 0;
    service.changed$.subscribe(() => changes++);

    const device = { id: 'camera', name: 'Kamera', state: 'ok' as const, detail: 'Baglandi' };
    expect(service.report('camera', [device])).toBe(true);
    expect(service.report('camera', [device])).toBe(false);
    expect(service.report('camera', [{ ...device, state: 'warn', detail: 'Akis yok' }])).toBe(true);
    expect(changes).toBe(2);
  });

  it('keeps devices a service did not mention', () => {
    const { service } = create();
    service.report('sensor', [
      { id: 'bme280', name: 'BME', state: 'ok', detail: '' },
      { id: 'power', name: 'Guc', state: 'error', detail: 'dusuk' },
    ]);
    service.report('sensor', [{ id: 'bme280', name: 'BME', state: 'error', detail: 'koptu' }]);

    const devices = service.snapshot().services.sensor.devices;
    expect(devices.map((d) => `${d.id}:${d.state}`).sort()).toEqual(['bme280:error', 'power:error']);
  });

  it('snapshot includes connection state and the display', () => {
    const { service, registry } = create();
    registry.register('s1', 'led');

    const snapshot = service.snapshot();

    expect(snapshot.services.led.connected).toBe(true);
    expect(snapshot.services.camera.connected).toBe(false);
    expect(snapshot.display).toEqual({ available: true, percent: 80 });
  });

  it('refuses posture calibration when the camera service is not connected', () => {
    const { service, registry } = create();
    let requested = 0;
    service.postureCalibrateRequested$.subscribe(() => requested++);

    expect(service.requestPostureCalibration()).toBe(false);

    registry.register('c1', 'camera');
    expect(service.requestPostureCalibration()).toBe(true);
    expect(requested).toBe(1);
  });

  it('refuses calibration when the sensor service is not connected', () => {
    const { service, registry } = create();
    let requested = 0;
    service.calibrateRequested$.subscribe(() => requested++);

    expect(service.requestMq135Calibration()).toBe(false);

    registry.register('s1', 'sensor');
    expect(service.requestMq135Calibration()).toBe(true);
    expect(requested).toBe(1);
  });
});
