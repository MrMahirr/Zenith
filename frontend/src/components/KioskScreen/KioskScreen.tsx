import { useEffect, useState } from 'react';
import { useKioskPrefs } from '../../hooks/useKioskPrefs';
import { useSocket } from '../../hooks/useSocket';
import { isNightTime } from '../../kiosk/kioskPrefs';
import './KioskScreen.css';

const WAKE_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;
const CLOCK_TICK_MS = 30_000;

const formatClock = (date: Date) =>
  date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

/**
 * Ekran koruyucu: belirli süre dokunulmazsa tam ekran, loş bir saat gösterir.
 * Dokunma/tuş ya da yeni bir kambur duruş uyarısı ekranı uyandırır.
 */
function IdleScreen({ idleMinutes }: { idleMinutes: number }) {
  const socket = useSocket();
  const [idle, setIdle] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), idleMinutes * 60_000);
    };
    const wake = () => {
      setIdle(false);
      arm();
    };
    const wakeOnSlouch = (payload: { isSlouching?: boolean }) => {
      if (payload?.isSlouching) wake();
    };

    WAKE_EVENTS.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    socket.on('posture_update', wakeOnSlouch);
    const clock = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    arm();

    return () => {
      clearTimeout(timer);
      clearInterval(clock);
      WAKE_EVENTS.forEach((name) => window.removeEventListener(name, wake));
      socket.off('posture_update', wakeOnSlouch);
    };
  }, [idleMinutes, socket]);

  if (!idle) return null;

  return (
    <div className="kiosk-idle" role="presentation">
      <span className="kiosk-idle__clock">{formatClock(now)}</span>
    </div>
  );
}

/** Geceleri ekranı karartan, dokunmaları engellemeyen katman. */
function NightDim() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (!isNightTime(now)) return null;

  return <div className="kiosk-night" aria-hidden="true" />;
}

/** Kiosk deneyimi katmanları: ekran koruyucu ve gece modu (Ayarlar'dan açılır). */
export function KioskScreen() {
  const { prefs } = useKioskPrefs();

  return (
    <>
      {prefs.nightMode && <NightDim />}
      {prefs.idleMinutes > 0 && <IdleScreen idleMinutes={prefs.idleMinutes} />}
    </>
  );
}
