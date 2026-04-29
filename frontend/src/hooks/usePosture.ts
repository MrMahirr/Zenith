import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

export interface PostureData {
  isActive: boolean;
  isSlouching: boolean;
  distance: number;
  statusText: string;
}

export function usePosture() {
  const socket = useSocket();
  const [posture, setPosture] = useState<PostureData>({
    isActive: false,
    isSlouching: false,
    distance: 0,
    statusText: 'Analiz kapali',
  });

  useEffect(() => {
    const handler = (payload: {
      isActive?: boolean;
      isSlouching?: boolean;
      distance?: number;
    }) => {
      const isActive = payload.isActive ?? true;
      const distance = isActive ? payload.distance ?? 0 : 0;
      const isSlouching = isActive ? Boolean(payload.isSlouching) : false;

      let statusText = 'Analiz kapali';
      if (isActive) {
        statusText =
          distance <= 0
            ? 'Bekleniyor...'
            : isSlouching
              ? 'Kambur Durus'
              : 'Duzgun Durus';
      }

      setPosture({
        isActive,
        isSlouching,
        distance,
        statusText,
      });
    };

    socket.on('posture_update', handler);
    return () => {
      socket.off('posture_update', handler);
    };
  }, [socket]);

  return posture;
}
