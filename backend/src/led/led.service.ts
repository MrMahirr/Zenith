import { Injectable, Logger } from '@nestjs/common';

export interface LedState {
  color: string;
  brightness: number;
  isOn: boolean;
  mode: 'manual' | 'auto';
}

@Injectable()
export class LedService {
  private readonly logger = new Logger(LedService.name);
  
  private state: LedState = {
    color: '#000000',
    brightness: 128,
    isOn: false,
    mode: 'auto',
  };

  /** Manuel LED kontrolünü aktif eder */
  setManual(color: string, brightness: number): LedState {
    this.state = {
      ...this.state,
      color,
      brightness,
      isOn: true,
      mode: 'manual',
    };
    this.logger.log(`[LED] Manual Mode: Color=${color}, Brightness=${brightness}`);
    return this.state;
  }

  /** Otomatik moda geri döner (duruş uyarıları vb. tekrar devreye girer) */
  setAuto(): LedState {
    this.state.mode = 'auto';
    this.logger.log(`[LED] Auto Mode Activated`);
    return this.state;
  }

  /** LED'i söndürür (manuel modda kalır veya otomatik olabilir, manuel kalsın) */
  turnOff(): LedState {
    this.state = {
      ...this.state,
      isOn: false,
      mode: 'manual',
    };
    this.logger.log(`[LED] Turned Off`);
    return this.state;
  }

  /** Sadece parlaklığı günceller (otomatik mod dahil olmak üzere) */
  setBrightness(brightness: number): LedState {
    this.state = {
      ...this.state,
      brightness,
    };
    this.logger.log(`[LED] Brightness Updated: ${brightness}`);
    return this.state;
  }

  /** Mevcut durumu döndürür */
  getState(): LedState {
    return this.state;
  }
}
