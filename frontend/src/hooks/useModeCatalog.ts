import { useSyncExternalStore } from 'react';
import { API_URL } from '../config';
import {
  MODE_ORDER,
  fallbackCatalog,
  mergeModeConfig,
  type ModeInfo,
  type ModeName,
} from '../modes/modeCatalog';

type Catalog = Record<ModeName, ModeInfo>;

// Katalog sayfa ömrü boyunca bir kez yüklenir ve tüm bileşenler paylaşır.
let catalog: Catalog = fallbackCatalog();
let requested = false;
const listeners = new Set<() => void>();

function load() {
  if (requested) return;
  requested = true;

  fetch(`${API_URL}/modes/config`)
    .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
    .then((remote) => {
      catalog = mergeModeConfig(remote);
      listeners.forEach((notify) => notify());
    })
    .catch(() => {
      // Yedek katalog kullanılmaya devam eder; sonraki bir yüklemede yeniden denenir.
      requested = false;
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => catalog;

/** Mod tanımlarını (etiket, renk, ikon) döndürür; backend'den yüklenene kadar yedek değerler. */
export function useModeCatalog() {
  const byMode = useSyncExternalStore(subscribe, getSnapshot);
  const modes = MODE_ORDER.map((mode) => byMode[mode]);

  return { byMode, modes };
}
