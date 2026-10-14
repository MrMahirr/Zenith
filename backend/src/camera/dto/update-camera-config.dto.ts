import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateCameraConfigDto {
  /** IP/adres (`192.168.1.20`) ya da tam URL (`http://192.168.1.20:4747/video`). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  url: string;
}
