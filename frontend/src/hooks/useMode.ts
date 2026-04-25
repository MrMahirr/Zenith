import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

export const MODE_CONFIG = {
  PASSIVE: { name: 'Serbest', color: '#94A3B8', glow: 'rgba(148, 163, 184, 0.15)' },
  CODING:  { name: 'Kodlama', color: '#10B981', glow: 'rgba(16, 185, 129, 0.15)' },
  FOCUS:   { name: 'Odak',    color: '#3B82F6', glow: 'rgba(59, 130, 246, 0.15)' },
  RELAX:   { name: 'Relax',   color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.15)' },
  MEETING: { name: 'Toplantı',color: '#EF4444', glow: 'rgba(239, 68, 68, 0.15)' },
} as const;

export type ModeName = keyof typeof MODE_CONFIG;

export interface ModeData {
  mode: ModeName;
  name: string;
  color: string;
  glow: string;
  isTransitioning: boolean;
}

/** NFC kart ile değişen mod bilgisini yöneten hook */
export function useMode() {
  const socket = useSocket();
  const [mode, setMode] = useState<ModeName>('PASSIVE');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const handler = (payload: { mode: ModeName }) => {
      if (MODE_CONFIG[payload.mode]) {
        setIsTransitioning(true);
        setMode(payload.mode);

        // 5 saniyelik geçiş animasyonu
        setTimeout(() => setIsTransitioning(false), 5000);
      }
    };

    socket.on('mode_changed', handler);
    return () => { socket.off('mode_changed', handler); };
  }, [socket]);

  const config = MODE_CONFIG[mode];

  return {
    mode,
    name: config.name,
    color: config.color,
    glow: config.glow,
    isTransitioning,
  };
}
