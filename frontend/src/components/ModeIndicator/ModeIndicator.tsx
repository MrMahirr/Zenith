import type { ModeData } from '../../hooks/useMode';
import './ModeIndicator.css';

interface Props {
  mode: ModeData;
  isOpen?: boolean;
}

export function ModeIndicator({ mode, isOpen }: Props) {
  return (
    <div
      className={`mode-indicator ${mode.isTransitioning ? 'mode-indicator--transitioning' : ''}`}
      style={{ '--mode-color': mode.color, '--mode-glow': mode.glow } as React.CSSProperties}
    >
      <div className="mode-indicator__dot" />
      <div className="mode-indicator__info">
        <span className="mode-indicator__label">Aktif Mod</span>
        <span className="mode-indicator__name">{mode.name}</span>
      </div>
      {isOpen !== undefined && (
        <div className={`mode-indicator__chevron ${isOpen ? 'mode-indicator__chevron--open' : ''}`}>
          ›
        </div>
      )}
    </div>
  );
}
