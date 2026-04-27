import type { ModeName } from '../hooks/useMode';

export interface ThemeColors {
  /** Ana arkaplan rengi (sayfanın en alt katmanı) */
  bgPrimary: string;
  /** İkincil arkaplan rengi (gradient veya overlay) */
  bgSecondary: string;
  /** Glassmorphism kartlarının varsayılan rengi */
  bgCard: string;
  /** Glassmorphism kartlarının hover rengi */
  bgCardHover: string;
  
  /** Gradient efekti 1 (sayfanın köşesinden vuran renk) */
  gradient1: string;
  /** Gradient efekti 2 (sayfanın diğer köşesinden vuran renk) */
  gradient2: string;

  /** Çizgi/Border rengi (hafif) */
  borderSubtle: string;
  /** Çizgi/Border rengi (parlayan/seçili) */
  borderGlow: string;

  /** Ana vurgu/Aksan rengi (Modun karakteristik rengi) */
  accent: string;
  /** Aksan renginin transparan hali (Glow efektleri için) */
  accentGlow: string;

  /** Ana metin rengi */
  textPrimary: string;
  /** İkincil metin rengi */
  textSecondary: string;
  /** Soluk metin rengi */
  textMuted: string;
}

/**
 * Her mod için göz alıcı, modern ve premium tema renk paletleri.
 * Raspberry Pi'nin 7 inçlik ekranında "vav!" dedirtecek kontrastlar içerir.
 */
export const THEMES: Record<ModeName, ThemeColors> = {
  PASSIVE: {
    // Uzay grisi / Koyu Lacivert (Sakin ve Premium)
    bgPrimary: '#080c14',
    bgSecondary: '#0f172a',
    bgCard: 'rgba(255, 255, 255, 0.03)',
    bgCardHover: 'rgba(255, 255, 255, 0.06)',
    gradient1: 'rgba(148, 163, 184, 0.05)',
    gradient2: 'rgba(56, 189, 248, 0.03)',
    borderSubtle: 'rgba(255, 255, 255, 0.05)',
    borderGlow: 'rgba(255, 255, 255, 0.15)',
    accent: '#94A3B8',
    accentGlow: 'rgba(148, 163, 184, 0.2)',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#64748b',
  },
  
  CODING: {
    // Cyberpunk / Matrix (Çok koyu zemin, neon zümrüt vurgular)
    bgPrimary: '#020604',
    bgSecondary: '#061a10',
    bgCard: 'rgba(16, 185, 129, 0.03)',
    bgCardHover: 'rgba(16, 185, 129, 0.08)',
    gradient1: 'rgba(16, 185, 129, 0.07)',
    gradient2: 'rgba(5, 150, 105, 0.04)',
    borderSubtle: 'rgba(16, 185, 129, 0.1)',
    borderGlow: 'rgba(16, 185, 129, 0.4)',
    accent: '#10B981',
    accentGlow: 'rgba(16, 185, 129, 0.3)',
    textPrimary: '#ecfdf5',
    textSecondary: '#6ee7b7',
    textMuted: '#059669',
  },

  FOCUS: {
    // Derin Okyanus / Odaklanma (Düşük kontrastlı derin maviler)
    bgPrimary: '#050a1f',
    bgSecondary: '#0c153b',
    bgCard: 'rgba(59, 130, 246, 0.04)',
    bgCardHover: 'rgba(59, 130, 246, 0.08)',
    gradient1: 'rgba(59, 130, 246, 0.08)',
    gradient2: 'rgba(147, 197, 253, 0.03)',
    borderSubtle: 'rgba(59, 130, 246, 0.15)',
    borderGlow: 'rgba(59, 130, 246, 0.5)',
    accent: '#3B82F6',
    accentGlow: 'rgba(59, 130, 246, 0.35)',
    textPrimary: '#eff6ff',
    textSecondary: '#93c5fd',
    textMuted: '#3b82f6',
  },

  RELAX: {
    // Gün Batımı / Sıcak Loş Işık (Kehribar, kahve ve sıcak tonlar)
    bgPrimary: '#1a0d05',
    bgSecondary: '#2e1503',
    bgCard: 'rgba(245, 158, 11, 0.04)',
    bgCardHover: 'rgba(245, 158, 11, 0.09)',
    gradient1: 'rgba(245, 158, 11, 0.08)',
    gradient2: 'rgba(249, 115, 22, 0.04)',
    borderSubtle: 'rgba(245, 158, 11, 0.15)',
    borderGlow: 'rgba(245, 158, 11, 0.4)',
    accent: '#F59E0B',
    accentGlow: 'rgba(245, 158, 11, 0.3)',
    textPrimary: '#fffbeb',
    textSecondary: '#fcd34d',
    textMuted: '#b45309',
  },

  MEETING: {
    // Elegant Kızıl (Ciddi, profesyonel, uyarıcı ama yormayan kırmızı)
    bgPrimary: '#170505',
    bgSecondary: '#2b0a0a',
    bgCard: 'rgba(239, 68, 68, 0.03)',
    bgCardHover: 'rgba(239, 68, 68, 0.08)',
    gradient1: 'rgba(239, 68, 68, 0.08)',
    gradient2: 'rgba(185, 28, 28, 0.04)',
    borderSubtle: 'rgba(239, 68, 68, 0.15)',
    borderGlow: 'rgba(239, 68, 68, 0.5)',
    accent: '#EF4444',
    accentGlow: 'rgba(239, 68, 68, 0.35)',
    textPrimary: '#fef2f2',
    textSecondary: '#fca5a5',
    textMuted: '#b91c1c',
  },
};
