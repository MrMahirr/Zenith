import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config';

/** Kullanıcının değiştirebildiği sistem tercihleri; `null` = varsayılan. */
export interface Preferences {
  postureThreshold: number | null;
  sensorIntervalSeconds: number | null;
  weatherCity: string | null;
  displayBrightness: number | null;
  displayNightBrightness: number | null;
  mq135CleanVoltage: number | null;
}

export interface PreferencesView {
  values: Preferences;
  defaults: {
    postureThreshold: number;
    sensorIntervalSeconds: number;
    weatherCity: string;
    displayBrightness: number;
  };
  limits: {
    postureThreshold: { min: number; max: number };
    sensorIntervalSeconds: { min: number; max: number };
    weatherCity: { maxLength: number };
    displayBrightness: { min: number; max: number };
    displayNightBrightness: { min: number; max: number };
    mq135CleanVoltage: { min: number; max: number };
  };
}

async function request(
  method: 'GET' | 'PUT',
  body?: Partial<Preferences>,
): Promise<PreferencesView> {
  const response = await fetch(`${API_URL}/preferences`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = 'İşlem başarısız oldu.';
    try {
      const data = await response.json();
      const detail = Array.isArray(data.message) ? data.message[0] : data.message;
      if (typeof detail === 'string' && detail) message = detail;
    } catch {
      // gövde JSON değilse varsayılan mesaj
    }
    throw new Error(message);
  }

  return response.json();
}

/** Sistem tercihlerini okur ve kaydeder. */
export function usePreferences() {
  const [view, setView] = useState<PreferencesView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    request('GET')
      .then((data) => {
        if (!cancelled) setView(data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Verilen alanları kaydeder (gönderilmeyen alanlara dokunulmaz, `null` sıfırlar). */
  const save = useCallback(async (values: Partial<Preferences>) => {
    const next = await request('PUT', values);
    setView(next);
    return next;
  }, []);

  /** Sunucudaki güncel değerleri yeniden okur (ör. kalibrasyon sonrası). */
  const refresh = useCallback(async () => {
    const next = await request('GET');
    setView(next);
    return next;
  }, []);

  return { view, error, save, refresh };
}
