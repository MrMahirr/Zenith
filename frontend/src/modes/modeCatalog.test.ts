import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MODE_ORDER,
  fallbackCatalog,
  hexToGlow,
  isModeName,
  mergeModeConfig,
} from './modeCatalog.ts';

test('fallback catalog covers every mode with color, label and icon', () => {
  const catalog = fallbackCatalog();

  for (const mode of MODE_ORDER) {
    assert.equal(catalog[mode].mode, mode);
    assert.match(catalog[mode].color, /^#[0-9A-F]{6}$/i);
    assert.ok(catalog[mode].label.length > 0);
    assert.ok(catalog[mode].icon.length > 0);
  }
});

test('backend values override the fallback', () => {
  const catalog = mergeModeConfig([
    { mode: 'CODING', name: 'Kodlama Modu', label: 'Kod', color: '#112233' },
  ]);

  assert.equal(catalog.CODING.label, 'Kod');
  assert.equal(catalog.CODING.color, '#112233');
  assert.equal(catalog.CODING.glow, 'rgba(17, 34, 51, 0.15)');
  // dokunulmayan mod yedekte kalir
  assert.equal(catalog.FOCUS.label, 'Odak');
});

test('bad entries fall back field by field', () => {
  const catalog = mergeModeConfig([
    { mode: 'RELAX', label: '   ', color: 'turuncu' },
    { mode: 'UNKNOWN', label: 'x', color: '#000000' },
    null,
    'garbage',
  ]);

  assert.equal(catalog.RELAX.label, 'Relax');
  assert.equal(catalog.RELAX.color, '#F59E0B');
  assert.equal(Object.keys(catalog).length, MODE_ORDER.length);
});

test('non-array responses return the fallback', () => {
  assert.deepEqual(mergeModeConfig(null), fallbackCatalog());
  assert.deepEqual(mergeModeConfig({ mode: 'CODING' }), fallbackCatalog());
});

test('isModeName and hexToGlow validate input', () => {
  assert.equal(isModeName('FOCUS'), true);
  assert.equal(isModeName('focus'), false);
  assert.equal(isModeName(42), false);

  assert.equal(hexToGlow('#FF0000', 0.5), 'rgba(255, 0, 0, 0.5)');
  assert.equal(hexToGlow('nope'), 'rgba(148, 163, 184, 0.15)');
});
