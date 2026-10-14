import { useSyncExternalStore } from 'react';
import { getSocket } from './useSocket';

function subscribe(listener: () => void) {
  const socket = getSocket();
  socket.on('connect', listener);
  socket.on('disconnect', listener);

  if (!socket.connected) {
    socket.connect();
  }

  return () => {
    socket.off('connect', listener);
    socket.off('disconnect', listener);
  };
}

const getSnapshot = () => getSocket().connected;

/** Backend ile socket bağlantısı kurulu mu? Bağlantı koptukça/kurulduçça güncellenir. */
export function useBackendOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
