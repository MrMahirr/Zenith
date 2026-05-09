import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SensorService } from '../sensor/sensor.service';
import { PostureService } from '../posture/posture.service';
import { ModeService } from '../mode/mode.service';
import { NfcService } from '../nfc/nfc.service';
import { LedService } from '../led/led.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ZenithGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly postureLedModes = new Set(['CODING', 'FOCUS', 'RELAX', 'MEETING']);

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ZenithGateway.name);

  constructor(
    private readonly sensorService: SensorService,
    private readonly postureService: PostureService,
    private readonly modeService: ModeService,
    private readonly nfcService: NfcService,
    private readonly ledService: LedService,
  ) {}

  afterInit() {
    this.logger.log('Zenith WebSocket Gateway started');
  }

  handleConnection(client: Socket) {
    this.logger.log(`[+] Connected: ${client.id}`);
    const currentMode = this.modeService.getCurrentMode();
    client.emit('mode_changed', currentMode);
    this.emitPostureAvailability(currentMode.mode, client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[-] Disconnected: ${client.id}`);
  }

  @SubscribeMessage('sensor_update')
  async handleSensorUpdate(
    _client: Socket,
    payload: {
      temp: number;
      humidity: number;
      pressure: number;
      air_quality: number;
      gas_voltage: number;
    },
  ) {
    await this.sensorService.saveReading(payload);
    this.server.emit('dashboard_sensor_data', payload);
  }

  // MJPEG Direkt Yayın (5001) mimarisine geçildiği için kamera_kare WS aktarımı kaldırılmıştır.
  // Bu sayede NestJS backend işlemci ve RAM yükü dramatik şekilde sıfırlanmıştır.

  @SubscribeMessage('postur_durumu')
  async handlePostureDurumu(
    _client: Socket,
    payload: { kambur_mu: boolean; mesafe: number },
  ) {
    const currentMode = this.modeService.getCurrentMode().mode;

    if (currentMode === 'PASSIVE') {
      return;
    }

    const previousStatus = this.postureService.getCurrentStatus();
    await this.postureService.saveEvent(payload);

    this.server.emit('posture_update', {
      isActive: true,
      isSlouching: payload.kambur_mu,
      distance: payload.mesafe,
    });

    if (
      this.ledService.getState().mode === 'auto' &&
      this.postureLedModes.has(currentMode) &&
      previousStatus.isSlouching !== payload.kambur_mu
    ) {
      this.server.emit('led_command', {
        type: 'POSTURE',
        color: payload.kambur_mu ? '#EF4444' : '#10B981',
        duration: payload.kambur_mu ? 0 : 2000,
        brightness: this.ledService.getState().brightness,
      });
    }
  }

  @SubscribeMessage('led_manual')
  handleLedManual(_client: Socket, payload: { color: string; brightness: number }) {
    this.ledService.setManual(payload.color, payload.brightness);
    this.server.emit('led_command', {
      type: 'MANUAL',
      color: payload.color,
      brightness: payload.brightness,
      duration: 0,
    });
    this.server.emit('led_state_sync', this.ledService.getState());
  }

  @SubscribeMessage('led_off')
  handleLedOff() {
    this.ledService.turnOff();
    this.server.emit('led_command', { type: 'MANUAL', color: '#000000', brightness: 0, duration: 0 });
    this.server.emit('led_state_sync', this.ledService.getState());
  }

  @SubscribeMessage('led_auto')
  handleLedAuto() {
    this.ledService.setAuto();
    this.server.emit('led_state_sync', this.ledService.getState());
  }

  @SubscribeMessage('led_get_state')
  handleLedGetState(client: Socket) {
    client.emit('led_state_sync', this.ledService.getState());
  }

  @SubscribeMessage('led_set_brightness')
  handleLedSetBrightness(_client: Socket, payload: { brightness: number }) {
    this.ledService.setBrightness(payload.brightness);
    const currentState = this.ledService.getState();
    // Eger LED açıksa veya otomatikteyse doğrudan fiziksel donanıma da gönder,
    // (python color gelmezse target_color'u hatırlamıyor, bu yüzden sadece led_state_sync ile state'i güncelliyoruz)
    this.server.emit('led_state_sync', currentState);
  }

  @SubscribeMessage('nfc_chip_scanned')
  async handleNfcChipScanned(
    _client: Socket,
    payload: { uid: string },
  ) {
    const { chip, isNew } = await this.nfcService.handleChipScan(payload.uid);
    this.server.emit('nfc_chip_list_updated', { chip, isNew });

    if (chip.isRegistered && chip.assignedMode) {
      const result = await this.modeService.changeMode(chip.assignedMode);

      if (result) {
        this.server.emit('mode_changed', result);
        this.emitPostureAvailability(result.mode);
        this.server.emit('led_command', {
          type: 'MODE_CHANGE',
          color: result.config.color,
          duration: 5000,
          brightness: this.ledService.getState().brightness,
        });
      }
      return;
    }

    this.server.emit('nfc_unknown_chip', {
      uid: chip.uid,
      chipId: chip.id,
      firstSeenAt: chip.firstSeenAt,
    });
  }

  @SubscribeMessage('nfc_mode_change')
  async handleModeChange(_client: Socket, newMode: string) {
    const result = await this.modeService.changeMode(newMode);

    if (!result) {
      return;
    }

    this.server.emit('mode_changed', result);
    this.emitPostureAvailability(result.mode);
    this.server.emit('led_command', {
      type: 'MODE_CHANGE',
      color: result.config.color,
      duration: 5000,
      brightness: this.ledService.getState().brightness,
    });
  }

  private emitPostureAvailability(mode: string, client?: Socket) {
    const target = client ?? this.server;

    if (mode === 'PASSIVE') {
      this.postureService.setInactive();
      target.emit('posture_update', {
        isActive: false,
        isSlouching: false,
        distance: 0,
      });
      return;
    }

    const currentStatus = this.postureService.getCurrentStatus();
    target.emit('posture_update', {
      isActive: true,
      isSlouching: currentStatus.isSlouching,
      distance: currentStatus.distance,
    });
  }
}
