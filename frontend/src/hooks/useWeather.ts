import { useEffect, useState } from 'react';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3000/api`;

export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  feelsLike: number;
  windSpeed: number;
}

export interface HourlyForecastEntry {
  time: string;
  temperature: number;
  feelsLike: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  rain: number;
  snow: number;
  precipitationProbability: number;
}

export interface DailyForecastEntry {
  date: string;
  label: string;
  minTemp: number;
  maxTemp: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  rain: number;
  snow: number;
  precipitationProbability: number;
}

export interface WeatherPanelData {
  current: WeatherData;
  hourly: HourlyForecastEntry[];
  daily: DailyForecastEntry[];
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`${API_URL}/weather`);
        const data = await res.json();
        setWeather(data);
      } catch (err) {
        console.error('Hava durumu alinamadi:', err);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return weather;
}

export function useWeatherPanel() {
  const [panel, setPanel] = useState<WeatherPanelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPanel = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/weather/panel`);
        const data = await res.json();
        setPanel(data);
      } catch (err) {
        console.error('Hava durumu paneli alinamadi:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPanel();
    const interval = setInterval(fetchPanel, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { panel, isLoading };
}
