import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config';

let socketInstance: Socket | null = null;

/** Singleton socket bağlantısı – tüm hook'lar aynı bağlantıyı paylaşır */
function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(BACKEND_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
  }
  return socketInstance;
}

/** Socket.io bağlantısını yöneten hook */
export function useSocket() {
  const socket = getSocket();

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    // Unmount'ta bağlantıyı KESMİYORUZ: singleton, diğer bileşenler kullanıyor olabilir.
  }, [socket]);

  return socket;
}

export { getSocket };
