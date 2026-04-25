import { useNavigate } from 'react-router-dom';
import { Clock } from '../../components/Clock/Clock';
import { ModeIndicator } from '../../components/ModeIndicator/ModeIndicator';
import { PostureAlert } from '../../components/PostureAlert/PostureAlert';
import { WeatherWidget } from '../../components/WeatherWidget/WeatherWidget';
import { SensorCard } from '../../components/SensorCard/SensorCard';
import { useSensorData } from '../../hooks/useSensorData';
import { usePosture } from '../../hooks/usePosture';
import { useMode } from '../../hooks/useMode';
import { useWeather } from '../../hooks/useWeather';
import './Dashboard.css';

export function Dashboard() {
  const sensor = useSensorData();
  const posture = usePosture();
  const mode = useMode();
  const weather = useWeather();
  const navigate = useNavigate();

  return (
    <div
      className="dashboard"
      style={{ '--mode-color': mode.color, '--mode-glow': mode.glow } as React.CSSProperties}
    >
      {/* Mode geçiş ambient glow */}
      <div className={`dashboard__ambient ${mode.isTransitioning ? 'dashboard__ambient--active' : ''}`} />

      {/* ─── ÜST BAR ─── */}
      <header className="dashboard__header">
        <div className="dashboard__header-left">
          <ModeIndicator mode={mode} />
        </div>
        <div className="dashboard__header-center">
          <PostureAlert posture={posture} />
        </div>
        <div className="dashboard__header-right">
          <WeatherWidget weather={weather} />
        </div>
      </header>

      {/* ─── ORTA: SAAT ─── */}
      <main className="dashboard__center">
        <Clock />
      </main>

      {/* ─── ALT BAR: SENSÖR VERİLERİ ─── */}
      <footer className="dashboard__footer">
        <SensorCard
          icon="🌡️"
          label="Sıcaklık"
          value={sensor.temp}
          unit="°C"
          accentColor="#F97316"
        />
        <SensorCard
          icon="💧"
          label="Nem"
          value={sensor.humidity}
          unit="%"
          accentColor="#06B6D4"
        />
        <SensorCard
          icon="💨"
          label="Hava Kalitesi"
          value="İyi"
          unit=""
          accentColor="#10B981"
        />
        <button
          className="dashboard__chart-btn glass-card"
          onClick={() => navigate('/analytics')}
          id="analytics-btn"
        >
          <span className="dashboard__chart-btn-icon">📊</span>
          <span className="dashboard__chart-btn-text">İstatistik</span>
          <span className="dashboard__chart-btn-chevron">›</span>
        </button>
      </footer>
    </div>
  );
}
