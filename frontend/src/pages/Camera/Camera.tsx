import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosture } from '../../hooks/usePosture';
import './Camera.css';

export function Camera() {
  const navigate = useNavigate();
  const posture = usePosture();
  const [streamActive, setStreamActive] = useState(false);
  const streamUrl = `http://${window.location.hostname}:5001/video_feed`;

  const statusClass = !posture.isActive
    ? 'camera-page__status--inactive'
    : posture.isSlouching
      ? 'camera-page__status--danger'
      : 'camera-page__status--good';

  const valueClass = !posture.isActive
    ? 'text-muted'
    : posture.isSlouching
      ? 'text-danger'
      : 'text-success';

  return (
    <div className="camera-page">
      <header className="camera-page__header">
        <button className="camera-page__back" onClick={() => navigate('/')} id="camera-back-btn">
          {'<'} Dashboard
        </button>
        <h1 className="camera-page__title">Kamera Goruntusu</h1>
        <div className={`camera-page__status ${statusClass}`}>
          <div className="camera-page__status-dot" />
          <span>{posture.statusText}</span>
        </div>
      </header>

      <main className="camera-page__content">
        <div className="camera-page__feed glass-card">
          <img
            src={streamUrl}
            alt="Kamera Canli Akis"
            className="camera-page__video"
            style={{ display: streamActive ? 'block' : 'none' }}
            onLoad={() => setStreamActive(true)}
            onError={() => setStreamActive(false)}
          />
          {!streamActive && (
            <div className="camera-page__placeholder">
              <span className="camera-page__placeholder-icon">[]</span>
              <p className="camera-page__placeholder-text">
                Kamera baglantisi bekleniyor...
                <br />
                Goruntu geldikten sonra burada gosterilecek.
              </p>
            </div>
          )}
        </div>

        <div className="camera-page__info">
          <div className="camera-page__info-card glass-card">
            <span className="label">Durus Durumu</span>
            <span className={`camera-page__info-value ${valueClass}`}>
              {posture.statusText}
            </span>
          </div>
          <div className="camera-page__info-card glass-card">
            <span className="label">Omuz-Burun Mesafesi</span>
            <span className="camera-page__info-value mono">
              {posture.isActive && posture.distance > 0 ? posture.distance.toFixed(3) : '--'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
