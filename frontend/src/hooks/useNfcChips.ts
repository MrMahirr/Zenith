import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';

const API_URL = `http://${window.location.hostname}:3000/api`;

// ──────────── Types ────────────

export interface NfcChip {
  id: number;
  uid: string;
  label: string | null;
  assignedMode: string | null;
  isRegistered: boolean;
  firstSeenAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
}

export interface NfcScanLog {
  id: number;
  chipUid: string;
  triggeredMode: string | null;
  wasRegistered: boolean;
  scannedAt: string;
}

export type NfcFilter = 'all' | 'registered' | 'unregistered';

// ──────────── Hook ────────────

/**
 * NFC çip yönetimi hook'u.
 *
 * Sorumluluklar:
 * - REST API'den çip listesi ve logları çekme
 * - Socket üzerinden gerçek zamanlı güncelleme dinleme
 * - Register, update, delete işlemleri
 */
export function useNfcChips() {
  const socket = useSocket();
  const [chips, setChips] = useState<NfcChip[]>([]);
  const [logs, setLogs] = useState<NfcScanLog[]>([]);
  const [filter, setFilter] = useState<NfcFilter>('all');
  const [loading, setLoading] = useState(true);
  const [lastScannedUid, setLastScannedUid] = useState<string | null>(null);

  // ─── Veri çekme ───

  const fetchChips = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/nfc/chips`);
      const data = await res.json();
      setChips(data);
    } catch (err) {
      console.error('NFC çip listesi alınamadı:', err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/nfc/logs?hours=24`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('NFC logları alınamadı:', err);
    }
  }, []);

  // ─── İlk yükleme ───

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchChips(), fetchLogs()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchChips, fetchLogs]);

  // ─── Socket dinleme ───

  useEffect(() => {
    const handleChipListUpdated = (payload: { chip: NfcChip; isNew: boolean }) => {
      setLastScannedUid(payload.chip.uid);

      // Listeyi güncelle
      setChips((prev) => {
        const existing = prev.findIndex((c) => c.uid === payload.chip.uid);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = payload.chip;
          return updated;
        }
        return [payload.chip, ...prev];
      });

      // Logları yenile
      fetchLogs();

      // 3 saniye sonra highlight'ı kaldır
      setTimeout(() => setLastScannedUid(null), 3000);
    };

    socket.on('nfc_chip_list_updated', handleChipListUpdated);
    return () => {
      socket.off('nfc_chip_list_updated', handleChipListUpdated);
    };
  }, [socket, fetchLogs]);

  // ─── Filtre uygulanmış liste ───

  const filteredChips = chips.filter((chip) => {
    if (filter === 'registered') return chip.isRegistered;
    if (filter === 'unregistered') return !chip.isRegistered;
    return true;
  });

  // ─── API işlemleri ───

  const registerChip = useCallback(
    async (id: number, label: string, assignedMode: string) => {
      try {
        const res = await fetch(`${API_URL}/nfc/chips/${id}/register`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, assignedMode }),
        });
        const updated = await res.json();

        setChips((prev) =>
          prev.map((c) => (c.id === id ? updated : c)),
        );
        return updated;
      } catch (err) {
        console.error('Çip kaydedilemedi:', err);
        throw err;
      }
    },
    [],
  );

  const updateChip = useCallback(
    async (id: number, data: { label?: string; assignedMode?: string }) => {
      try {
        const res = await fetch(`${API_URL}/nfc/chips/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const updated = await res.json();

        setChips((prev) =>
          prev.map((c) => (c.id === id ? updated : c)),
        );
        return updated;
      } catch (err) {
        console.error('Çip güncellenemedi:', err);
        throw err;
      }
    },
    [],
  );

  const deleteChip = useCallback(
    async (id: number) => {
      try {
        await fetch(`${API_URL}/nfc/chips/${id}`, { method: 'DELETE' });
        setChips((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        console.error('Çip silinemedi:', err);
        throw err;
      }
    },
    [],
  );

  return {
    chips: filteredChips,
    allChips: chips,
    logs,
    filter,
    setFilter,
    loading,
    lastScannedUid,
    registerChip,
    updateChip,
    deleteChip,
    refreshChips: fetchChips,
  };
}
