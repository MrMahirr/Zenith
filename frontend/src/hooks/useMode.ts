import { useCallback, useEffect, useRef, useState } from 'react';
import { isModeName, type ModeName } from '../modes/modeCatalog';
import { useModeCatalog } from './useModeCatalog';
import { useSocket } from './useSocket';

export type { ModeName } from '../modes/modeCatalog';

export interface ModeData {
  mode: ModeName;
  name: string;
  color: string;
  glow: string;
  isTransitioning: boolean;
}

/** Mod geçiş animasyonunun süresi (ms) */
const TRANSITION_MS = 5000;

/** Aktif modu izler ve ekrandan mod değiştirmeyi sağlar. */
export function useMode() {
  const socket = useSocket();
  const { byMode } = useModeCatalog();
  const [mode, setModeState] = useState<ModeName>('PASSIVE');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (payload: { mode?: unknown }) => {
      if (!isModeName(payload.mode)) return;

      setIsTransitioning(true);
      setModeState(payload.mode);

      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
    };

    socket.on('mode_changed', handler);
    return () => {
      socket.off('mode_changed', handler);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, [socket]);

  /** Modu değiştirir; sonuç `mode_changed` olayıyla tüm arayüzlere yansır. */
  const setMode = useCallback(
    (next: ModeName) => {
      socket.emit('nfc_mode_change', next);
    },
    [socket],
  );

  const info = byMode[mode];

  return {
    mode,
    name: info.label,
    color: info.color,
    glow: info.glow,
    isTransitioning,
    setMode,
  };
}
