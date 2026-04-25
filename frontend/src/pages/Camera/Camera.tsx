import { useNavigate } from 'react-router-dom';
import { usePosture } from '../../hooks/usePosture';
import './Camera.css';

export function Camera() {
  const navigate = useNavigate();
  const posture = usePosture();

  return (
    <div className="camera-page">
      <header className="camera-page__header">
        <button className="camera-page__back" onClick={() => navigate('/')} id="camera-back-btn">
          ‹ Dashboard
        </button>
        <h1 className="camera-page__title">📷 Kamera Görüntüsü</h1>
        <div className={`camera-page__status ${posture.isSlouching ? 'camera-page__status--danger' : 'camera-page__status--good'}`}>
          <div className="camera-page__status-dot" />
          <span>{posture.statusText}</span>
        </div>
      </header>

      <main className="camera-page__content">
        <div className="camera-page__feed glass-card">
          <img 
            src={import.meta.env.VITE_CAMERA_URL || "http://192.168.6.28:4747/video"} 
            alt="Kamera Canlı Akış" 
            className="camera-page__video" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              document.getElementById('camera-placeholder')!.style.display = 'block';
            }}
          />
          <div id="camera-placeholder" className="camera-page__placeholder" style={{ display: 'none' }}>
            <span className="camera-page__placeholder-icon">📷</span>
            <p className="camera-page__placeholder-text">
              Kamera akışı şu an alınamıyor.<br />
              Telefonunuzun aynı ağda olduğundan emin olun.
            </p>
            <p className="camera-page__placeholder-sub">
              Denenen IP: <code>{import.meta.env.VITE_CAMERA_URL || "http://192.168.6.28:4747/video"}</code>
            </p>
          </div>
        </div>

        <div className="camera-page__info">
          <div className="camera-page__info-card glass-card">
            <span className="label">Duruş Durumu</span>
            <span className={`camera-page__info-value ${posture.isSlouching ? 'text-danger' : 'text-success'}`}>
              {posture.statusText}
            </span>
          </div>
          <div className="camera-page__info-card glass-card">
            <span className="label">Omuz-Burun Mesafesi</span>
            <span className="camera-page__info-value mono">
              {posture.distance > 0 ? posture.distance.toFixed(3) : '--'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
