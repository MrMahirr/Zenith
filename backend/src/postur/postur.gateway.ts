import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// cors: true ile tüm dış bağlantılara (Python ve React) izin veriyoruz
@WebSocketGateway({ cors: true })
export class PosturGateway implements OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer()
  server: Server;

  // Birisi (Yapay Zeka veya React) sunucuya bağlandığında tetiklenir
  handleConnection(client: Socket) {
    console.log(`[+] Sisteme yeni bir cihaz bağlandı (ID: ${client.id})`);
  }

  // Bağlantı koptuğunda tetiklenir
  handleDisconnect(client: Socket) {
    console.log(`[-] Cihaz bağlantısı kesildi (ID: ${client.id})`);
  }

  // Python'dan gelen 'postur_durumu' etiketli paketleri dinliyoruz
  @SubscribeMessage('postur_durumu')
  handlePosturDurumu(@MessageBody() data: { kambur_mu: boolean; mesafe: number }) {
    
    // Gelen veriyi terminalde şık bir şekilde göster
    const durumMesaji = data.kambur_mu ? '⚠️ DİKKAT: KAMBUR!' : '✅ Duruş Harika';
    console.log(`[AI Verisi] ${durumMesaji} | Omuz-Burun Mesafesi: ${data.mesafe.toFixed(3)}`);
    
    // React'ın dinlediği 'posture_update' kanalına veriyi gönderiyoruz
    // Python'un 'kambur_mu' (boolean) verisini, React'ın beklediği 'isSlouching' değişkenine eşliyoruz
    this.server.emit('posture_update', { 
      isSlouching: data.kambur_mu 
    });
  }
}