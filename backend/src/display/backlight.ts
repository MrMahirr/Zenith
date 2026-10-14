import * as fs from 'node:fs';
import * as path from 'node:path';

/** Ekran arka ışığı için donanım soyutlaması (test edilebilirlik için). */
export interface BacklightDriver {
  /** Cihaz bulunduysa `{ value, max }` döner; yoksa `null`. */
  read(): { value: number; max: number } | null;
  write(value: number): void;
}

/**
 * Linux `/sys/class/backlight/*` üzerinden arka ışık.
 * Resmi Raspberry Pi 7" ekranı `10-0045` adıyla görünür ve `video` grubu yazabilir.
 */
export class SysfsBacklight implements BacklightDriver {
  constructor(
    private readonly root: string = process.env.BACKLIGHT_DIR ?? '/sys/class/backlight',
  ) {}

  private findDevice(): string | null {
    try {
      for (const entry of fs.readdirSync(this.root)) {
        const dir = path.join(this.root, entry);
        if (
          fs.existsSync(path.join(dir, 'brightness')) &&
          fs.existsSync(path.join(dir, 'max_brightness'))
        ) {
          return dir;
        }
      }
    } catch {
      // dizin yok (Windows/gelistirme makinesi)
    }
    return null;
  }

  read() {
    const dir = this.findDevice();
    if (!dir) return null;

    try {
      const value = Number(fs.readFileSync(path.join(dir, 'brightness'), 'utf8').trim());
      const max = Number(fs.readFileSync(path.join(dir, 'max_brightness'), 'utf8').trim());
      return Number.isFinite(value) && Number.isFinite(max) && max > 0 ? { value, max } : null;
    } catch {
      return null;
    }
  }

  write(value: number) {
    const dir = this.findDevice();
    if (!dir) {
      throw new Error('Arka ışık aygıtı bulunamadı');
    }
    fs.writeFileSync(path.join(dir, 'brightness'), String(value));
  }
}
