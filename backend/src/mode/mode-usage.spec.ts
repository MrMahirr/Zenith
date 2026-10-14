import { computeModeDurations } from './mode-usage';

const at = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00Z`);

describe('computeModeDurations', () => {
  it('counts time spent in each mode, not the number of changes', () => {
    const result = computeModeDurations(
      [
        { mode: 'CODING', at: at('10:00') },
        { mode: 'FOCUS', at: at('10:30') },
        { mode: 'CODING', at: at('10:40') },
      ],
      'PASSIVE',
      at('09:00'),
      at('11:00'),
    );

    expect(result.PASSIVE).toBe(60 * 60); // 09:00-10:00
    expect(result.CODING).toBe(30 * 60 + 20 * 60); // 10:00-10:30 ve 10:40-11:00
    expect(result.FOCUS).toBe(10 * 60);
    expect(result.RELAX).toBe(0);
  });

  it('uses the mode active at window start when there are no changes', () => {
    const result = computeModeDurations([], 'FOCUS', at('09:00'), at('10:00'));
    expect(result.FOCUS).toBe(3600);
  });

  it('does not invent time before the first known change', () => {
    const result = computeModeDurations(
      [{ mode: 'CODING', at: at('09:30') }],
      null,
      at('09:00'),
      at('10:00'),
    );

    expect(result.CODING).toBe(30 * 60);
    expect(result.PASSIVE).toBe(0);
  });

  it('returns zeros when nothing is known', () => {
    const result = computeModeDurations([], null, at('09:00'), at('10:00'));
    expect(Object.values(result).every((value) => value === 0)).toBe(true);
  });

  it('ignores unknown modes', () => {
    const result = computeModeDurations(
      [{ mode: 'BOGUS', at: at('09:10') }],
      'PASSIVE',
      at('09:00'),
      at('09:20'),
    );

    expect(result.PASSIVE).toBe(10 * 60);
    expect(Object.keys(result)).not.toContain('BOGUS');
  });
});
