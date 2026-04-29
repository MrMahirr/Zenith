import { useNavigate } from 'react-router-dom';
import { useWeatherPanel } from '../../hooks/useWeather';
import './Weather.css';

function formatHourLabel(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

function WeatherSkeleton() {
  return (
    <div className="weather-page__content weather-page__content--loading" aria-hidden="true">
      <div className="weather-page__hero glass-card weather-page__skeleton-block" />
      <div className="weather-page__section">
        <div className="weather-page__section-title weather-page__skeleton-line" />
        <div className="weather-page__hourly-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="weather-page__hour-card glass-card weather-page__skeleton-card" />
          ))}
        </div>
      </div>
      <div className="weather-page__section">
        <div className="weather-page__section-title weather-page__skeleton-line" />
        <div className="weather-page__daily-list">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="weather-page__daily-card glass-card weather-page__skeleton-card" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Weather() {
  const navigate = useNavigate();
  const { panel, isLoading } = useWeatherPanel();

  return (
    <div className="weather-page">
      <header className="weather-page__header">
        <button className="weather-page__back" type="button" onClick={() => navigate('/')}>
          {'<'} Dashboard
        </button>
        <div className="weather-page__header-copy">
          <h1 className="weather-page__title">Hava Durumu Paneli</h1>
          <p className="weather-page__subtitle">
            Saatlik ve gunluk tahmin, yagmur, kar ve ruzgar bilgileri
          </p>
        </div>
      </header>

      {isLoading || !panel ? (
        <WeatherSkeleton />
      ) : (
        <main className="weather-page__content">
          <section className="weather-page__hero glass-card">
            <div className="weather-page__hero-main">
              <span className="weather-page__hero-city">{panel.current.city}</span>
              <strong className="weather-page__hero-temp">{panel.current.temperature}°</strong>
              <span className="weather-page__hero-desc">{panel.current.description}</span>
            </div>
            <div className="weather-page__hero-metrics">
              <div className="weather-page__metric">
                <span className="weather-page__metric-label">Hissedilen</span>
                <span className="weather-page__metric-value">{panel.current.feelsLike}°</span>
              </div>
              <div className="weather-page__metric">
                <span className="weather-page__metric-label">Nem</span>
                <span className="weather-page__metric-value">%{panel.current.humidity}</span>
              </div>
              <div className="weather-page__metric">
                <span className="weather-page__metric-label">Ruzgar</span>
                <span className="weather-page__metric-value">{panel.current.windSpeed} m/s</span>
              </div>
            </div>
          </section>

          <section className="weather-page__section">
            <div className="weather-page__section-head">
              <h2 className="weather-page__section-title">Saatlik Tahmin</h2>
              <span className="weather-page__section-note">3 saatlik adimlarla</span>
            </div>
            <div className="weather-page__hourly-grid">
              {panel.hourly.map((entry) => (
                <article key={entry.time} className="weather-page__hour-card glass-card">
                  <div className="weather-page__hour-top">
                    <span className="weather-page__hour-time">{formatHourLabel(entry.time)}</span>
                    <span className="weather-page__hour-temp">{entry.temperature}°</span>
                  </div>
                  <p className="weather-page__hour-desc">{entry.description}</p>
                  <dl className="weather-page__meta-list">
                    <div className="weather-page__meta-row">
                      <dt>Ruzgar</dt>
                      <dd>{entry.windSpeed} m/s</dd>
                    </div>
                    <div className="weather-page__meta-row">
                      <dt>Yagmur</dt>
                      <dd>{entry.rain} mm</dd>
                    </div>
                    <div className="weather-page__meta-row">
                      <dt>Kar</dt>
                      <dd>{entry.snow} mm</dd>
                    </div>
                    <div className="weather-page__meta-row">
                      <dt>Olasilik</dt>
                      <dd>%{entry.precipitationProbability}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="weather-page__section">
            <div className="weather-page__section-head">
              <h2 className="weather-page__section-title">Gunluk Ozet</h2>
              <span className="weather-page__section-note">Toplanmis tahmin gorunumu</span>
            </div>
            <div className="weather-page__daily-list">
              {panel.daily.map((entry) => (
                <article key={entry.date} className="weather-page__daily-card glass-card">
                  <div className="weather-page__daily-main">
                    <div>
                      <span className="weather-page__daily-label">{entry.label}</span>
                      <span className="weather-page__daily-date">{formatDateLabel(entry.date)}</span>
                    </div>
                    <div className="weather-page__daily-temp">
                      <strong>{entry.maxTemp}°</strong>
                      <span>{entry.minTemp}°</span>
                    </div>
                  </div>
                  <p className="weather-page__daily-desc">{entry.description}</p>
                  <div className="weather-page__daily-metrics">
                    <span>Ruzgar {entry.windSpeed} m/s</span>
                    <span>Yagmur {entry.rain} mm</span>
                    <span>Kar {entry.snow} mm</span>
                    <span>Nem %{entry.humidity}</span>
                    <span>Olasilik %{entry.precipitationProbability}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
