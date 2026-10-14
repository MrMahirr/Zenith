import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import type { HardwareSnapshot } from '../hardware/hardwareStatus';
import { useSocket } from './useSocket';

/**
 * Donanım durumu: açılışta REST ile, sonra `hardware_status` socket olayıyla
 * (yalnızca durum değiştiğinde yayınlanır) güncellenir.
 */
export function useHardware() {
  const socket = useSocket();
  const [snapshot, setSnapshot] = useState<HardwareSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/hardware`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: HardwareSnapshot) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        // Sunucuya ulaşılamıyorsa bağlantı bandı zaten bilgilendirir.
      });

    const handleStatus = (data: HardwareSnapshot) => setSnapshot(data);
    socket.on('hardware_status', handleStatus);

    return () => {
      cancelled = true;
      socket.off('hardware_status', handleStatus);
    };
  }, [socket]);

  return snapshot;
}
