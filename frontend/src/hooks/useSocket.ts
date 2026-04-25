import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = `http://${window.location.hostname}:3000`;

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
  const socketRef = useRef<Socket>(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      // Component unmount'ta bağlantıyı KESMİYORUZ
      // çünkü singleton – diğer component'lar kullanıyor olabilir
    };
  }, []);

  return socketRef.current;
}

export { getSocket };
