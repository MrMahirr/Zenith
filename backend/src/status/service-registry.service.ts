import { Injectable } from '@nestjs/common';
import { SERVICE_NAMES, ServiceName } from '../gateway/events';

/**
 * Bağlı AI servislerinin kaydı. Servisler socket el sıkışmasında kendilerini
 * (`auth.service`) tanıtır; sağlık uç noktası buradan okur.
 */
@Injectable()
export class ServiceRegistry {
  private readonly socketToService = new Map<string, ServiceName>();

  register(socketId: string, service: ServiceName) {
    this.socketToService.set(socketId, service);
  }

  unregister(socketId: string) {
    this.socketToService.delete(socketId);
  }

  /** Bu soketin hangi AI servisine ait olduğu (el sıkışmada bildirilen ad). */
  serviceOf(socketId: string): ServiceName | null {
    return this.socketToService.get(socketId) ?? null;
  }

  /** Her bilinen servis için bağlı mı bilgisi. */
  snapshot(): Record<ServiceName, boolean> {
    const connected = new Set(this.socketToService.values());
    return Object.fromEntries(
      SERVICE_NAMES.map((name) => [name, connected.has(name)]),
    ) as Record<ServiceName, boolean>;
  }
}
