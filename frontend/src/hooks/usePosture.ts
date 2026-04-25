import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

export interface PostureData {
  isSlouching: boolean;
  distance: number;
  statusText: string;
}

/** Postür analizi verilerini WebSocket üzerinden dinleyen hook */
export function usePosture() {
  const socket = useSocket();
  const [posture, setPosture] = useState<PostureData>({
    isSlouching: false,
    distance: 0,
    statusText: 'Bekleniyor...',
  });

  useEffect(() => {
    const handler = (payload: { isSlouching: boolean; distance: number }) => {
      setPosture({
        isSlouching: payload.isSlouching,
        distance: payload.distance ?? 0,
        statusText: payload.isSlouching ? 'Kambur Duruş' : 'Düzgün Duruş',
      });
    };

    socket.on('posture_update', handler);
    return () => { socket.off('posture_update', handler); };
  }, [socket]);

  return posture;
}
