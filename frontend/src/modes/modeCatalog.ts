/**
 * Mod kataloğu.
 *
 * Mod adı, kısa etiket ve renk backend'den gelir (`GET /api/modes/config`);
 * burada yalnızca çevrimdışı yedek değerler ve arayüze özgü alanlar (ikon,
 * parlama rengi) bulunur. Böylece mod tanımı tek yerde (backend) değişir.
 */
export const MODE_ORDER = ['PASSIVE', 'CODING', 'FOCUS', 'RELAX', 'MEETING'] as const;

export type ModeName = (typeof MODE_ORDER)[number];

export interface ModeInfo {
  mode: ModeName;
  /** Kısa etiket (ör. "Kodlama") */
  label: string;
  color: string;
  /** Renkten türetilen yarı saydam parlama rengi */
  glow: string;
  icon: string;
}

/** Backend'in `GET /api/modes/config` yanıtındaki bir satır. */
export interface RemoteModeConfig {
  mode: string;
  name?: string;
  label?: string;
  color?: string;
}

const UI_ICONS: Record<ModeName, string> = {
  PASSIVE: '⚪',
  CODING: '💻',
  FOCUS: '🎯',
  RELAX: '☕',
  MEETING: '📞',
};

/** Backend'e ulaşılamadığında kullanılan yedek değerler. */
const FALLBACK: Record<ModeName, { label: string; color: string }> = {
  PASSIVE: { label: 'Serbest', color: '#94A3B8' },
  CODING: { label: 'Kodlama', color: '#10B981' },
  FOCUS: { label: 'Odak', color: '#3B82F6' },
  RELAX: { label: 'Relax', color: '#F59E0B' },
  MEETING: { label: 'Toplantı', color: '#EF4444' },
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isModeName(value: unknown): value is ModeName {
  return typeof value === 'string' && (MODE_ORDER as readonly string[]).includes(value);
}

/** `#RRGGBB` rengini yarı saydam `rgba(...)` değerine çevirir. */
export function hexToGlow(hex: string, alpha = 0.15): string {
  if (!HEX_COLOR.test(hex)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildInfo(mode: ModeName, label: string, color: string): ModeInfo {
  return { mode, label, color, glow: hexToGlow(color), icon: UI_ICONS[mode] };
}

/** Yalnızca yedek değerlerden oluşan katalog. */
export function fallbackCatalog(): Record<ModeName, ModeInfo> {
  return Object.fromEntries(
    MODE_ORDER.map((mode) => [mode, buildInfo(mode, FALLBACK[mode].label, FALLBACK[mode].color)]),
  ) as Record<ModeName, ModeInfo>;
}

/**
 * Backend yanıtını yedek katalogla birleştirir. Eksik/bozuk alanlar yedekten
 * alınır; bilinmeyen modlar yok sayılır.
 */
export function mergeModeConfig(remote: unknown): Record<ModeName, ModeInfo> {
  const catalog = fallbackCatalog();
  if (!Array.isArray(remote)) {
    return catalog;
  }

  for (const entry of remote as RemoteModeConfig[]) {
    if (!entry || !isModeName(entry.mode)) continue;

    const fallback = FALLBACK[entry.mode];
    const label =
      typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : fallback.label;
    const color =
      typeof entry.color === 'string' && HEX_COLOR.test(entry.color) ? entry.color : fallback.color;

    catalog[entry.mode] = buildInfo(entry.mode, label, color);
  }

  return catalog;
}
