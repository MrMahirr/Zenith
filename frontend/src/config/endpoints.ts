/**
 * Backend ve kamera yayını adreslerinin hesaplanması (saf fonksiyon; test edilebilir).
 *
 * Panel, Pi'nin kendisinden ya da ağdaki başka bir cihazdan açılabildiği için
 * adresler tarayıcının açıldığı ana makine adından türetilir. Gerekirse build
 * zamanında ortam değişkenleriyle ezilebilir:
 *   VITE_BACKEND_URL, VITE_BACKEND_PORT, VITE_STREAM_URL, VITE_STREAM_PORT
 */
export interface PageLocation {
  protocol: string;
  hostname: string;
}

export interface EndpointEnv {
  VITE_BACKEND_URL?: string;
  VITE_BACKEND_PORT?: string;
  VITE_STREAM_URL?: string;
  VITE_STREAM_PORT?: string;
}

export interface Endpoints {
  /** Socket.io ve REST için backend kökü, örn. http://192.168.1.5:3000 */
  backendUrl: string;
  /** REST API kökü, örn. http://192.168.1.5:3000/api */
  apiUrl: string;
  /** Kamera (MJPEG) sunucusu kökü, örn. http://192.168.1.5:5001 */
  streamUrl: string;
}

const DEFAULT_BACKEND_PORT = 3000;
const DEFAULT_STREAM_PORT = 5001;

function parsePort(value: string | undefined, fallback: number): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function buildEndpoints(location: PageLocation, env: EndpointEnv = {}): Endpoints {
  const origin = `${location.protocol}//${location.hostname}`;

  const backendUrl = env.VITE_BACKEND_URL
    ? trimTrailingSlash(env.VITE_BACKEND_URL)
    : `${origin}:${parsePort(env.VITE_BACKEND_PORT, DEFAULT_BACKEND_PORT)}`;

  const streamUrl = env.VITE_STREAM_URL
    ? trimTrailingSlash(env.VITE_STREAM_URL)
    : `${origin}:${parsePort(env.VITE_STREAM_PORT, DEFAULT_STREAM_PORT)}`;

  return { backendUrl, apiUrl: `${backendUrl}/api`, streamUrl };
}
