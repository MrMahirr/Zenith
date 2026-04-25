import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  feelsLike: number;
  updatedAt: Date;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private cache: WeatherData | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 dakika

  constructor(private readonly configService: ConfigService) {}

  /** Hava durumu verisini getir (cache'li) */
  async getWeather(): Promise<WeatherData> {
    const now = Date.now();

    // Cache hala geçerliyse cache'den dön
    if (this.cache && now - this.lastFetchTime < this.CACHE_DURATION) {
      return this.cache;
    }

    const apiKey = this.configService.get<string>('WEATHER_API_KEY');
    const city = this.configService.get<string>('WEATHER_CITY', 'Izmir');
    const lang = this.configService.get<string>('WEATHER_LANG', 'tr');
    const units = this.configService.get<string>('WEATHER_UNITS', 'metric');

    // API key yoksa mock veri döndür
    if (!apiKey) {
      this.logger.warn('WEATHER_API_KEY tanımlı değil – mock veri döndürülüyor');
      return this.getMockWeather(city);
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${units}&lang=${lang}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API yanıt hatası: ${response.status}`);
      }

      const data = await response.json();

      this.cache = {
        city: data.name,
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        humidity: data.main.humidity,
        feelsLike: Math.round(data.main.feels_like),
        updatedAt: new Date(),
      };

      this.lastFetchTime = now;
      this.logger.log(`Hava durumu güncellendi: ${this.cache.city} ${this.cache.temperature}°C`);
      return this.cache;
    } catch (error) {
      this.logger.error(`Hava durumu API hatası: ${error}`);
      // Eski cache varsa onu döndür, yoksa mock
      return this.cache ?? this.getMockWeather(city);
    }
  }

  /** API key olmadığında kullanılacak mock veri */
  private getMockWeather(city: string): WeatherData {
    return {
      city,
      temperature: 22,
      description: 'Güneşli',
      icon: '01d',
      humidity: 45,
      feelsLike: 23,
      updatedAt: new Date(),
    };
  }
}
