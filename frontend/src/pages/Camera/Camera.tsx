import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosture } from '../../hooks/usePosture';
import { useSocket } from '../../hooks/useSocket';
import './Camera.css';

export function Camera() {
  const navigate = useNavigate();
  const posture = usePosture();
  const socket = useSocket();
  const [frame, setFrame] = useState<string | null>(null);

  useEffect(() => {
    const handleFrame = (b64: string) => {
      setFrame(`data:image/jpeg;base64,${b64}`);
    };
    
    socket.on('camera_frame', handleFrame);
    return () => {
      socket.off('camera_frame', handleFrame);
    };
  }, [socket]);

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
          {frame ? (
            <img 
              src={frame} 
              alt="Kamera Canlı Akış" 
              className="camera-page__video" 
            />
          ) : (
            <div className="camera-page__placeholder">
              <span className="camera-page__placeholder-icon">🤖</span>
              <p className="camera-page__placeholder-text">
                Yapay Zeka (Python) kameraya bağlanıyor...<br />
                Lütfen bekleyin. (Görüntü işlenerek buraya aktarılacak)
              </p>
            </div>
          )}
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
