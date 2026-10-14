import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config';
import { useSocket } from './useSocket';

export type CameraConnectionStatus = 'unknown' | 'connected' | 'disconnected';

interface CameraConfigResponse {
  url: string | null;
}

async function requestConfig(
  method: 'GET' | 'PUT' | 'DELETE',
  body?: { url: string },
): Promise<CameraConfigResponse> {
  const response = await fetch(`${API_URL}/camera/config`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = 'İşlem başarısız oldu.';
    try {
      const data = await response.json();
      const detail = Array.isArray(data.message) ? data.message[0] : data.message;
      if (typeof detail === 'string' && detail) {
        message = detail;
      }
    } catch {
      // Gövde JSON değilse varsayılan mesaj kullanılır.
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Kamera adresi yönetimi.
 *
 * Adres, sayfa açıldığında yüklenmez; yalnızca `fetchUrl` çağrıldığında
 * (kullanıcı "göster" dediğinde) sunucudan istenir.
 */
export function useCameraConfig() {
  const socket = useSocket();
  const [status, setStatus] = useState<CameraConnectionStatus>('unknown');

  useEffect(() => {
    const handleStatus = (payload: { connected: boolean }) => {
      setStatus(payload.connected ? 'connected' : 'disconnected');
    };

    socket.on('camera_status', handleStatus);
    socket.emit('camera_status_get');

    return () => {
      socket.off('camera_status', handleStatus);
    };
  }, [socket]);

  const fetchUrl = useCallback(async () => (await requestConfig('GET')).url, []);

  const saveUrl = useCallback(
    async (url: string) => (await requestConfig('PUT', { url })).url,
    [],
  );

  const resetUrl = useCallback(async () => {
    await requestConfig('DELETE');
  }, []);

  return { status, fetchUrl, saveUrl, resetUrl };
}
