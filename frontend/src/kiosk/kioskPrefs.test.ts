import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_KIOSK_PREFS, isNightTime, parseKioskPrefs } from './kioskPrefs.ts';

const at = (hour: number) => new Date(2026, 9, 14, hour, 30);

test('night window wraps around midnight', () => {
  assert.equal(isNightTime(at(22)), true);
  assert.equal(isNightTime(at(23)), true);
  assert.equal(isNightTime(at(0)), true);
  assert.equal(isNightTime(at(6)), true);
  assert.equal(isNightTime(at(7)), false);
  assert.equal(isNightTime(at(12)), false);
  assert.equal(isNightTime(at(21)), false);
});

test('a same-day window works too', () => {
  assert.equal(isNightTime(at(13), 12, 14), true);
  assert.equal(isNightTime(at(15), 12, 14), false);
});

test('parseKioskPrefs reads valid values', () => {
  assert.deepEqual(parseKioskPrefs('{"idleMinutes":10,"nightMode":true}'), {
    idleMinutes: 10,
    nightMode: true,
  });
});

test('parseKioskPrefs falls back for missing or invalid data', () => {
  assert.deepEqual(parseKioskPrefs(null), DEFAULT_KIOSK_PREFS);
  assert.deepEqual(parseKioskPrefs('not json'), DEFAULT_KIOSK_PREFS);
  assert.deepEqual(parseKioskPrefs('{"idleMinutes":7,"nightMode":"yes"}'), DEFAULT_KIOSK_PREFS);
});

test('defaults keep both features off', () => {
  assert.equal(DEFAULT_KIOSK_PREFS.idleMinutes, 0);
  assert.equal(DEFAULT_KIOSK_PREFS.nightMode, false);
});
