import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PREFERENCE_LIMITS } from '../preferences.service';

/** Harf, boşluk ve `. , ' -` içeren şehir adları (Unicode harfler dahil). */
const CITY_PATTERN = /^[\p{L}\p{M}\s.,'’-]+$/u;

/**
 * Kısmi güncelleme. `null` gönderilen alan sıfırlanır (varsayılana döner);
 * hiç gönderilmeyen alana dokunulmaz. `@IsOptional` hem `null` hem `undefined`
 * için doğrulamayı atlar.
 */
export class UpdatePreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(PREFERENCE_LIMITS.postureThreshold.min)
  @Max(PREFERENCE_LIMITS.postureThreshold.max)
  postureThreshold?: number | null;

  @IsOptional()
  @IsInt()
  @Min(PREFERENCE_LIMITS.sensorIntervalSeconds.min)
  @Max(PREFERENCE_LIMITS.sensorIntervalSeconds.max)
  sensorIntervalSeconds?: number | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(PREFERENCE_LIMITS.weatherCity.maxLength)
  @Matches(CITY_PATTERN, { message: 'weatherCity yalnızca harf, boşluk ve . , \' - içerebilir' })
  weatherCity?: string | null;
}
