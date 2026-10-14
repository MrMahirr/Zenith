const DEFAULT_PORT = '4747';
const DEFAULT_PATH = '/video';

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Kullanıcının girdiği kamera adresini tam bir MJPEG URL'sine çevirir.
 *
 * - Yalnızca adres/IP girilirse (`192.168.1.20` ya da `192.168.1.20:8080`)
 *   eksik port için 4747 ve yol için `/video` (DroidCam varsayılanları) eklenir.
 * - `http://` ya da `https://` ile tam adres girilirse olduğu gibi korunur.
 *
 * Geçersiz girdide (boş, http/https dışı şema, bozuk adres) `null` döner.
 */
export function normalizeCameraUrl(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) {
    return null;
  }

  const hasScheme = HAS_SCHEME.test(raw);

  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? raw : `http://${raw}`);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  if (!parsed.hostname) {
    return null;
  }

  if (!hasScheme) {
    if (!parsed.port) {
      parsed.port = DEFAULT_PORT;
    }
    if (parsed.pathname === '/') {
      parsed.pathname = DEFAULT_PATH;
    }
  }

  return parsed.toString();
}
