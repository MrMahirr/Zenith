import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';
import { useHardware } from '../../hooks/useHardware';
import { useKioskPrefs } from '../../hooks/useKioskPrefs';
import { usePreferences } from '../../hooks/usePreferences';
import type { Preferences, PreferencesView } from '../../hooks/usePreferences';
import {
  SERVICE_LABELS,
  SERVICE_ORDER,
  serviceState,
  type HardwareSnapshot,
} from '../../hardware/hardwareStatus';
import { IDLE_OPTIONS, NIGHT_END_HOUR, NIGHT_START_HOUR } from '../../kiosk/kioskPrefs';
import './Settings.css';

const INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 120, 300];
const DEFAULT_NIGHT_BRIGHTNESS = 20;
/** Kalibrasyon sensörde ~10 sn sürer; sonucu bu kadar sonra yeniden oku. */
const CALIBRATION_REFRESH_MS = 14_000;
const POSTURE_CALIBRATION_REFRESH_MS = 12_000;

const formatIdle = (minutes: number) => (minutes === 0 ? 'Kapalı' : `${minutes} dk`);

const formatInterval = (seconds: number) =>
  seconds < 60 ? `${seconds} sn` : `${seconds / 60} dk`;

const SYSTEM_KEYS = [
  'postureThreshold',
  'sensorIntervalSeconds',
  'weatherCity',
  'displayBrightness',
  'displayNightBrightness',
] as const;

type SystemValues = Pick<Preferences, (typeof SYSTEM_KEYS)[number]>;

const pickSystem = (values: Preferences): SystemValues => ({
  postureThreshold: values.postureThreshold,
  sensorIntervalSeconds: values.sensorIntervalSeconds,
  weatherCity: values.weatherCity,
  displayBrightness: values.displayBrightness,
  displayNightBrightness: values.displayNightBrightness,
});

const sameSystem = (a: SystemValues, b: SystemValues) =>
  SYSTEM_KEYS.every((key) => a[key] === b[key]);

interface SystemFormProps {
  view: PreferencesView;
  displayAvailable: boolean;
  onSave: (values: SystemValues) => Promise<PreferencesView>;
}

/** Sistem tercihleri formu; sunucudaki değerlerle başlar, "Kaydet" ile uygulanır. */
function SystemForm({ view, displayAvailable, onSave }: SystemFormProps) {
  const { defaults, limits } = view;
  const [saved, setSaved] = useState<SystemValues>(pickSystem(view.values));
  const [draft, setDraft] = useState<SystemValues>(pickSystem(view.values));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const threshold = draft.postureThreshold ?? defaults.postureThreshold;
  const interval = draft.sensorIntervalSeconds ?? defaults.sensorIntervalSeconds;
  const dayBrightness = draft.displayBrightness ?? defaults.displayBrightness;
  const intervalOptions = INTERVAL_OPTIONS.includes(interval)
    ? INTERVAL_OPTIONS
    : [...INTERVAL_OPTIONS, interval].sort((a, b) => a - b);
  const dirty = !sameSystem(draft, saved);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !dirty) return;

    setBusy(true);
    setFeedback(null);
    try {
      const next = await onSave(draft);
      const values = pickSystem(next.values);
      setSaved(values);
      setDraft(values);
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

      <div className="settings__field">
        <div className="settings__field-head">
          <label htmlFor="setting-brightness">Ekran parlaklığı</label>
          <span className="settings__value mono">
            {displayAvailable ? `%${dayBrightness}` : '—'}
          </span>
        </div>
        {displayAvailable ? (
          <>
            <input
              id="setting-brightness"
              type="range"
              min={limits.displayBrightness.min}
              max={limits.displayBrightness.max}
              step={5}
              value={dayBrightness}
              onChange={(event) =>
                setDraft({ ...draft, displayBrightness: Number(event.target.value) })
              }
              className="settings__slider"
            />

            <label className="settings__inline-toggle" htmlFor="setting-night-brightness">
              <input
                id="setting-night-brightness"
                type="checkbox"
                checked={draft.displayNightBrightness !== null}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    displayNightBrightness: event.target.checked ? DEFAULT_NIGHT_BRIGHTNESS : null,
                  })
                }
              />
              <span>
                Gece ({NIGHT_START_HOUR}:00–{String(NIGHT_END_HOUR).padStart(2, '0')}:00) daha loş
              </span>
            </label>

            {draft.displayNightBrightness !== null && (
              <>
                <input
                  type="range"
                  aria-label="Gece parlaklığı"
                  min={limits.displayNightBrightness.min}
                  max={limits.displayNightBrightness.max}
                  step={5}
                  value={draft.displayNightBrightness}
                  onChange={(event) =>
                    setDraft({ ...draft, displayNightBrightness: Number(event.target.value) })
                  }
                  className="settings__slider"
                />
                <p className="settings__hint">Gece parlaklığı: %{draft.displayNightBrightness}</p>
              </>
            )}
          </>
        ) : (
          <p className="settings__hint">
            Bu cihazın ekranı yazılımla ayarlanamıyor (arka ışık aygıtı bulunamadı).
          </p>
        )}
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

interface PostureCalibrationProps {
  threshold: number | null;
  onCalibrated: () => void;
}

/** Kullanıcı dik otururken kişiye özel kambur eşiğini ölçtürür. */
function PostureCalibration({ threshold, onCalibrated }: PostureCalibrationProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const start = async () => {
    setMessage(null);
    setBusy(true);

    try {
      const response = await fetch(`${API_URL}/hardware/posture/calibrate`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.message === 'string' ? data.message : 'Kalibrasyon başlatılamadı.');
      }

      setMessage({ ok: true, text: 'Kameraya dönük, dik oturun ve kıpırdamayın…' });
      timer.current = setTimeout(() => {
        setBusy(false);
        setMessage({
          ok: true,
          text: 'Tamamlandıysa eşik güncellendi; değişmediyse omuzlarınız kadrajda görünmüyordu.',
        });
        onCalibrated();
      }, POSTURE_CALIBRATION_REFRESH_MS);
    } catch (error) {
      setBusy(false);
      setMessage({ ok: false, text: (error as Error).message });
    }
  };

  return (
    <div className="settings__field">
      <div className="settings__field-head">
        <span>Dik oturuşa göre kalibrasyon</span>
        <span className="settings__value mono">
          {threshold === null ? 'yok' : threshold.toFixed(2)}
        </span>
      </div>
      <p className="settings__hint">
        Kameranın önünde dik oturup düğmeye basın; eşik, oturuşunuza göre otomatik ayarlanır.
      </p>
      <div className="settings__choices">
        <button type="button" className="settings-btn" onClick={start} disabled={busy}>
          {busy ? 'Ölçülüyor…' : 'Dik otur ve kalibre et'}
        </button>
      </div>
      {message && (
        <span
          className={message.ok ? 'settings__ok' : 'settings__error'}
          role={message.ok ? 'status' : 'alert'}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}

interface HardwareCardProps {
  snapshot: HardwareSnapshot | null;
  cleanVoltage: number | null;
  onCalibrated: () => void;
  onClearCalibration: () => Promise<void>;
}

/** Cihaz durumları + MQ135 kalibrasyonu. */
function HardwareCard({ snapshot, cleanVoltage, onCalibrated, onClearCalibration }: HardwareCardProps) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const startCalibration = async () => {
    setMessage(null);
    setCalibrating(true);

    try {
      const response = await fetch(`${API_URL}/hardware/mq135/calibrate`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.message === 'string' ? data.message : 'Kalibrasyon başlatılamadı.');
      }

      setMessage({ ok: true, text: 'Ölçüm alınıyor (~10 sn)…' });
      timer.current = setTimeout(() => {
        setCalibrating(false);
        setMessage({ ok: true, text: 'Kalibrasyon istendi; sonuç aşağıda görünür.' });
        onCalibrated();
      }, CALIBRATION_REFRESH_MS);
    } catch (error) {
      setCalibrating(false);
      setMessage({ ok: false, text: (error as Error).message });
    }
  };

  const clearCalibration = async () => {
    setMessage(null);
    try {
      await onClearCalibration();
      setMessage({ ok: true, text: 'Kalibrasyon silindi; eski ölçek kullanılacak.' });
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    }
  };

  return (
    <section className="settings__card glass-card">
      <h2 className="settings__card-title">Donanım durumu</h2>

      {!snapshot && <p className="settings__hint">Yükleniyor…</p>}

      {snapshot &&
        SERVICE_ORDER.map((service) => {
          const entry = snapshot.services[service];
          const state = serviceState(entry);
          return (
            <div className="hw-group" key={service}>
              <div className="hw-group__head">
                <span className={`hw-dot hw-dot--${state}`} />
                <span className="hw-group__name">{SERVICE_LABELS[service]}</span>
                {!entry.connected && <span className="hw-group__note">servis bağlı değil</span>}
              </div>
              {entry.connected &&
                entry.devices.map((device) => (
                  <div className="hw-device" key={device.id}>
                    <span className={`hw-dot hw-dot--${device.state}`} />
                    <div className="hw-device__text">
                      <span className="hw-device__name">{device.name}</span>
                      {device.detail && <span className="hw-device__detail">{device.detail}</span>}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}

      <div className="hw-calibration">
        <div className="settings__field-head">
          <span>MQ135 kalibrasyonu</span>
          <span className="settings__value mono">
            {cleanVoltage === null ? 'yok' : `${cleanVoltage.toFixed(2)} V`}
          </span>
        </div>
        <p className="settings__hint">
          Sensör en az 10 dakika ısındıktan sonra, temiz havada kalibre edin. Kalibrasyonla hava
          kalitesi, o anki havaya göre göreli bir indekse dönüşür.
        </p>
        <div className="settings__choices">
          <button
            type="button"
            className="settings-btn"
            onClick={startCalibration}
            disabled={calibrating}
          >
            {calibrating ? 'Kalibre ediliyor…' : 'Temiz havada kalibre et'}
          </button>
          {cleanVoltage !== null && (
            <button type="button" className="settings-btn" onClick={clearCalibration}>
              Kalibrasyonu sil
            </button>
          )}
        </div>
        {message && (
          <span
            className={message.ok ? 'settings__ok' : 'settings__error'}
            role={message.ok ? 'status' : 'alert'}
          >
            {message.text}
          </span>
        )}
      </div>
    </section>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { view, error, save, refresh } = usePreferences();
  const { prefs, update } = useKioskPrefs();
  const hardware = useHardware();

  return (
    <div className="settings">
      <header className="settings__header">
        <button className="settings__back" onClick={() => navigate('/')} type="button">
          {'<'} Dashboard
        </button>
        <h1 className="settings__title">⚙️ Ayarlar</h1>
      </header>

      <main className="settings__grid">
        <div className="settings__column">
          <section className="settings__card glass-card">
            <h2 className="settings__card-title">Sistem</h2>
            {view ? (
              <SystemForm
                view={view}
                displayAvailable={hardware?.display.available ?? false}
                onSave={save}
              />
            ) : (
              <p className="settings__hint">
                {error ? `Ayarlar yüklenemedi: ${error}` : 'Yükleniyor…'}
              </p>
            )}
          </section>
        </div>

        <div className="settings__column">
          <HardwareCard
            snapshot={hardware}
            cleanVoltage={view?.values.mq135CleanVoltage ?? null}
            onCalibrated={() => void refresh()}
            onClearCalibration={async () => {
              await save({ mq135CleanVoltage: null });
            }}
          />

          <section className="settings__card glass-card">
            <h2 className="settings__card-title">Duruş</h2>
            <PostureCalibration
              threshold={view?.values.postureThreshold ?? null}
              onCalibrated={() => void refresh()}
            />
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
              LED sayısı ve güç sınırı gibi donanım ayarları <code>ai-service/.env</code> dosyasından
              değişir ve servisin yeniden başlatılmasını gerektirir.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
