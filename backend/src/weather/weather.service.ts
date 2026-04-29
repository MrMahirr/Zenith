import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DailyForecastEntry,
  HourlyForecastEntry,
  WeatherData,
  WeatherPanelData,
} from './weather.types';

interface ForecastListItem {
  dt: number;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  pop?: number;
  rain?: {
    ['3h']?: number;
  };
  snow?: {
    ['3h']?: number;
  };
}

interface CurrentWeatherApiResponse {
  name: string;
  main: {
    temp: number;
    humidity: number;
    feels_like: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind?: {
    speed?: number;
  };
}

interface ForecastApiResponse {
  city?: {
    name?: string;
  };
  list: ForecastListItem[];
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private currentCache: WeatherData | null = null;
  private panelCache: WeatherPanelData | null = null;
  private lastFetchTime = 0;
  private readonly cacheDuration = 30 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {}

  async getCurrentWeather(): Promise<WeatherData> {
    const panel = await this.getWeatherPanel();
    return panel.current;
  }

  async getWeatherPanel(): Promise<WeatherPanelData> {
    const now = Date.now();

    if (
      this.panelCache &&
      now - this.lastFetchTime < this.cacheDuration
    ) {
      return this.panelCache;
    }

    const apiKey = this.configService.get<string>('WEATHER_API_KEY');
    const city = this.configService.get<string>('WEATHER_CITY', 'Izmir');
    const lang = this.configService.get<string>('WEATHER_LANG', 'tr');
    const units = this.configService.get<string>('WEATHER_UNITS', 'metric');

    if (!apiKey) {
      this.logger.warn('WEATHER_API_KEY not set; returning mock weather panel');
      const mock = this.getMockWeatherPanel(city);
      this.currentCache = mock.current;
      this.panelCache = mock;
      this.lastFetchTime = now;
      return mock;
    }

    try {
      const currentUrl =
        `https://api.openweathermap.org/data/2.5/weather?q=${city}` +
        `&appid=${apiKey}&units=${units}&lang=${lang}`;
      const forecastUrl =
        `https://api.openweathermap.org/data/2.5/forecast?q=${city}` +
        `&appid=${apiKey}&units=${units}&lang=${lang}`;

      const [currentResponse, forecastResponse] = await Promise.all([
        this.fetchJson<CurrentWeatherApiResponse>(currentUrl),
        this.fetchJson<ForecastApiResponse>(forecastUrl),
      ]);

      const panel = this.buildWeatherPanel(
        currentResponse,
        forecastResponse,
        city,
      );

      this.currentCache = panel.current;
      this.panelCache = panel;
      this.lastFetchTime = now;
      this.logger.log(
        `Weather panel updated: ${panel.current.city} ${panel.current.temperature}C`,
      );
      return panel;
    } catch (error) {
      this.logger.error(`Weather API error: ${error}`);
      return this.panelCache ?? this.getMockWeatherPanel(city);
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private buildWeatherPanel(
    currentData: CurrentWeatherApiResponse,
    forecastData: ForecastApiResponse,
    fallbackCity: string,
  ): WeatherPanelData {
    const city = currentData.name || forecastData.city?.name || fallbackCity;
    const current: WeatherData = {
      city,
      temperature: Math.round(currentData.main.temp),
      description: currentData.weather[0]?.description ?? 'Bilinmiyor',
      icon: currentData.weather[0]?.icon ?? '01d',
      humidity: currentData.main.humidity,
      feelsLike: Math.round(currentData.main.feels_like),
      windSpeed: this.roundValue(currentData.wind?.speed ?? 0),
      updatedAt: new Date(),
    };

    const hourly = forecastData.list.slice(0, 8).map((entry) =>
      this.mapHourlyEntry(entry),
    );
    const daily = this.buildDailyForecast(forecastData.list);

    return {
      current,
      hourly,
      daily,
    };
  }

  private mapHourlyEntry(entry: ForecastListItem): HourlyForecastEntry {
    return {
      time: new Date(entry.dt * 1000).toISOString(),
      temperature: Math.round(entry.main.temp),
      feelsLike: Math.round(entry.main.feels_like),
      description: entry.weather[0]?.description ?? 'Bilinmiyor',
      icon: entry.weather[0]?.icon ?? '01d',
      humidity: entry.main.humidity,
      windSpeed: this.roundValue(entry.wind.speed),
      rain: this.roundValue(entry.rain?.['3h'] ?? 0),
      snow: this.roundValue(entry.snow?.['3h'] ?? 0),
      precipitationProbability: Math.round((entry.pop ?? 0) * 100),
    };
  }

  private buildDailyForecast(list: ForecastListItem[]): DailyForecastEntry[] {
    const grouped = new Map<string, ForecastListItem[]>();

    for (const entry of list) {
      const dateKey = new Date(entry.dt * 1000).toISOString().slice(0, 10);
      const group = grouped.get(dateKey) ?? [];
      group.push(entry);
      grouped.set(dateKey, group);
    }

    return Array.from(grouped.entries())
      .slice(0, 5)
      .map(([dateKey, entries], index) => {
        const temps = entries.map((entry) => entry.main.temp);
        const humidities = entries.map((entry) => entry.main.humidity);
        const winds = entries.map((entry) => entry.wind.speed);
        const rain = entries.reduce(
          (total, entry) => total + (entry.rain?.['3h'] ?? 0),
          0,
        );
        const snow = entries.reduce(
          (total, entry) => total + (entry.snow?.['3h'] ?? 0),
          0,
        );
        const precipitationProbability = Math.max(
          ...entries.map((entry) => Math.round((entry.pop ?? 0) * 100)),
          0,
        );
        const representative = entries[Math.floor(entries.length / 2)] ?? entries[0];

        return {
          date: new Date(entries[0].dt * 1000).toISOString(),
          label: index === 0 ? 'Bugun' : this.formatDayLabel(dateKey),
          minTemp: Math.round(Math.min(...temps)),
          maxTemp: Math.round(Math.max(...temps)),
          description: representative.weather[0]?.description ?? 'Bilinmiyor',
          icon: representative.weather[0]?.icon ?? '01d',
          humidity: Math.round(
            humidities.reduce((sum, value) => sum + value, 0) / humidities.length,
          ),
          windSpeed: this.roundValue(Math.max(...winds)),
          rain: this.roundValue(rain),
          snow: this.roundValue(snow),
          precipitationProbability,
        };
      });
  }

  private formatDayLabel(dateKey: string) {
    return new Intl.DateTimeFormat('tr-TR', {
      weekday: 'short',
    }).format(new Date(`${dateKey}T12:00:00`));
  }

  private roundValue(value: number) {
    return Math.round(value * 10) / 10;
  }

  private getMockWeatherPanel(city: string): WeatherPanelData {
    const now = new Date();
    const current: WeatherData = {
      city,
      temperature: 22,
      description: 'Acik',
      icon: '01d',
      humidity: 45,
      feelsLike: 23,
      windSpeed: 3.2,
      updatedAt: now,
    };

    const hourly = Array.from({ length: 8 }, (_, index) => ({
      time: new Date(now.getTime() + index * 3 * 60 * 60 * 1000).toISOString(),
      temperature: 22 + ((index % 3) - 1),
      feelsLike: 23 + ((index % 3) - 1),
      description: index % 4 === 2 ? 'Yagmurlu' : 'Parcali bulutlu',
      icon: index % 4 === 2 ? '10d' : '02d',
      humidity: 40 + index * 3,
      windSpeed: this.roundValue(2.5 + index * 0.4),
      rain: index % 4 === 2 ? 1.4 : 0,
      snow: 0,
      precipitationProbability: index % 4 === 2 ? 65 : 10,
    }));

    const daily = Array.from({ length: 5 }, (_, index) => ({
      date: new Date(now.getTime() + index * 24 * 60 * 60 * 1000).toISOString(),
      label:
        index === 0
          ? 'Bugun'
          : this.formatDayLabel(
              new Date(now.getTime() + index * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10),
            ),
      minTemp: 18 + index,
      maxTemp: 25 + index,
      description: index === 2 ? 'Karla karisik yagmur' : 'Parcali bulutlu',
      icon: index === 2 ? '13d' : '03d',
      humidity: 50 + index * 4,
      windSpeed: this.roundValue(3 + index * 0.6),
      rain: index === 1 ? 3.2 : 0.4,
      snow: index === 2 ? 1.8 : 0,
      precipitationProbability: index === 1 || index === 2 ? 70 : 20,
    }));

    return {
      current,
      hourly,
      daily,
    };
  }
}
