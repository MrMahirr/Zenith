export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  feelsLike: number;
  windSpeed: number;
  updatedAt: Date;
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
