#!/usr/bin/env node
// Backend WebSocket duman testi: LED'i manuel kırmızıya alıp durum
// senkronizasyonunun geldiğini doğrular, ardından LED'i otomatik moda geri verir.
//
//   node scripts/ws-led-smoke.js            (varsayılan: http://localhost:3000)
//   ZENITH_BACKEND_URL=http://192.168.6.23:3000 node scripts/ws-led-smoke.js
//
// Çıkış kodu: 0 = başarılı, 1 = zaman aşımı/hata.
const path = require('path');

function loadSocketClient() {
  const candidates = [
    'socket.io-client',
    path.join(__dirname, '..', 'frontend', 'node_modules', 'socket.io-client'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // sıradaki adayı dene
    }
  }
  console.error('socket.io-client bulunamadı. Önce: cd frontend && npm ci');
  process.exit(1);
}

const { io } = loadSocketClient();
const url = process.env.ZENITH_BACKEND_URL || 'http://localhost:3000';
const socket = io(url, { transports: ['websocket'] });

const timeout = setTimeout(() => {
  console.error('Zaman aşımı: led_state_sync alınamadı');
  process.exit(1);
}, 3000);

socket.on('connect', () => {
  console.log(`Bağlandı: ${url}`);
  socket.emit('led_manual', { color: '#FF0000', brightness: 255 });
});

socket.once('led_state_sync', (state) => {
  console.log('Alınan durum:', state);
  clearTimeout(timeout);
  socket.emit('led_auto');
  setTimeout(() => process.exit(0), 200);
});

socket.on('connect_error', (error) => {
  console.error('Bağlantı hatası:', error.message);
  process.exit(1);
});
