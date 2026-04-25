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

@WebSocketGateway({
  cors: {
    origin: '*', // Geliştirme aşamasında tüm kökenlere izin veriyoruz
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() 
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  // Python Servisinden Gelen Sensör Verilerini Yakala
  @SubscribeMessage('sensor_update')
  handleSensorUpdate(client: Socket, payload: { temp: number; humidity: number; pressure: number }): void {
    // Bu veriyi doğrudan React arayüzüne "dashboard_sensor_data" adıyla yayınla
    this.server.emit('dashboard_sensor_data', payload);
  }

  // NFC Okuyucudan Gelen Mod Değişim Verilerini Yakala
  @SubscribeMessage('nfc_mode_change')
  handleModeChange(client: Socket, newMode: string): void {
    // Gelen modu (FOCUS, CODING vb.) tüm arayüzlere yayınla
    this.server.emit('nfc_mode_change', newMode);
    this.logger.log(`Mod Değiştirildi: ${newMode}`);
  }

  // Gateway başlatıldığında çalışır
  afterInit(server: Server) {
    this.logger.log('Zenith WebSocket Gateway başlatıldı.');
  }

  // Bir istemci (React veya Python) bağlandığında
  handleConnection(client: Socket) {
    this.logger.log(`İstemci bağlandı: ${client.id}`);
  }

  // Bir istemci ayrıldığında
  handleDisconnect(client: Socket) {
    this.logger.log(`İstemci ayrıldı: ${client.id}`);
  }
}