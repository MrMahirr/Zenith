import { useNavigate } from 'react-router-dom';
import type { WeatherData } from '../../hooks/useWeather';
import './WeatherWidget.css';

interface Props {
  weather: WeatherData | null;
}

const WEATHER_ICONS: Record<string, string> = {
  '01d': 'Gunes',
  '01n': 'Ay',
  '02d': 'Bulut',
  '02n': 'Bulut',
  '03d': 'Bulut',
  '03n': 'Bulut',
  '04d': 'Kapali',
  '04n': 'Kapali',
  '09d': 'Sag.',
  '09n': 'Sag.',
  '10d': 'Yagmur',
  '10n': 'Yagmur',
  '11d': 'Firt.',
  '11n': 'Firt.',
  '13d': 'Kar',
  '13n': 'Kar',
  '50d': 'Sis',
  '50n': 'Sis',
};

export function WeatherWidget({ weather }: Props) {
  const navigate = useNavigate();

  if (!weather) {
    return (
      <button
        className="weather-widget weather-widget--button"
        type="button"
        onClick={() => navigate('/weather')}
      >
        <span className="weather-widget__loading">...</span>
      </button>
    );
  }

  const icon = WEATHER_ICONS[weather.icon] || 'Hava';

  return (
    <button
      className="weather-widget weather-widget--button"
      type="button"
      id="weather-widget"
      onClick={() => navigate('/weather')}
    >
      <div className="weather-widget__main">
        <span className="weather-widget__icon">{icon}</span>
        <span className="weather-widget__temp">{weather.temperature}°</span>
      </div>
      <div className="weather-widget__details">
        <span className="weather-widget__city">{weather.city}</span>
        <span className="weather-widget__desc">{weather.description}</span>
      </div>
    </button>
  );
}
