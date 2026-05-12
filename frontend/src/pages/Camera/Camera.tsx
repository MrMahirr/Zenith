import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosture } from '../../hooks/usePosture';
import './Camera.css';

interface Preset {
  value: number;
  label: string;
}

// Kameranın yerel çözünürlüğüne göre orantılı akıllı presetler üreten yardımcı fonksiyon
const getResolutionPresets = (nativeW: number): Preset[] => {
  if (nativeW <= 640) {
    return [
      { value: 240, label: '240p' },
      { value: 320, label: '320p' },
      { value: nativeW, label: `${nativeW}p` },
    ];
  }
  if (nativeW <= 1280) {
    return [
      { value: 360, label: '360p' },
      { value: 540, label: '540p' },
      { value: nativeW, label: '720p' },
    ];
  }
  if (nativeW <= 1920) {
    return [
      { value: 360, label: '360p' },
      { value: 540, label: '540p' },
      { value: 720, label: '720p' },
      { value: nativeW, label: '1080p' },
    ];
  }
  // 2K ve daha yüksek çözünürlükler için
  return [
    { value: 480, label: '480p' },
    { value: 720, label: '720p' },
    { value: 1080, label: '1080p' },
    { value: nativeW, label: 'Orijinal (2K+)' },
  ];
};

export function Camera() {
  const navigate = useNavigate();
  const posture = usePosture();
  const [streamActive, setStreamActive] = useState(false);

  // Kameranın yerel fiziksel çözünürlük state'leri
  const [nativeWidth, setNativeWidth] = useState<number>(320);
  const [nativeHeight, setNativeHeight] = useState<number>(240);
  const [hasLoadedNative, setHasLoadedNative] = useState<boolean>(false);

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

  // Kameranın gerçek çözünürlüğünü otomatik algıla
  useEffect(() => {
    fetch(`http://${window.location.hostname}:5001/camera_info`)
      .then((res) => res.json())
      .then((data) => {
        if (data.width && data.height) {
          setNativeWidth(data.width);
          setNativeHeight(data.height);
          setHasLoadedNative(true);

          // Eğer depolanmış bir genişlik yoksa veya depolanan genişlik kameranın güncel
          // çözünürlüğü ile uyumsuz ise orta seviye orantılı bir varsayılan seçelim.
          const saved = localStorage.getItem('camera_width');
          const presets = getResolutionPresets(data.width);
          const matched = presets.some(p => p.value === Number(saved));

          if (!saved || !matched) {
            const midIndex = Math.floor(presets.length / 2);
            const defaultVal = presets[midIndex].value;
            setWidth(defaultVal);
            localStorage.setItem('camera_width', String(defaultVal));
          }
        }
      })
      .catch((err) => console.error('Kamera yerel çözünürlük bilgisi alınamadı:', err));
  }, []);

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

  // Mevcut çözünürlük presetleri listesi
  const resolutionPresets = getResolutionPresets(nativeWidth);

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
            <div className="camera-page__settings-header">
              <span className="label">Yayin Cozunurlugu</span>
              {hasLoadedNative && (
                <span className="camera-page__native-badge">
                  Yerel: {nativeWidth}x{nativeHeight}
                </span>
              )}
            </div>
            
            <div className="camera-page__settings-buttons">
              {resolutionPresets.map((preset) => (
                <button 
                  key={preset.value}
                  className={`settings-btn ${width === preset.value ? 'active' : ''}`}
                  onClick={() => handleWidthChange(preset.value)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
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
