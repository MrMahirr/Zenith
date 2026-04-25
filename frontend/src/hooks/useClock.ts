import { useState, useEffect } from 'react';

/** Saat ve tarih bilgisini yöneten hook */
export function useClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedSeconds = time.toLocaleTimeString('tr-TR', {
    second: '2-digit',
  }).slice(-2);

  const formattedDate = time.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return { time, formattedTime, formattedSeconds, formattedDate };
}
