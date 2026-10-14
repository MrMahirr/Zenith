import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SERVICE_NAMES, ServiceName } from '../gateway/events';
import { ServiceRegistry } from '../status/service-registry.service';
import { DisplayService, DisplayView } from '../display/display.service';
import { HardwareDevice } from './hardware-payload';

interface ServiceReport {
  devices: Map<string, HardwareDevice>;
  updatedAt: string;
}

export interface HardwareSnapshot {
  generatedAt: string;
  services: Record<
    ServiceName,
    { connected: boolean; updatedAt: string | null; devices: HardwareDevice[] }
  >;
  display: DisplayView;
}

/**
 * Cihaz sağlık raporları.
 *
 * AI servisleri (sensör, NFC, LED, kamera) kendi donanımlarını raporlar; bu
 * servis son durumu bellekte tutar. Bir servis yalnızca raporladığı cihazları
 * günceller (kamera tek cihaz, sensör beş cihaz gönderir).
 */
@Injectable()
export class HardwareService {
  private readonly reports = new Map<ServiceName, ServiceReport>();
  private readonly changedSubject = new Subject<void>();
  private readonly calibrateSubject = new Subject<void>();
  private readonly postureCalibrateSubject = new Subject<void>();

  /** Rapor içeriği değiştiğinde (yalnızca gerçek değişimde) tetiklenir. */
  readonly changed$: Observable<void> = this.changedSubject.asObservable();

  /** MQ135 kalibrasyon isteği; gateway sensör servisine iletir. */
  readonly calibrateRequested$: Observable<void> = this.calibrateSubject.asObservable();

  /** Postür kalibrasyon isteği; gateway kamera servisine iletir. */
  readonly postureCalibrateRequested$: Observable<void> =
    this.postureCalibrateSubject.asObservable();

  constructor(
    private readonly registry: ServiceRegistry,
    private readonly display: DisplayService,
  ) {}

  /** Cihaz satırlarını birleştirir; içerik değiştiyse `true` döner. */
  report(service: ServiceName, devices: HardwareDevice[]): boolean {
    const current = this.reports.get(service) ?? {
      devices: new Map<string, HardwareDevice>(),
      updatedAt: new Date().toISOString(),
    };

    let changed = false;
    for (const next of devices) {
      const previous = current.devices.get(next.id);
      if (
        !previous ||
        previous.state !== next.state ||
        previous.detail !== next.detail ||
        previous.name !== next.name
      ) {
        current.devices.set(next.id, next);
        changed = true;
      }
    }

    current.updatedAt = new Date().toISOString();
    this.reports.set(service, current);

    if (changed) {
      this.changedSubject.next();
    }
    return changed;
  }

  /** Servis ayrılınca/bağlanınca arayüzün güncellenmesi için. */
  notifyConnectionChanged() {
    this.changedSubject.next();
  }

  snapshot(): HardwareSnapshot {
    const connected = this.registry.snapshot();

    const services = Object.fromEntries(
      SERVICE_NAMES.map((name) => {
        const report = this.reports.get(name);
        return [
          name,
          {
            connected: connected[name],
            updatedAt: report?.updatedAt ?? null,
            devices: report ? [...report.devices.values()] : [],
          },
        ];
      }),
    ) as HardwareSnapshot['services'];

    return {
      generatedAt: new Date().toISOString(),
      services,
      display: this.display.getView(),
    };
  }

  /** Kamera servisinden dik oturuş kalibrasyonu ister. */
  requestPostureCalibration(): boolean {
    if (!this.registry.snapshot().camera) {
      return false;
    }
    this.postureCalibrateSubject.next();
    return true;
  }

  /** Sensör servisinden temiz hava kalibrasyonu ister. */
  requestMq135Calibration(): boolean {
    if (!this.registry.snapshot().sensor) {
      return false;
    }
    this.calibrateSubject.next();
    return true;
  }
}
