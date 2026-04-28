import './SensorCard.css';

interface Props {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  unit: string;
  accentColor?: string;
}

export function SensorCard({ icon, label, value, unit, accentColor }: Props) {
  return (
    <div
      className="sensor-card glass-card"
      style={accentColor ? { '--accent': accentColor } as React.CSSProperties : undefined}
    >
      <div className="sensor-card__header">
        <span className="sensor-card__icon">{icon}</span>
        <span className="sensor-card__label">{label}</span>
      </div>
      <div className="sensor-card__value-row">
        <span className="sensor-card__value mono">
          {value !== null && value !== undefined ? value : '--'}
        </span>
        <span className="sensor-card__unit">{unit}</span>
      </div>
    </div>
  );
}
