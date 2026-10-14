import { normalizeCameraUrl } from './camera-url';

describe('normalizeCameraUrl', () => {
  it('adds default port and path to a bare IP', () => {
    expect(normalizeCameraUrl('192.168.6.28')).toBe(
      'http://192.168.6.28:4747/video',
    );
  });

  it('keeps an explicit port and adds the default path', () => {
    expect(normalizeCameraUrl('192.168.6.28:8080')).toBe(
      'http://192.168.6.28:8080/video',
    );
  });

  it('keeps a custom path on a bare address', () => {
    expect(normalizeCameraUrl('10.0.0.5:4747/mjpegfeed')).toBe(
      'http://10.0.0.5:4747/mjpegfeed',
    );
  });

  it('does not alter a full URL', () => {
    expect(normalizeCameraUrl('http://192.168.6.28:4747/video')).toBe(
      'http://192.168.6.28:4747/video',
    );
    expect(normalizeCameraUrl('https://cam.local/stream')).toBe(
      'https://cam.local/stream',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeCameraUrl('  192.168.1.2  ')).toBe(
      'http://192.168.1.2:4747/video',
    );
  });

  it.each([
    '',
    '   ',
    'ftp://192.168.1.2/video',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://',
    'not a url',
    'http://exa mple.com',
  ])('rejects %p', (value) => {
    expect(normalizeCameraUrl(value)).toBeNull();
  });
});
