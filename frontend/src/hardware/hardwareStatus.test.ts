import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  criticalAlerts,
  serviceState,
  type HardwareSnapshot,
  type ServiceHardware,
} from './hardwareStatus.ts';

const entry = (connected: boolean, states: Array<'ok' | 'warn' | 'error' | 'unknown'>): ServiceHardware => ({
  connected,
  updatedAt: null,
  devices: states.map((state, index) => ({ id: `d${index}`, name: `Cihaz ${index}`, state, detail: '' })),
});

const snapshot = (overrides: Partial<HardwareSnapshot['services']>): HardwareSnapshot => ({
  generatedAt: '2026-10-14T00:00:00Z',
  services: {
    sensor: entry(true, ['ok']),
    led: entry(true, ['ok']),
    nfc: entry(true, ['ok']),
    camera: entry(true, ['ok']),
    ...overrides,
  },
  display: { available: true, percent: 100 },
});

test('no snapshot means no alerts', () => {
  assert.deepEqual(criticalAlerts(null), []);
});

test('only error devices of connected services raise alerts', () => {
  const alerts = criticalAlerts(
    snapshot({
      sensor: entry(true, ['ok', 'error', 'warn']),
      nfc: entry(false, ['error']), // bagli degil -> uyari uretmez (zaten "bagli degil")
      camera: entry(true, ['warn']),
    }),
  );

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].service, 'sensor');
  assert.equal(alerts[0].device.state, 'error');
});

test('service state reflects the worst device and the connection', () => {
  assert.equal(serviceState(entry(false, ['ok'])), 'error');
  assert.equal(serviceState(entry(true, ['ok', 'error'])), 'error');
  assert.equal(serviceState(entry(true, ['ok', 'warn'])), 'warn');
  assert.equal(serviceState(entry(true, ['ok', 'ok'])), 'ok');
  assert.equal(serviceState(entry(true, [])), 'unknown');
  assert.equal(serviceState(entry(true, ['unknown'])), 'unknown');
});
