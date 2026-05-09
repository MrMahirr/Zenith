import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLed } from '../../hooks/useLed';
import './LedControl.css';

// 24 premium renk paleti
const PRESET_COLORS = [
  '#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFFF00', '#9ACD32', '#32CD32', '#00FF00',
  '#00FA9A', '#00FFFF', '#00BFFF', '#1E90FF', '#0000FF', '#8A2BE2', '#9400D3', '#FF00FF',
  '#FF1493', '#FF69B4', '#FFB6C1', '#FFFFFF', '#FFDAB9', '#E6E6FA', '#D3D3D3', '#808080'
];

export function LedControl() {
  const navigate = useNavigate();
  const { state, setManual, setAuto, turnOff, setBrightness } = useLed();
  
  // Yerel state'ler (slider sürüklerken anında tepki için)
  const [localColor, setLocalColor] = useState(state.color);
  const [localBrightness, setLocalBrightness] = useState(state.brightness);

  // Backend'den state güncellendiğinde yerel state'i güncelle (sadece manuel modda değilsek veya ilk yüklemede)
  useEffect(() => {
    setLocalColor(state.color === '#000000' && state.mode === 'manual' ? localColor : state.color);
    setLocalBrightness(state.brightness);
  }, [state.color, state.brightness, state.mode]); // localColor'u dependency array'e eklemeyin, aksi takdirde renk seçimi bozulabilir

  const handleColorClick = (color: string) => {
    setLocalColor(color);
    if (state.mode === 'auto') {
      setManual(color, localBrightness);
    } else {
      setManual(color, localBrightness);
    }
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setLocalBrightness(val);
  };

  const handleBrightnessChangeEnd = () => {
    if (state.mode === 'manual') {
      if (!state.isOn && localBrightness === 0) return;
      setManual(localColor, localBrightness);
    } else if (state.mode === 'auto') {
      setBrightness(localBrightness);
    }
  };

  const handlePowerToggle = () => {
    if (state.isOn && state.mode === 'manual') {
      turnOff();
    } else {
      // Eğer renk siyahsa, default bir renk ile aç
      const colorToSet = localColor === '#000000' || localColor === '#000' ? '#FFFFFF' : localColor;
      setLocalColor(colorToSet);
      setManual(colorToSet, localBrightness > 0 ? localBrightness : 128);
    }
  };

  // Hex color to RGB for box-shadow
  const getGlowColor = (hex: string, opacity: number) => {
    if (hex === '#000000' || hex === '#000') return 'transparent';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return (
    <div className="led-control">
      <header className="led-control__header">
        <div className="led-control__header-left">
          <button className="led-control__back" onClick={() => navigate('/')}>
            {'<'} Dashboard
          </button>
          <h1 className="led-control__title">💡 LED Kontrol</h1>
        </div>
        <div className="led-control__mode-toggle">
          <button
            className={`led-control__mode-btn ${state.mode === 'auto' ? 'led-control__mode-btn--active' : ''}`}
            onClick={setAuto}
          >
            Otomatik
          </button>
          <button
            className={`led-control__mode-btn ${state.mode === 'manual' ? 'led-control__mode-btn--active' : ''}`}
            onClick={() => setManual(localColor, localBrightness)}
          >
            Manuel
          </button>
        </div>
      </header>

      <main className="led-control__main">
        <div className="led-control__card glass-card">
          <h2 className="led-control__card-title">Renk Paleti</h2>
          <div className="led-control__color-grid">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`led-control__color-btn ${localColor === c ? 'led-control__color-btn--active' : ''}`}
                style={{ 
                  backgroundColor: c,
                  boxShadow: localColor === c ? `0 0 12px ${getGlowColor(c, 0.8)}` : 'none'
                }}
                onClick={() => handleColorClick(c)}
              />
            ))}
          </div>
        </div>

        <div className="led-control__card glass-card">
          <h2 className="led-control__card-title">Ayarlar</h2>
          <div className="led-control__controls">
            
            <div className="led-control__brightness">
              <div className="led-control__slider-row">
                <span style={{ fontSize: '16px' }}>🔅</span>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={localBrightness}
                  onChange={handleBrightnessChange}
                  onMouseUp={handleBrightnessChangeEnd}
                  onTouchEnd={handleBrightnessChangeEnd}
                  className="led-control__slider"
                  style={{
                    background: `linear-gradient(to right, #4B5563 ${((localBrightness) / 255) * 100}%, #1F2937 ${((localBrightness) / 255) * 100}%)`
                  }}
                />
                <span style={{ fontSize: '20px' }}>🔆</span>
                <span className="led-control__slider-val">{Math.round((localBrightness / 255) * 100)}%</span>
              </div>
            </div>

            <button
              className={`led-control__power-btn ${state.isOn && state.mode === 'manual' ? 'led-control__power-btn--off' : 'led-control__power-btn--on'}`}
              onClick={handlePowerToggle}
              disabled={state.mode === 'auto'}
            >
              {state.isOn && state.mode === 'manual' ? '🔌 Söndür' : '💡 Aç'}
            </button>
          </div>
        </div>
      </main>

      <div 
        className="led-control__preview-bar"
        style={{
          backgroundColor: state.isOn && state.mode === 'manual' ? localColor : (state.isOn ? state.color : '#000000'),
          opacity: state.isOn ? (state.mode === 'manual' ? localBrightness / 255 : state.brightness / 255) : 0.1,
          boxShadow: state.isOn ? `0 0 20px ${getGlowColor(state.mode === 'manual' ? localColor : state.color, 0.5)}` : 'none',
        }}
      />
    </div>
  );
}
