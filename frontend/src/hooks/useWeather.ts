import { useState, useEffect } from 'react';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3000/api`;

export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  feelsLike: number;
}

/** Hava durumu verisini REST API'den çeken hook */
export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`${API_URL}/weather`);
        const data = await res.json();
        setWeather(data);
      } catch (err) {
        console.error('Hava durumu alınamadı:', err);
      }
    };

    fetchWeather();
    // Her 30 dakikada bir güncelle
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return weather;
}
