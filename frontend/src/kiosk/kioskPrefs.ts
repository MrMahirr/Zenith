/**
 * Kiosk ekran tercihleri (cihaza özel; tarayıcıda saklanır) ve saf yardımcıları.
 */
export interface KioskPrefs {
  /** Bu kadar dakika dokunulmazsa ekran koruyucu açılır; 0 = kapalı. */
  idleMinutes: number;
  /** Geceleri (22:00–07:00) ekranı karart. */
  nightMode: boolean;
}

export const IDLE_OPTIONS = [0, 1, 2, 5, 10, 30] as const;

export const DEFAULT_KIOSK_PREFS: KioskPrefs = { idleMinutes: 0, nightMode: false };

export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 7;

/** Kayıtlı JSON'u doğrular; geçersiz alanlar varsayılana döner. */
export function parseKioskPrefs(raw: string | null): KioskPrefs {
  if (!raw) return { ...DEFAULT_KIOSK_PREFS };

  try {
    const value = JSON.parse(raw) as Partial<Record<keyof KioskPrefs, unknown>>;
    const idle = value.idleMinutes;

    return {
      idleMinutes:
        typeof idle === 'number' && (IDLE_OPTIONS as readonly number[]).includes(idle)
          ? idle
          : DEFAULT_KIOSK_PREFS.idleMinutes,
      nightMode: typeof value.nightMode === 'boolean' ? value.nightMode : DEFAULT_KIOSK_PREFS.nightMode,
    };
  } catch {
    return { ...DEFAULT_KIOSK_PREFS };
  }
}

/** Verilen saat gece aralığında mı? Aralık gece yarısını aşabilir (22 → 7). */
export function isNightTime(
  date: Date,
  startHour: number = NIGHT_START_HOUR,
  endHour: number = NIGHT_END_HOUR,
): boolean {
  const hour = date.getHours();
  return startHour > endHour ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
}
