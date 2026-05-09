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
import temperatureIcon from '../../assets/icons/thermometer.png';
import humidityIcon from '../../assets/icons/humidity.png';
import windIcon from '../../assets/icons/wind.png';
import chartIcon from '../../assets/icons/chart.png';
import nfcIcon from '../../assets/icons/nfc.png';

export function Dashboard() {
  const sensor = useSensorData();
  const posture = usePosture();
  const mode = useMode();
  const weather = useWeather();
  const navigate = useNavigate();

  const getAirQualityStatus = (value: number | null) => {
    if (value === null) return '...';
    if (value < 20) return 'Temiz';
    if (value < 40) return 'İyi';
    if (value < 60) return 'Orta';
    if (value < 80) return 'Kötü';
    return 'Tehlikeli';
  };

  const aqStatus = getAirQualityStatus(sensor.airQuality);
  const aqColor = sensor.airQuality === null ? '#94A3B8' :
    sensor.airQuality < 40 ? '#10B981' :
    sensor.airQuality < 70 ? '#F59E0B' : '#EF4444';

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
          icon={<img src={temperatureIcon} alt="Sıcaklık" className="dashboard__sensor-icon" />}
          label="Sıcaklık"
          value={sensor.temp}
          unit="°C"
          accentColor="#F97316"
        />
        <SensorCard
          icon={<img src={humidityIcon} alt="Nem" className="dashboard__sensor-icon" />}
          label="Nem"
          value={sensor.humidity}
          unit="%"
          accentColor="#06B6D4"
        />
        <SensorCard
          icon={<img src={windIcon} alt="Hava" className="dashboard__sensor-icon" />}
          label="Hava Kalitesi"
          value={aqStatus}
          unit={sensor.airQuality !== null ? `(${sensor.airQuality}%)` : ''}
          accentColor={aqColor}
        />
        <button
          className="dashboard__chart-btn glass-card"
          onClick={() => navigate('/analytics')}
          id="analytics-btn"
        >
          <span className="dashboard__chart-btn-icon">
            <img src={chartIcon} alt="İstatistik" className="dashboard__sensor-icon" />
          </span>
          <span className="dashboard__chart-btn-text">İstatistik</span>
          <span className="dashboard__chart-btn-chevron">›</span>
        </button>
        <button
          className="dashboard__chart-btn glass-card"
          onClick={() => navigate('/nfc')}
          id="nfc-btn"
        >
          <span className="dashboard__chart-btn-icon">
            <img src={nfcIcon} alt="NFC" className="dashboard__sensor-icon" />
          </span>
          <span className="dashboard__chart-btn-text">NFC</span>
          <span className="dashboard__chart-btn-chevron">›</span>
        </button>
        <button
          className="dashboard__chart-btn glass-card"
          onClick={() => navigate('/led')}
          id="led-btn"
        >
          <span className="dashboard__chart-btn-icon">
            <span style={{ fontSize: '18px' }}>💡</span>
          </span>
          <span className="dashboard__chart-btn-text">LED</span>
          <span className="dashboard__chart-btn-chevron">›</span>
        </button>
      </footer>
    </div>
  );
}
