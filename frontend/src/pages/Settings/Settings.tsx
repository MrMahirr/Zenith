import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKioskPrefs } from '../../hooks/useKioskPrefs';
import { usePreferences } from '../../hooks/usePreferences';
import type { Preferences, PreferencesView } from '../../hooks/usePreferences';
import { IDLE_OPTIONS, NIGHT_END_HOUR, NIGHT_START_HOUR } from '../../kiosk/kioskPrefs';
import './Settings.css';

const INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 120, 300];

const formatIdle = (minutes: number) => (minutes === 0 ? 'Kapalı' : `${minutes} dk`);

const formatInterval = (seconds: number) =>
  seconds < 60 ? `${seconds} sn` : `${seconds / 60} dk`;

const samePreferences = (a: Preferences, b: Preferences) =>
  a.postureThreshold === b.postureThreshold &&
  a.sensorIntervalSeconds === b.sensorIntervalSeconds &&
  a.weatherCity === b.weatherCity;

interface SystemFormProps {
  view: PreferencesView;
  onSave: (values: Preferences) => Promise<PreferencesView>;
}

/** Sistem tercihleri formu; sunucudaki değerlerle başlar, "Kaydet" ile uygulanır. */
function SystemForm({ view, onSave }: SystemFormProps) {
  const { defaults, limits } = view;
  const [saved, setSaved] = useState<Preferences>(view.values);
  const [draft, setDraft] = useState<Preferences>(view.values);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const threshold = draft.postureThreshold ?? defaults.postureThreshold;
  const interval = draft.sensorIntervalSeconds ?? defaults.sensorIntervalSeconds;
  const intervalOptions = INTERVAL_OPTIONS.includes(interval)
    ? INTERVAL_OPTIONS
    : [...INTERVAL_OPTIONS, interval].sort((a, b) => a - b);
  const dirty = !samePreferences(draft, saved);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !dirty) return;

    setBusy(true);
    setFeedback(null);
    try {
      const next = await onSave(draft);
      setSaved(next.values);
      setDraft(next.values);
      setFeedback({ ok: true, text: 'Kaydedildi ve uygulandı.' });
    } catch (error) {
      setFeedback({ ok: false, text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="settings__form" onSubmit={handleSubmit}>
      <div className="settings__field">
        <div className="settings__field-head">
          <label htmlFor="setting-threshold">Duruş hassasiyeti</label>
          <span className="settings__value mono">{threshold.toFixed(2)}</span>
        </div>
        <input
          id="setting-threshold"
          type="range"
          min={limits.postureThreshold.min}
          max={limits.postureThreshold.max}
          step={0.01}
          value={threshold}
          onChange={(event) =>
            setDraft({ ...draft, postureThreshold: Number(event.target.value) })
          }
          className="settings__slider"
        />
        <p className="settings__hint">
          Yüksek değer, kambur uyarısını daha erken verir. Varsayılan: {defaults.postureThreshold}.
        </p>
        {draft.postureThreshold !== null && (
          <button
            type="button"
            className="settings-btn settings__reset"
            onClick={() => setDraft({ ...draft, postureThreshold: null })}
          >
            Varsayılana dön
          </button>
        )}
      </div>

      <div className="settings__field">
        <div className="settings__field-head">
          <label htmlFor="setting-interval">Sensör okuma aralığı</label>
          <span className="settings__value mono">{formatInterval(interval)}</span>
        </div>
        <select
          id="setting-interval"
          className="settings__select"
          value={interval}
          onChange={(event) =>
            setDraft({ ...draft, sensorIntervalSeconds: Number(event.target.value) })
          }
        >
          {intervalOptions.map((seconds) => (
            <option key={seconds} value={seconds}>
              {formatInterval(seconds)}
            </option>
          ))}
        </select>
        {draft.sensorIntervalSeconds !== null && (
          <button
            type="button"
            className="settings-btn settings__reset"
            onClick={() => setDraft({ ...draft, sensorIntervalSeconds: null })}
          >
            Varsayılana dön ({formatInterval(defaults.sensorIntervalSeconds)})
          </button>
        )}
      </div>

      <div className="settings__field">
        <div className="settings__field-head">
          <label htmlFor="setting-city">Hava durumu şehri</label>
        </div>
        <input
          id="setting-city"
          type="text"
          className="settings__input"
          value={draft.weatherCity ?? ''}
          placeholder={defaults.weatherCity}
          maxLength={limits.weatherCity.maxLength}
          autoComplete="off"
          onChange={(event) =>
            setDraft({ ...draft, weatherCity: event.target.value.trim() ? event.target.value : null })
          }
        />
        <p className="settings__hint">Boş bırakılırsa varsayılan şehir ({defaults.weatherCity}) kullanılır.</p>
      </div>

      <div className="settings__actions">
        <button type="submit" className="settings-btn active" disabled={busy || !dirty}>
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {feedback && (
          <span
            className={feedback.ok ? 'settings__ok' : 'settings__error'}
            role={feedback.ok ? 'status' : 'alert'}
          >
            {feedback.text}
          </span>
        )}
      </div>
    </form>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { view, error, save } = usePreferences();
  const { prefs, update } = useKioskPrefs();

  return (
    <div className="settings">
      <header className="settings__header">
        <button className="settings__back" onClick={() => navigate('/')} type="button">
          {'<'} Dashboard
        </button>
        <h1 className="settings__title">⚙️ Ayarlar</h1>
      </header>

      <main className="settings__grid">
        <section className="settings__card glass-card">
          <h2 className="settings__card-title">Sistem</h2>
          {view ? (
            <SystemForm view={view} onSave={save} />
          ) : (
            <p className="settings__hint">
              {error ? `Ayarlar yüklenemedi: ${error}` : 'Yükleniyor…'}
            </p>
          )}
        </section>

        <section className="settings__card glass-card">
          <h2 className="settings__card-title">Ekran (bu cihaz)</h2>

          <div className="settings__field">
            <div className="settings__field-head">
              <label htmlFor="setting-idle">Ekran koruyucu</label>
            </div>
            <div className="settings__choices" id="setting-idle">
              {IDLE_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={`settings-btn ${prefs.idleMinutes === minutes ? 'active' : ''}`}
                  onClick={() => update({ idleMinutes: minutes })}
                >
                  {formatIdle(minutes)}
                </button>
              ))}
            </div>
            <p className="settings__hint">
              Belirtilen süre dokunulmazsa loş bir saat gösterilir; dokununca ya da kambur
              uyarısında uyanır.
            </p>
          </div>

          <label className="settings__toggle" htmlFor="setting-night">
            <span>
              <span className="settings__toggle-title">Gece modu</span>
              <span className="settings__hint">
                {NIGHT_START_HOUR}:00 – {String(NIGHT_END_HOUR).padStart(2, '0')}:00 arasında
                ekranı karartır.
              </span>
            </span>
            <input
              id="setting-night"
              type="checkbox"
              className="settings__switch"
              checked={prefs.nightMode}
              onChange={(event) => update({ nightMode: event.target.checked })}
            />
          </label>

          <p className="settings__hint settings__note">
            LED sayısı gibi donanım ayarları <code>ai-service/.env</code> dosyasından değişir ve
            servisin yeniden başlatılmasını gerektirir.
          </p>
        </section>
      </main>
    </div>
  );
}
