import { useState } from 'react';
import type { FormEvent } from 'react';
import { useCameraConfig } from '../../../hooks/useCameraConfig';
import type { CameraConnectionStatus } from '../../../hooks/useCameraConfig';
import './CameraAddressCard.css';

type View = 'hidden' | 'loading' | 'editing';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

const STATUS_LABELS: Record<CameraConnectionStatus, string> = {
  connected: 'Bağlı',
  disconnected: 'Bağlantı yok',
  unknown: 'Bilinmiyor',
};

/**
 * Kamera adresini değiştirme kartı.
 *
 * Adres varsayılan olarak gizlidir; kullanıcı "Göster / Değiştir"e basana kadar
 * ne yüklenir ne de ekranda görünür. Kaydetme, sıfırlama ya da gizleme sonrası
 * alan temizlenir ve tekrar gizlenir.
 */
export function CameraAddressCard() {
  const { status, fetchUrl, saveUrl, resetUrl } = useCameraConfig();
  const [view, setView] = useState<View>('hidden');
  const [value, setValue] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const hide = () => {
    setView('hidden');
    setValue('');
  };

  const handleReveal = async () => {
    setFeedback(null);
    setView('loading');

    try {
      const url = await fetchUrl();
      setConfigured(url !== null);
      setValue(url ?? '');
      setView('editing');
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
      setView('hidden');
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setFeedback(null);

    try {
      await saveUrl(value);
      setFeedback({
        type: 'success',
        text: 'Adres kaydedildi. Kamera yeni adrese bağlanıyor…',
      });
      hide();
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setFeedback(null);

    try {
      await resetUrl();
      setFeedback({
        type: 'success',
        text: 'Varsayılan kamera adreslerine dönüldü.',
      });
      hide();
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="camera-address glass-card" id="camera-address-card">
      <div className="camera-address__header">
        <span className="label">Kamera Adresi</span>
        <span className={`camera-address__status camera-address__status--${status}`}>
          <span className="camera-address__status-dot" />
          {STATUS_LABELS[status]}
        </span>
      </div>

      {view === 'hidden' && (
        <>
          <p className="camera-address__hint">Güvenlik için adres gizli tutulur.</p>
          <button
            type="button"
            className="settings-btn camera-address__toggle"
            onClick={handleReveal}
            id="camera-address-reveal-btn"
          >
            Göster / Değiştir
          </button>
        </>
      )}

      {view === 'loading' && <p className="camera-address__hint">Yükleniyor…</p>}

      {view === 'editing' && (
        <form className="camera-address__form" onSubmit={handleSave}>
          <input
            className="camera-address__input"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="192.168.1.20 veya http://192.168.1.20:4747/video"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
            disabled={busy}
            id="camera-address-input"
          />
          <p className="camera-address__hint">
            Yalnızca IP girerseniz port 4747 ve /video yolu otomatik eklenir.
          </p>

          <div className="camera-address__actions">
            <button
              type="submit"
              className="settings-btn active"
              disabled={busy || value.trim() === ''}
              id="camera-address-save-btn"
            >
              Kaydet
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={handleReset}
              disabled={busy || !configured}
              id="camera-address-reset-btn"
            >
              Varsayılana dön
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={hide}
              disabled={busy}
              id="camera-address-hide-btn"
            >
              Gizle
            </button>
          </div>
        </form>
      )}

      {feedback && (
        <p
          className={`camera-address__feedback camera-address__feedback--${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
