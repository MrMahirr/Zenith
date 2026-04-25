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

/**
 * Zenith WebSocket Gateway – Tek Hub
 * 
 * Tüm Python servisleri (sensör, postür, NFC) buraya bağlanır.
 * Gelen veriler ilgili servislere yönlendirilir (DB kaydı) ve
 * React frontend'e broadcast edilir.
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Geliştirme aşamasında – production'da kısıtlanacak
  },
})
export class ZenithGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ZenithGateway.name);

  constructor(
    private readonly sensorService: SensorService,
    private readonly postureService: PostureService,
    private readonly modeService: ModeService,
  ) {}

  // ──────────── LIFECYCLE ────────────

  afterInit() {
    this.logger.log('Zenith WebSocket Gateway başlatıldı ✓');
  }

  handleConnection(client: Socket) {
    this.logger.log(`[+] Bağlandı: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[-] Ayrıldı: ${client.id}`);
  }

  // ──────────── SENSOR (Python → Backend → React) ────────────

  @SubscribeMessage('sensor_update')
  async handleSensorUpdate(
    _client: Socket,
    payload: { temp: number; humidity: number; pressure: number },
  ) {
    // DB'ye kaydet
    await this.sensorService.saveReading(payload);

    // React'a yayınla
    this.server.emit('dashboard_sensor_data', payload);
  }

  // ──────────── POSTURE (Python → Backend → React + LED) ────────────

  @SubscribeMessage('kamera_kare')
  handleKameraKare(_client: Socket, frameB64: string) {
    this.server.emit('camera_frame', frameB64);
  }

  @SubscribeMessage('postur_durumu')
  async handlePostureDurumu(
    _client: Socket,
    payload: { kambur_mu: boolean; mesafe: number },
  ) {
    const previousStatus = this.postureService.getCurrentStatus();

    // DB'ye kaydet
    await this.postureService.saveEvent(payload);

    // React'a yayınla
    this.server.emit('posture_update', {
      isSlouching: payload.kambur_mu,
      distance: payload.mesafe,
    });

    if (previousStatus.isSlouching !== payload.kambur_mu) {
      // LED komutunu sadece gerçek duruş değişiminde gönder
      this.server.emit('led_command', {
        type: 'POSTURE',
        color: payload.kambur_mu ? '#EF4444' : '#10B981',
        duration: payload.kambur_mu ? 0 : 2000,
      });
    }
  }

  // ──────────── NFC MODE (Python → Backend → React + LED) ────────────

  @SubscribeMessage('nfc_mode_change')
  async handleModeChange(_client: Socket, newMode: string) {
    const result = await this.modeService.changeMode(newMode);

    if (result) {
      // React'a yayınla
      this.server.emit('mode_changed', result);

      // LED'e mod renk animasyonu komutu gönder
      this.server.emit('led_command', {
        type: 'MODE_CHANGE',
        color: result.config.color,
        duration: 5000, // 5 saniye animasyon
      });
    }
  }
}
