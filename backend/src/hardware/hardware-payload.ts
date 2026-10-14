export type DeviceState = 'ok' | 'warn' | 'error' | 'unknown';

export interface HardwareDevice {
  id: string;
  name: string;
  state: DeviceState;
  detail: string;
}

const STATES: readonly DeviceState[] = ['ok', 'warn', 'error', 'unknown'];
const MAX_DEVICES = 20;
const ID_PATTERN = /^[a-z0-9_.-]{1,40}$/;

/**
 * AI servislerinden gelen `hardware_status` yükünü doğrular ve temizler.
 * Geçersiz satırlar atılır; hiçbiri geçerli değilse `null` döner.
 */
export function parseHardwareDevices(payload: unknown): HardwareDevice[] | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const list = (payload as { devices?: unknown }).devices;
  if (!Array.isArray(list)) return null;

  const devices: HardwareDevice[] = [];
  for (const entry of list.slice(0, MAX_DEVICES)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, name, state, detail } = entry as Record<string, unknown>;

    if (typeof id !== 'string' || !ID_PATTERN.test(id)) continue;
    if (typeof name !== 'string' || name.trim() === '') continue;

    devices.push({
      id,
      name: name.trim().slice(0, 80),
      state: STATES.includes(state as DeviceState) ? (state as DeviceState) : 'unknown',
      detail: typeof detail === 'string' ? detail.slice(0, 200) : '',
    });
  }

  return devices.length > 0 ? devices : null;
}
