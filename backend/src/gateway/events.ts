/**
 * WebSocket olay adları ve yük tipleri (tek kaynak).
 *
 * Not: bazı adlar tarihsel olarak Türkçe/İngilizce karışık kalmıştır
 * (`postur_durumu`, `kambur_mu`). İstemciler (ai-service, frontend) bu adlara
 * bağlı olduğu için değiştirilmemiştir; yeni olaylar İngilizce eklenir.
 */
export const WS = {
  // Servislerden / arayüzden gelen
  SENSOR_UPDATE: 'sensor_update',
  POSTURE_STATUS: 'postur_durumu',
  NFC_CHIP_SCANNED: 'nfc_chip_scanned',
  NFC_MODE_CHANGE: 'nfc_mode_change',
  LED_MANUAL: 'led_manual',
  LED_OFF: 'led_off',
  LED_AUTO: 'led_auto',
  LED_GET_STATE: 'led_get_state',
  LED_SET_BRIGHTNESS: 'led_set_brightness',
  LED_SET_AMBIENT: 'led_set_ambient',
  CAMERA_CONFIG_SUBSCRIBE: 'camera_config_subscribe',
  CAMERA_STATUS: 'camera_status',
  CAMERA_STATUS_GET: 'camera_status_get',

  // Backend'in yayınladığı
  MODE_CHANGED: 'mode_changed',
  POSTURE_UPDATE: 'posture_update',
  DASHBOARD_SENSOR_DATA: 'dashboard_sensor_data',
  LED_COMMAND: 'led_command',
  LED_STATE_SYNC: 'led_state_sync',
  NFC_CHIP_LIST_UPDATED: 'nfc_chip_list_updated',
  NFC_UNKNOWN_CHIP: 'nfc_unknown_chip',
  CAMERA_CONFIG: 'camera_config',
} as const;

/** AI servislerinin el sıkışmada bildirdiği adlar (`auth.service`). */
export const SERVICE_NAMES = ['camera', 'sensor', 'nfc', 'led'] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface SensorPayload {
  temp: number;
  humidity: number;
  pressure: number;
  air_quality?: number;
  gas_voltage?: number;
}

export interface PosturePayload {
  kambur_mu: boolean;
  mesafe: number;
}

export interface LedManualPayload {
  color: string;
  brightness: number;
}

/**
 * `led_command` türleri. `MANUAL` komutu ai-service'te taban renk olur; sureli
 * komutlar (`duration > 0`) bitince taban renge dönülür. Ortam ışığı rengi
 * `led_state_sync.ambientColor` ile taşınır.
 */
export type LedCommandType = 'MANUAL' | 'POSTURE' | 'MODE_CHANGE';

export interface LedCommand {
  type: LedCommandType;
  color: string;
  duration: number;
  brightness: number;
}
