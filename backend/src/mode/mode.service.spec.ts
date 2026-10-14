import { DataSource } from 'typeorm';
import { ModeService } from './mode.service';

type Row = Record<string, unknown>;

/** `query()` çağrılarını kaydeden ve verilen yanıtları sırayla dönen sahte DataSource. */
function fakeDataSource(responses: Row[][] = []) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const queue = [...responses];

  const dataSource = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return queue.shift() ?? [];
    }),
  };

  return { dataSource: dataSource as unknown as DataSource, calls };
}

describe('ModeService', () => {
  it('starts as PASSIVE when there is no history', async () => {
    const { dataSource } = fakeDataSource([[]]);
    const service = new ModeService(dataSource);

    await service.onModuleInit();

    expect(service.getCurrentMode().mode).toBe('PASSIVE');
  });

  it('restores the last recorded mode after a restart', async () => {
    const { dataSource } = fakeDataSource([[{ mode: 'FOCUS' }]]);
    const service = new ModeService(dataSource);

    await service.onModuleInit();

    expect(service.getCurrentMode().mode).toBe('FOCUS');
  });

  it('ignores a corrupt last mode', async () => {
    const { dataSource } = fakeDataSource([[{ mode: 'NOT_A_MODE' }]]);
    const service = new ModeService(dataSource);

    await service.onModuleInit();

    expect(service.getCurrentMode().mode).toBe('PASSIVE');
  });

  it('records a valid change and rejects an invalid one', async () => {
    const { dataSource, calls } = fakeDataSource();
    const service = new ModeService(dataSource);

    const ok = await service.changeMode('CODING');
    const bad = await service.changeMode('NOPE');

    expect(ok?.mode).toBe('CODING');
    expect(bad).toBeNull();
    expect(service.getCurrentMode().mode).toBe('CODING');
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('INSERT INTO mode_changes');
  });

  it('exposes every mode in the shared config', () => {
    const { dataSource } = fakeDataSource();
    const config = new ModeService(dataSource).getConfig();

    expect(config.map((entry) => entry.mode).sort()).toEqual(
      ['CODING', 'FOCUS', 'MEETING', 'PASSIVE', 'RELAX'].sort(),
    );
    expect(config.every((entry) => /^#[0-9A-F]{6}$/i.test(entry.color))).toBe(true);
  });

  it('reports usage in minutes using the mode active at window start', async () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const { dataSource } = fakeDataSource([
      [{ mode: 'PASSIVE' }], // pencere öncesi son kayıt
      [
        { mode: 'CODING', createdAt: '2026-10-14 10:00:00' },
        { mode: 'FOCUS', createdAt: '2026-10-14 11:00:00' },
      ],
    ]);
    const service = new ModeService(dataSource);

    const stats = await service.getUsageStats(4, now); // 08:00-12:00

    expect(stats.PASSIVE).toBe(120); // 08:00-10:00
    expect(stats.CODING).toBe(60);
    expect(stats.FOCUS).toBe(60);
    expect(stats.MEETING).toBe(0);
  });
});
