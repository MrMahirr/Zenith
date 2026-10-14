import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MODE_NAMES } from '../../mode/mode.constants';

export class RegisterChipDto {
  /** Kullanıcının verdiği etiket (ör. "Kodlama Kartım"). */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  /** Çipin tetikleyeceği mod. */
  @IsIn(MODE_NAMES)
  assignedMode: string;
}
