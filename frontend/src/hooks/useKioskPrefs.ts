import { useCallback, useSyncExternalStore } from 'react';
import { parseKioskPrefs, type KioskPrefs } from '../kiosk/kioskPrefs';

const STORAGE_KEY = 'zenith.kiosk';

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedPrefs: KioskPrefs = parseKioskPrefs(null);

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // gizli mod/engelli depolama
  }
}

function getSnapshot(): KioskPrefs {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPrefs = parseKioskPrefs(raw);
  }
  return cachedPrefs;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener); // başka sekmeden değişim
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Kiosk ekran tercihleri (ekran koruyucu, gece modu). */
export function useKioskPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot);

  const update = useCallback((patch: Partial<KioskPrefs>) => {
    const next = { ...getSnapshot(), ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Depolama yoksa tercih yalnızca bu oturumda değişmez; sessizce geç.
    }
    listeners.forEach((notify) => notify());
  }, []);

  return { prefs, update };
}
