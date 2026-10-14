import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ServiceRegistry } from './status/service-registry.service';

@Controller()
export class AppController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly serviceRegistry: ServiceRegistry,
  ) {}

  /**
   * Sağlık kontrolü. Veritabanı yanıt vermiyorsa 503 döner; böylece
   * ai-service ve deploy betiği backend'i "hazır" saymaz. AI servislerinin
   * bağlı olup olmadığı bilgi amaçlıdır ve durumu etkilemez.
   */
  @Get('health')
  async getHealth() {
    let database = 'ok';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      database = 'error';
    }

    const body = {
      status: database === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database,
      services: this.serviceRegistry.snapshot(),
    };

    if (database !== 'ok') {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
