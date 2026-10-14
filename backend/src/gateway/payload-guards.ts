import {
  LedManualPayload,
  PosturePayload,
  SensorPayload,
  SERVICE_NAMES,
  ServiceName,
} from './events';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Geçersiz yükte `null` döner; çağıran taraf olayı yok sayar. */
export function parseSensorPayload(payload: unknown): SensorPayload | null {
  if (!isObject(payload)) return null;
  const { temp, humidity, pressure, air_quality, gas_voltage } = payload;

  if (!isFiniteNumber(temp) || !isFiniteNumber(humidity) || !isFiniteNumber(pressure)) {
    return null;
  }
  if (air_quality !== undefined && !isFiniteNumber(air_quality)) return null;
  if (gas_voltage !== undefined && !isFiniteNumber(gas_voltage)) return null;

  return { temp, humidity, pressure, air_quality, gas_voltage };
}

export function parsePosturePayload(payload: unknown): PosturePayload | null {
  if (!isObject(payload)) return null;
  const { kambur_mu, mesafe } = payload;

  if (typeof kambur_mu !== 'boolean' || !isFiniteNumber(mesafe)) return null;
  return { kambur_mu, mesafe };
}

export function parseBrightness(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function parseLedManualPayload(payload: unknown): LedManualPayload | null {
  if (!isObject(payload)) return null;
  const brightness = parseBrightness(payload.brightness);

  if (typeof payload.color !== 'string' || !HEX_COLOR.test(payload.color) || brightness === null) {
    return null;
  }
  return { color: payload.color.toUpperCase(), brightness };
}

export function parseBrightnessPayload(payload: unknown): number | null {
  return isObject(payload) ? parseBrightness(payload.brightness) : null;
}

export function parseAmbientPayload(payload: unknown): boolean | null {
  return isObject(payload) && typeof payload.enabled === 'boolean' ? payload.enabled : null;
}

export function parseChipUid(payload: unknown): string | null {
  if (!isObject(payload) || typeof payload.uid !== 'string') return null;
  const uid = payload.uid.trim();
  return uid.length > 0 && uid.length <= 50 ? uid : null;
}

export function parseServiceName(value: unknown): ServiceName | null {
  return typeof value === 'string' && (SERVICE_NAMES as readonly string[]).includes(value)
    ? (value as ServiceName)
    : null;
}
