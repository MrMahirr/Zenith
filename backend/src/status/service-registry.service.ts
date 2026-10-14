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

  /** Her bilinen servis için bağlı mı bilgisi. */
  snapshot(): Record<ServiceName, boolean> {
    const connected = new Set(this.socketToService.values());
    return Object.fromEntries(
      SERVICE_NAMES.map((name) => [name, connected.has(name)]),
    ) as Record<ServiceName, boolean>;
  }
}
