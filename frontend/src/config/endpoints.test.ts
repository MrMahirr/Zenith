import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEndpoints } from './endpoints.ts';

const location = { protocol: 'http:', hostname: '192.168.1.5' };

test('derives backend, api and stream urls from the page host', () => {
  assert.deepEqual(buildEndpoints(location), {
    backendUrl: 'http://192.168.1.5:3000',
    apiUrl: 'http://192.168.1.5:3000/api',
    streamUrl: 'http://192.168.1.5:5001',
  });
});

test('keeps the page protocol', () => {
  const result = buildEndpoints({ protocol: 'https:', hostname: 'zenith.local' });
  assert.equal(result.backendUrl, 'https://zenith.local:3000');
});

test('honours port overrides', () => {
  const result = buildEndpoints(location, {
    VITE_BACKEND_PORT: '4000',
    VITE_STREAM_PORT: '6000',
  });

  assert.equal(result.backendUrl, 'http://192.168.1.5:4000');
  assert.equal(result.streamUrl, 'http://192.168.1.5:6000');
});

test('ignores invalid ports', () => {
  const result = buildEndpoints(location, { VITE_BACKEND_PORT: 'abc', VITE_STREAM_PORT: '99999' });

  assert.equal(result.backendUrl, 'http://192.168.1.5:3000');
  assert.equal(result.streamUrl, 'http://192.168.1.5:5001');
});

test('full url overrides win and lose trailing slashes', () => {
  const result = buildEndpoints(location, {
    VITE_BACKEND_URL: 'https://api.example.com/',
    VITE_STREAM_URL: 'https://cam.example.com//',
  });

  assert.equal(result.backendUrl, 'https://api.example.com');
  assert.equal(result.apiUrl, 'https://api.example.com/api');
  assert.equal(result.streamUrl, 'https://cam.example.com');
});
