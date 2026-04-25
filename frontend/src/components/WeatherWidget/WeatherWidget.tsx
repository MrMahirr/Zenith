import type { WeatherData } from '../../hooks/useWeather';
import './WeatherWidget.css';

interface Props {
  weather: WeatherData | null;
}

const WEATHER_ICONS: Record<string, string> = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️',
};

export function WeatherWidget({ weather }: Props) {
  if (!weather) {
    return (
      <div className="weather-widget">
        <span className="weather-widget__loading">...</span>
      </div>
    );
  }

  const icon = WEATHER_ICONS[weather.icon] || '🌤️';

  return (
    <div className="weather-widget" id="weather-widget">
      <div className="weather-widget__main">
        <span className="weather-widget__icon">{icon}</span>
        <span className="weather-widget__temp">{weather.temperature}°</span>
      </div>
      <div className="weather-widget__details">
        <span className="weather-widget__city">{weather.city}</span>
        <span className="weather-widget__desc">{weather.description}</span>
      </div>
    </div>
  );
}
