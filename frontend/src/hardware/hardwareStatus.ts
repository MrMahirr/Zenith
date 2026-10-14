/** Donanım durumu tipleri ve saf yardımcıları (backend `GET /api/hardware`). */
export type DeviceState = 'ok' | 'warn' | 'error' | 'unknown';

export interface HardwareDevice {
  id: string;
  name: string;
  state: DeviceState;
  detail: string;
}

export const SERVICE_ORDER = ['sensor', 'led', 'nfc', 'camera'] as const;
export type ServiceName = (typeof SERVICE_ORDER)[number];

export const SERVICE_LABELS: Record<ServiceName, string> = {
  sensor: 'Sensörler ve güç',
  led: 'LED şerit',
  nfc: 'NFC okuyucu',
  camera: 'Kamera',
};

export interface ServiceHardware {
  connected: boolean;
  updatedAt: string | null;
  devices: HardwareDevice[];
}

export interface HardwareSnapshot {
  generatedAt: string;
  services: Record<ServiceName, ServiceHardware>;
  display: { available: boolean; percent: number | null };
}

export interface HardwareAlert {
  service: ServiceName;
  device: HardwareDevice;
}

/**
 * Ana ekranda uyarı olarak gösterilecek sorunlar: yalnızca bağlı servislerin
 * `error` durumundaki cihazları. `warn` (ör. kalibre değil) uyarı bandı üretmez.
 */
export function criticalAlerts(snapshot: HardwareSnapshot | null): HardwareAlert[] {
  if (!snapshot) return [];

  const alerts: HardwareAlert[] = [];
  for (const service of SERVICE_ORDER) {
    const entry = snapshot.services[service];
    if (!entry?.connected) continue;

    for (const device of entry.devices) {
      if (device.state === 'error') {
        alerts.push({ service, device });
      }
    }
  }
  return alerts;
}

/** Bir hizmetin genel durumu: en kötü cihaz durumu, bağlı değilse `error`. */
export function serviceState(entry: ServiceHardware): DeviceState {
  if (!entry.connected) return 'error';
  if (entry.devices.some((d) => d.state === 'error')) return 'error';
  if (entry.devices.some((d) => d.state === 'warn')) return 'warn';
  if (entry.devices.length === 0 || entry.devices.every((d) => d.state === 'unknown')) {
    return 'unknown';
  }
  return 'ok';
}
