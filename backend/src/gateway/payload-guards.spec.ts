import {
  parseAmbientPayload,
  parseBrightnessPayload,
  parseChipUid,
  parseLedManualPayload,
  parsePosturePayload,
  parseSensorPayload,
  parseServiceName,
} from './payload-guards';

describe('payload guards', () => {
  it('accepts a valid sensor payload', () => {
    const payload = { temp: 24.5, humidity: 50, pressure: 1000, air_quality: 12, gas_voltage: 0.4 };
    expect(parseSensorPayload(payload)).toEqual(payload);
  });

  it('rejects malformed sensor payloads', () => {
    const invalid = [
      null,
      'x',
      {},
      { temp: '24', humidity: 1, pressure: 1 },
      { temp: NaN, humidity: 1, pressure: 1 },
      { temp: 1, humidity: 1, pressure: 1, air_quality: 'a' },
    ];

    for (const payload of invalid) {
      expect(parseSensorPayload(payload)).toBeNull();
    }
  });

  it('validates posture payloads', () => {
    expect(parsePosturePayload({ kambur_mu: true, mesafe: 0.1 })).toEqual({
      kambur_mu: true,
      mesafe: 0.1,
    });
    expect(parsePosturePayload({ kambur_mu: 'yes', mesafe: 0.1 })).toBeNull();
    expect(parsePosturePayload({ kambur_mu: true })).toBeNull();
  });

  it('normalizes LED manual payloads and clamps brightness', () => {
    expect(parseLedManualPayload({ color: '#ff0000', brightness: 300 })).toEqual({
      color: '#FF0000',
      brightness: 255,
    });
    expect(parseLedManualPayload({ color: 'red', brightness: 10 })).toBeNull();
    expect(parseLedManualPayload({ color: '#FF0000' })).toBeNull();
    expect(parseBrightnessPayload({ brightness: -5 })).toBe(0);
    expect(parseBrightnessPayload({})).toBeNull();
  });

  it('validates ambient, chip uid and service name', () => {
    expect(parseAmbientPayload({ enabled: true })).toBe(true);
    expect(parseAmbientPayload({ enabled: 'true' })).toBeNull();

    expect(parseChipUid({ uid: ' 12345 ' })).toBe('12345');
    expect(parseChipUid({ uid: '' })).toBeNull();
    expect(parseChipUid({ uid: 'x'.repeat(51) })).toBeNull();

    expect(parseServiceName('camera')).toBe('camera');
    expect(parseServiceName('hacker')).toBeNull();
  });
});
