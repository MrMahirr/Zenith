import { useState, useEffect } from 'react';

/** Saat ve tarih bilgisini yöneten hook */
export function useClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((prev) => {
        const now = new Date();
        // Sadece saniye değiştiğinde state'i güncelleyerek gereksiz ara render tetiklenmelerini %100 önlüyoruz.
        if (prev.getSeconds() === now.getSeconds()) return prev;
        return now;
      });
    }, 250); // 250ms hassasiyeti ile kaymayı (drift) önler, ama saniyede yalnızca 1 kez state günceller.
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
