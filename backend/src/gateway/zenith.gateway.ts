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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ZenithGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly postureLedModes = new Set(['CODING', 'FOCUS']);

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ZenithGateway.name);

  constructor(
    private readonly sensorService: SensorService,
    private readonly postureService: PostureService,
    private readonly modeService: ModeService,
    private readonly nfcService: NfcService,
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
    payload: { temp: number; humidity: number; pressure: number },
  ) {
    await this.sensorService.saveReading(payload);
    this.server.emit('dashboard_sensor_data', payload);
  }

  @SubscribeMessage('kamera_kare')
  handleKameraKare(_client: Socket, frameB64: string) {
    this.server.emit('camera_frame', frameB64);
  }

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
      this.postureLedModes.has(currentMode) &&
      previousStatus.isSlouching !== payload.kambur_mu
    ) {
      this.server.emit('led_command', {
        type: 'POSTURE',
        color: payload.kambur_mu ? '#EF4444' : '#10B981',
        duration: payload.kambur_mu ? 0 : 2000,
      });
    }
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
