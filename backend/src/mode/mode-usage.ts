import { MODE_NAMES, ModeName } from './mode.constants';

export interface ModeChangeEvent {
  mode: string;
  at: Date;
}

/**
 * Mod değişim kayıtlarından her modda geçirilen süreyi (saniye) hesaplar.
 *
 * @param events       pencere içindeki değişimler (zaman sırasına göre)
 * @param initialMode  pencere başlangıcında aktif olan mod; bilinmiyorsa `null`
 *                     (bu durumda ilk değişime kadarki süre sayılmaz)
 * @param windowStart  pencere başlangıcı
 * @param windowEnd    pencere sonu (genellikle "şimdi")
 */
export function computeModeDurations(
  events: ModeChangeEvent[],
  initialMode: string | null,
  windowStart: Date,
  windowEnd: Date,
): Record<ModeName, number> {
  const seconds = Object.fromEntries(MODE_NAMES.map((mode) => [mode, 0])) as Record<
    ModeName,
    number
  >;

  const add = (mode: string, from: number, to: number) => {
    const length = Math.max(0, to - from) / 1000;
    if (length > 0 && mode in seconds) {
      seconds[mode as ModeName] += length;
    }
  };

  const end = windowEnd.getTime();
  let activeMode = initialMode;
  let cursor = windowStart.getTime();

  for (const event of events) {
    const at = Math.min(Math.max(event.at.getTime(), windowStart.getTime()), end);
    if (activeMode !== null) {
      add(activeMode, cursor, at);
    }
    activeMode = event.mode;
    cursor = at;
  }

  if (activeMode !== null) {
    add(activeMode, cursor, end);
  }

  return seconds;
}
