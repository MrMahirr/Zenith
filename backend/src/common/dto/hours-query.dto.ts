import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Geçmiş sorguları için `?hours=` parametresi (varsayılan 24, en fazla 30 gün). */
export class HoursQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  hours: number = 24;
}
