import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosture } from '../../hooks/usePosture';
import './Camera.css';

export function Camera() {
  const navigate = useNavigate();
  const posture = usePosture();
  const [streamActive, setStreamActive] = useState(false);

  // Yerel depolama desteğiyle ayar durumları
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem('camera_width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [fps, setFps] = useState<number>(() => {
    const saved = localStorage.getItem('camera_fps');
    return saved ? parseInt(saved, 10) : 15;
  });
  const [quality, setQuality] = useState<number>(() => {
    const saved = localStorage.getItem('camera_quality');
    return saved ? parseInt(saved, 10) : 30;
  });

  const handleWidthChange = (w: number) => {
    setWidth(w);
    localStorage.setItem('camera_width', String(w));
  };

  const handleFpsChange = (f: number) => {
    setFps(f);
    localStorage.setItem('camera_fps', String(f));
  };

  const handleQualityChange = (q: number) => {
    setQuality(q);
    localStorage.setItem('camera_quality', String(q));
  };

  // Ayarlar değiştiğinde yükleniyor animasyonunu geçici olarak tekrar tetikleyerek akıcılığı koruyalım
  useEffect(() => {
    setStreamActive(false);
  }, [width, fps, quality]);

  // Dinamik parametreli yayın adresi
  const streamUrl = `http://${window.location.hostname}:5001/video_feed?width=${width}&fps=${fps}&quality=${quality}`;

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
        <h1 className="camera-page__title">Kamera Yayini</h1>
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
              <span className="camera-page__placeholder-icon">📹</span>
              <p className="camera-page__placeholder-text">
                Kamera bağlantısı yapılandırılıyor...
                <br />
                Görüntü seçtiğiniz ayarlara göre yükleniyor.
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

          <div className="camera-page__info-card glass-card camera-page__settings-card">
            <span className="label">Yayin Cozunurlugu</span>
            <div className="camera-page__settings-buttons">
              <button 
                className={`settings-btn ${width === 240 ? 'active' : ''}`}
                onClick={() => handleWidthChange(240)}
                type="button"
              >
                240p
              </button>
              <button 
                className={`settings-btn ${width === 320 ? 'active' : ''}`}
                onClick={() => handleWidthChange(320)}
                type="button"
              >
                320p
              </button>
              <button 
                className={`settings-btn ${width === 480 ? 'active' : ''}`}
                onClick={() => handleWidthChange(480)}
                type="button"
              >
                480p
              </button>
            </div>
            
            <span className="label mt-12">Kare Hizi (FPS)</span>
            <div className="camera-page__settings-buttons">
              {[5, 10, 15, 20].map((f) => (
                <button 
                  key={f}
                  className={`settings-btn ${fps === f ? 'active' : ''}`}
                  onClick={() => handleFpsChange(f)}
                  type="button"
                >
                  {f}
                </button>
              ))}
            </div>

            <span className="label mt-12">Yayin Kalitesi</span>
            <div className="camera-page__settings-buttons">
              {[15, 30, 50, 80].map((q) => (
                <button 
                  key={q}
                  className={`settings-btn ${quality === q ? 'active' : ''}`}
                  onClick={() => handleQualityChange(q)}
                  type="button"
                >
                  %{q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

