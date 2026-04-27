import { useEffect } from 'react';
import { useMode } from '../hooks/useMode';
import { THEMES } from '../theme/theme.config';

/**
 * Dinamik Tema Sağlayıcısı
 * 
 * useMode hook'unu dinleyerek, o anki aktif moda ait renk paletini 
 * CSS değişkenleri (var(--...)) olarak :root elementine enjekte eder.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useMode();

  useEffect(() => {
    const root = document.documentElement;
    const theme = THEMES[mode] || THEMES.PASSIVE; // Fallback

    // Tema değişkenlerini root'a uygula
    root.style.setProperty('--bg-primary', theme.bgPrimary);
    root.style.setProperty('--bg-secondary', theme.bgSecondary);
    root.style.setProperty('--bg-card', theme.bgCard);
    root.style.setProperty('--bg-card-hover', theme.bgCardHover);
    root.style.setProperty('--gradient-1', theme.gradient1);
    root.style.setProperty('--gradient-2', theme.gradient2);
    root.style.setProperty('--border-subtle', theme.borderSubtle);
    root.style.setProperty('--border-glow', theme.borderGlow);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-glow', theme.accentGlow);
    root.style.setProperty('--text-primary', theme.textPrimary);
    root.style.setProperty('--text-secondary', theme.textSecondary);
    root.style.setProperty('--text-muted', theme.textMuted);
    
  }, [mode]);

  return <>{children}</>;
}
