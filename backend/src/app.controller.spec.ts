import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { ServiceRegistry } from './status/service-registry.service';

describe('AppController health', () => {
  const registry = new ServiceRegistry();
  registry.register('socket-1', 'camera');

  it('reports ok with connected services', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ 1: 1 }]) } as unknown as DataSource;
    const controller = new AppController(dataSource, registry);

    const body = await controller.getHealth();

    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.services).toEqual({ camera: true, sensor: false, nfc: false, led: false });
  });

  it('answers 503 when the database is unreachable', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('down')),
    } as unknown as DataSource;
    const controller = new AppController(dataSource, registry);

    await expect(controller.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
