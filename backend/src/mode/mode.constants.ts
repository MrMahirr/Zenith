/** Mod tanımları ve LED renk eşleştirmeleri (tek kaynak). */
export const MODE_CONFIG = {
  PASSIVE: { name: 'Serbest', color: '#94A3B8' },
  CODING: { name: 'Kodlama Modu', color: '#10B981' },
  FOCUS: { name: 'Odak Modu', color: '#3B82F6' },
  RELAX: { name: 'Relax Modu', color: '#F59E0B' },
  MEETING: { name: 'Toplantı Modu', color: '#EF4444' },
} as const;

export type ModeName = keyof typeof MODE_CONFIG;

/** Geçerli mod adları; DTO doğrulamasında kullanılır. */
export const MODE_NAMES = Object.keys(MODE_CONFIG) as ModeName[];

export const DEFAULT_MODE: ModeName = 'PASSIVE';

export function isModeName(value: unknown): value is ModeName {
  return typeof value === 'string' && Object.hasOwn(MODE_CONFIG, value);
}
