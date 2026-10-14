import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { SensorService } from '../sensor/sensor.service';
import { PostureService } from '../posture/posture.service';
import { ModeService } from '../mode/mode.service';
import { ModeName, isModeName } from '../mode/mode.constants';
import { NfcService } from '../nfc/nfc.service';
import { LedService } from '../led/led.service';
import { CameraService } from '../camera/camera.service';
import { PreferencesService } from '../preferences/preferences.service';
import { HardwareService } from '../hardware/hardware.service';
import { parseHardwareDevices } from '../hardware/hardware-payload';
import { ServiceRegistry } from '../status/service-registry.service';
import { LedCommand, WS } from './events';
import {
  parseAmbientPayload,
  parseBrightnessPayload,
  parseChipUid,
  parseLedManualPayload,
  parsePosturePayload,
  parseSensorPayload,
  parseServiceName,
} from './payload-guards';

/** Kamera adresi değişikliklerini yalnızca kamera servisine ileten oda. */
const CAMERA_CONFIG_ROOM = 'camera-config';
/** Kullanıcı tercihlerini (eşik, sensör aralığı) AI servislerine ileten oda. */
const SETTINGS_ROOM = 'settings';

/** Mod değişiminde (ortam ışığı kapalıyken) LED'in yanıp sönme süresi. */
const MODE_FLASH_MS = 5000;
/** Duruş düzeldiğinde yeşil uyarının süresi. */
const POSTURE_OK_FLASH_MS = 2000;

const POSTURE_ALERT_COLOR = '#EF4444';
const POSTURE_OK_COLOR = '#10B981';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ZenithGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly postureLedModes = new Set<ModeName>(['CODING', 'FOCUS', 'RELAX', 'MEETING']);

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ZenithGateway.name);

  private cameraConfigSubscription?: Subscription;
  private preferencesSubscription?: Subscription;
  private hardwareSubscriptions: Subscription[] = [];
  private cameraStatus: { connected: boolean } | null = null;

  constructor(
    private readonly sensorService: SensorService,
    private readonly postureService: PostureService,
    private readonly modeService: ModeService,
    private readonly nfcService: NfcService,
    private readonly ledService: LedService,
    private readonly cameraService: CameraService,
    private readonly serviceRegistry: ServiceRegistry,
    private readonly preferences: PreferencesService,
    private readonly hardware: HardwareService,
  ) {}

  afterInit() {
    this.logger.log('Zenith WebSocket Gateway started');

    this.cameraConfigSubscription = this.cameraService.configChanged$.subscribe((config) =>
      this.server.to(CAMERA_CONFIG_ROOM).emit(WS.CAMERA_CONFIG, config),
    );

    this.preferencesSubscription = this.preferences.changed$.subscribe((prefs) =>
      this.server.to(SETTINGS_ROOM).emit(WS.SETTINGS_CHANGED, this.toServiceSettings(prefs)),
    );

    this.hardwareSubscriptions = [
      // Cihaz durumu değişince tüm arayüzlere güncel görüntüyü yayınla.
      this.hardware.changed$.subscribe(() =>
        this.server.emit(WS.HARDWARE_STATUS, this.hardware.snapshot()),
      ),
      // MQ135 kalibrasyon isteğini yalnızca sensör servisine ilet.
      this.hardware.calibrateRequested$.subscribe(() =>
        this.server.to(SETTINGS_ROOM).emit(WS.MQ135_CALIBRATE),
      ),
    ];
  }

  onModuleDestroy() {
    this.cameraConfigSubscription?.unsubscribe();
    this.preferencesSubscription?.unsubscribe();
    this.hardwareSubscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  handleConnection(client: Socket) {
    const service = parseServiceName(client.handshake.auth?.service);
    if (service) {
      this.serviceRegistry.register(client.id, service);
      this.hardware.notifyConnectionChanged();
    }
    this.logger.log(`[+] Connected: ${client.id}${service ? ` (${service})` : ''}`);

    const currentMode = this.modeService.getCurrentMode();
    client.emit(WS.MODE_CHANGED, currentMode);
    this.emitPostureAvailability(currentMode.mode, client);

    if (this.cameraStatus) {
      client.emit(WS.CAMERA_STATUS, this.cameraStatus);
    }
  }

  handleDisconnect(client: Socket) {
    const wasService = this.serviceRegistry.serviceOf(client.id);
    this.serviceRegistry.unregister(client.id);
    this.logger.log(`[-] Disconnected: ${client.id}`);

    if (wasService) {
      this.hardware.notifyConnectionChanged();
    }
  }

  // ──────────── Sensör ────────────

  @SubscribeMessage(WS.SENSOR_UPDATE)
  async handleSensorUpdate(_client: Socket, payload: unknown) {
    const reading = parseSensorPayload(payload);
    if (!reading) {
      this.logger.warn('Geçersiz sensor_update yükü yok sayıldı');
      return;
    }

    await this.sensorService.saveReading(reading);
    this.server.emit(WS.DASHBOARD_SENSOR_DATA, reading);
  }

  // MJPEG doğrudan yayın (5001) mimarisine geçildiği için kare aktarımı WebSocket üzerinden yapılmaz.

  // ──────────── Postür ────────────

  @SubscribeMessage(WS.POSTURE_STATUS)
  async handlePostureStatus(_client: Socket, payload: unknown) {
    const posture = parsePosturePayload(payload);
    if (!posture) {
      this.logger.warn('Geçersiz postur_durumu yükü yok sayıldı');
      return;
    }

    const currentMode = this.modeService.getCurrentMode().mode;
    if (currentMode === 'PASSIVE') {
      return;
    }

    const previousStatus = this.postureService.getCurrentStatus();
    await this.postureService.saveEvent(posture);

    this.server.emit(WS.POSTURE_UPDATE, {
      isActive: true,
      isSlouching: posture.kambur_mu,
      distance: posture.mesafe,
    });

    if (
      this.ledService.getState().mode === 'auto' &&
      this.postureLedModes.has(currentMode) &&
      previousStatus.isSlouching !== posture.kambur_mu
    ) {
      this.emitLedCommand({
        type: 'POSTURE',
        color: posture.kambur_mu ? POSTURE_ALERT_COLOR : POSTURE_OK_COLOR,
        // Uyarı kalıcıdır; "düzeldi" kısa yeşil gösterir ve taban renge (ortam ışığı
        // ya da kapalı) döner.
        duration: posture.kambur_mu ? 0 : POSTURE_OK_FLASH_MS,
        brightness: this.ledService.getState().brightness,
      });
    }
  }

  // ──────────── LED ────────────

  @SubscribeMessage(WS.LED_MANUAL)
  handleLedManual(_client: Socket, payload: unknown) {
    const manual = parseLedManualPayload(payload);
    if (!manual) {
      this.logger.warn('Geçersiz led_manual yükü yok sayıldı');
      return;
    }

    this.ledService.setManual(manual.color, manual.brightness);
    this.emitLedCommand({
      type: 'MANUAL',
      color: manual.color,
      brightness: manual.brightness,
      duration: 0,
    });
    this.emitLedSync();
  }

  @SubscribeMessage(WS.LED_OFF)
  handleLedOff() {
    this.ledService.turnOff();
    this.emitLedCommand({ type: 'MANUAL', color: '#000000', brightness: 0, duration: 0 });
    this.emitLedSync();
  }

  @SubscribeMessage(WS.LED_AUTO)
  handleLedAuto() {
    this.ledService.setAuto();
    this.emitLedSync();
  }

  @SubscribeMessage(WS.LED_GET_STATE)
  handleLedGetState(client: Socket) {
    client.emit(WS.LED_STATE_SYNC, this.buildLedSync());
  }

  @SubscribeMessage(WS.LED_SET_BRIGHTNESS)
  handleLedSetBrightness(_client: Socket, payload: unknown) {
    const brightness = parseBrightnessPayload(payload);
    if (brightness === null) {
      this.logger.warn('Geçersiz led_set_brightness yükü yok sayıldı');
      return;
    }

    this.ledService.setBrightness(brightness);
    // ai-service parlaklığı led_state_sync üzerinden uygular.
    this.emitLedSync();
  }

  /** Ortam ışığını (mod rengi kalıcı yansın) aç/kapat. */
  @SubscribeMessage(WS.LED_SET_AMBIENT)
  async handleLedSetAmbient(_client: Socket, payload: unknown) {
    const enabled = parseAmbientPayload(payload);
    if (enabled === null) {
      this.logger.warn('Geçersiz led_set_ambient yükü yok sayıldı');
      return;
    }

    await this.ledService.setAmbientEnabled(enabled);
    this.emitLedSync();
  }

  // ──────────── NFC / Mod ────────────

  @SubscribeMessage(WS.NFC_CHIP_SCANNED)
  async handleNfcChipScanned(_client: Socket, payload: unknown) {
    const uid = parseChipUid(payload);
    if (!uid) {
      this.logger.warn('Geçersiz nfc_chip_scanned yükü yok sayıldı');
      return;
    }

    const { chip, isNew } = await this.nfcService.handleChipScan(uid);
    this.server.emit(WS.NFC_CHIP_LIST_UPDATED, { chip, isNew });

    if (chip.isRegistered && chip.assignedMode) {
      await this.switchMode(chip.assignedMode);
      return;
    }

    this.server.emit(WS.NFC_UNKNOWN_CHIP, {
      uid: chip.uid,
      chipId: chip.id,
      firstSeenAt: chip.firstSeenAt,
    });
  }

  @SubscribeMessage(WS.NFC_MODE_CHANGE)
  async handleModeChange(_client: Socket, newMode: unknown) {
    if (!isModeName(newMode)) {
      this.logger.warn('Geçersiz nfc_mode_change yükü yok sayıldı');
      return;
    }

    await this.switchMode(newMode);
  }

  // ──────────── Kamera ────────────

  /** Kamera servisi bağlanınca abone olur ve güncel adresi alır. */
  @SubscribeMessage(WS.CAMERA_CONFIG_SUBSCRIBE)
  async handleCameraConfigSubscribe(client: Socket) {
    await client.join(CAMERA_CONFIG_ROOM);
    client.emit(WS.CAMERA_CONFIG, { url: await this.cameraService.getUrl() });
  }

  /** Kamera servisinin bağlantı durumu; adres içermez, tüm arayüzlere yayınlanır. */
  @SubscribeMessage(WS.CAMERA_STATUS)
  handleCameraStatus(_client: Socket, payload: { connected?: unknown }) {
    if (typeof payload?.connected !== 'boolean') {
      return;
    }

    this.cameraStatus = { connected: payload.connected };
    this.server.emit(WS.CAMERA_STATUS, this.cameraStatus);
  }

  /** Arayüz açıldığında bilinen son kamera durumunu ister. */
  @SubscribeMessage(WS.CAMERA_STATUS_GET)
  handleCameraStatusGet(client: Socket) {
    if (this.cameraStatus) {
      client.emit(WS.CAMERA_STATUS, this.cameraStatus);
    }
  }

  // ──────────── Ayarlar ────────────

  /** AI servisleri bağlanınca abone olur ve güncel tercihleri alır. */
  @SubscribeMessage(WS.SETTINGS_SUBSCRIBE)
  async handleSettingsSubscribe(client: Socket) {
    await client.join(SETTINGS_ROOM);
    client.emit(
      WS.SETTINGS_CHANGED,
      this.toServiceSettings(await this.preferences.getOverrides()),
    );
  }

  // ──────────── Donanım ────────────

  /** AI servislerinin cihaz sağlık raporu. Servis kimliği el sıkışmadan alınır. */
  @SubscribeMessage(WS.HARDWARE_STATUS)
  handleHardwareStatus(client: Socket, payload: unknown) {
    const service = this.serviceRegistry.serviceOf(client.id);
    const devices = parseHardwareDevices(payload);

    if (!service || !devices) {
      return;
    }
    this.hardware.report(service, devices);
  }

  /** Sensör servisinin kalibrasyon sonucu: temiz hava gerilimi. */
  @SubscribeMessage(WS.MQ135_CALIBRATED)
  async handleMq135Calibrated(client: Socket, payload: { cleanVoltage?: unknown }) {
    const voltage = payload?.cleanVoltage;
    if (this.serviceRegistry.serviceOf(client.id) !== 'sensor' || typeof voltage !== 'number') {
      return;
    }

    try {
      await this.preferences.update({ mq135CleanVoltage: voltage });
      this.logger.log(`MQ135 kalibre edildi: temiz hava ${voltage} V`);
    } catch (error) {
      this.logger.error(`MQ135 kalibrasyonu kaydedilemedi: ${error}`);
    }
  }

  // ──────────── Yardımcılar ────────────

  /** AI servislerini ilgilendiren tercihler (`null` = servisin kendi varsayılanı). */
  private toServiceSettings(prefs: {
    postureThreshold: number | null;
    sensorIntervalSeconds: number | null;
    mq135CleanVoltage: number | null;
  }) {
    return {
      postureThreshold: prefs.postureThreshold,
      sensorIntervalSeconds: prefs.sensorIntervalSeconds,
      mq135CleanVoltage: prefs.mq135CleanVoltage,
    };
  }

  /** Modu değiştirir ve tüm istemcilere + LED'e yansıtır. */
  private async switchMode(newMode: string) {
    const result = await this.modeService.changeMode(newMode);
    if (!result) {
      return;
    }

    this.server.emit(WS.MODE_CHANGED, result);
    this.emitPostureAvailability(result.mode);

    // Önce taban rengi (ortam ışığı) güncelle; ardından, otomatik moddaysa,
    // varsa bekleyen uyarıyı silecek şekilde yeni durumu göster. Kullanıcı
    // LED'i elle yönetiyorsa elle seçtiği renk korunur.
    this.emitLedSync();

    if (this.ledService.getState().mode !== 'auto') {
      return;
    }

    const { ambientColor, brightness } = this.buildLedSync();
    if (this.ledService.isAmbientEnabled()) {
      this.emitLedCommand({
        type: 'MODE_CHANGE',
        color: ambientColor ?? '#000000',
        duration: 0,
        brightness,
      });
    } else {
      this.emitLedCommand({
        type: 'MODE_CHANGE',
        color: result.config.color,
        duration: MODE_FLASH_MS,
        brightness,
      });
    }
  }

  /** `led_state_sync` yükü: LED durumu + ortam ışığı tercihi ve rengi. */
  private buildLedSync() {
    const state = this.ledService.getState();
    const { mode, config } = this.modeService.getCurrentMode();
    const ambientEnabled = this.ledService.isAmbientEnabled();

    return {
      ...state,
      ambientEnabled,
      // PASSIVE ("serbest") modda ortam ışığı yanmaz.
      ambientColor: ambientEnabled && mode !== 'PASSIVE' ? config.color : null,
    };
  }

  private emitLedSync() {
    this.server.emit(WS.LED_STATE_SYNC, this.buildLedSync());
  }

  private emitLedCommand(command: LedCommand) {
    this.server.emit(WS.LED_COMMAND, command);
  }

  private emitPostureAvailability(mode: string, client?: Socket) {
    const target = client ?? this.server;

    if (mode === 'PASSIVE') {
      this.postureService.setInactive();
      target.emit(WS.POSTURE_UPDATE, {
        isActive: false,
        isSlouching: false,
        distance: 0,
      });
      return;
    }

    const currentStatus = this.postureService.getCurrentStatus();
    target.emit(WS.POSTURE_UPDATE, {
      isActive: true,
      isSlouching: currentStatus.isSlouching,
      distance: currentStatus.distance,
    });
  }
}
