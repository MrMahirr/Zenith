import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNfcChips } from '../../hooks/useNfcChips';
import type { NfcChip, NfcFilter } from '../../hooks/useNfcChips';
import { NfcChipCard } from './components/NfcChipCard';
import { NfcRegisterModal } from './components/NfcRegisterModal';
import './NfcManagement.css';

const MODE_NAMES: Record<string, string> = {
  PASSIVE: 'Serbest',
  CODING: 'Kodlama',
  FOCUS: 'Odak',
  RELAX: 'Relax',
  MEETING: 'Toplantı',
};

const FILTER_OPTIONS: { key: NfcFilter; label: string; icon: string }[] = [
  { key: 'all',          label: 'Tümü',    icon: '📋' },
  { key: 'registered',   label: 'Kayıtlı', icon: '✅' },
  { key: 'unregistered', label: 'Kayıtsız', icon: '⚠️' },
];

/**
 * NFC Çip Yönetim Sayfası
 *
 * Okunan NFC çiplerin listesini gösterir.
 * Kayıtsız çipleri sisteme ekleme ve mod atama imkânı sunar.
 * Gerçek zamanlı Socket.io ile yeni okumaları takip eder.
 */
export function NfcManagement() {
  const navigate = useNavigate();
  const {
    chips,
    allChips,
    logs,
    filter,
    setFilter,
    loading,
    lastScannedUid,
    registerChip,
    updateChip,
    deleteChip,
  } = useNfcChips();

  const [editingChip, setEditingChip] = useState<NfcChip | null>(null);

  // ─── Modal kaydet ───
  const handleModalSave = async (id: number, label: string, mode: string) => {
    const chip = allChips.find((c) => c.id === id);
    if (chip?.isRegistered) {
      await updateChip(id, { label, assignedMode: mode });
    } else {
      await registerChip(id, label, mode);
    }
  };

  // ─── Silme onayı ───
  const handleDelete = (id: number) => {
    const chip = allChips.find((c) => c.id === id);
    if (chip && confirm(`"${chip.label || chip.uid}" çipini silmek istiyor musunuz?`)) {
      deleteChip(id);
    }
  };

  // ─── İstatistikler ───
  const totalChips = allChips.length;
  const registeredCount = allChips.filter((c) => c.isRegistered).length;
  const unregisteredCount = allChips.filter((c) => !c.isRegistered).length;

  return (
    <div className="nfc-page">
      {/* ─── Header ─── */}
      <header className="nfc-page__header">
        <div className="nfc-page__header-left">
          <button className="nfc-page__back" onClick={() => navigate('/')} id="nfc-back-btn">
            ‹ Dashboard
          </button>
          <h1 className="nfc-page__title">📱 NFC Çip Yönetimi</h1>
        </div>

        {/* Mini Stats */}
        <div className="nfc-page__stats">
          <div className="nfc-page__stat">
            <span className="nfc-page__stat-value">{totalChips}</span>
            <span className="nfc-page__stat-label label">Toplam</span>
          </div>
          <div className="nfc-page__stat nfc-page__stat--success">
            <span className="nfc-page__stat-value">{registeredCount}</span>
            <span className="nfc-page__stat-label label">Kayıtlı</span>
          </div>
          <div className="nfc-page__stat nfc-page__stat--warning">
            <span className="nfc-page__stat-value">{unregisteredCount}</span>
            <span className="nfc-page__stat-label label">Kayıtsız</span>
          </div>
        </div>
      </header>

      {/* ─── Filter Tabs ─── */}
      <div className="nfc-page__filters">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`nfc-page__filter-btn ${filter === opt.key ? 'nfc-page__filter-btn--active' : ''}`}
            onClick={() => setFilter(opt.key)}
            id={`nfc-filter-${opt.key}`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Content ─── */}
      <div className="nfc-page__content">
        {/* Chip Grid */}
        <div className="nfc-page__grid-section">
          {loading ? (
            <div className="nfc-page__empty">
              <div className="nfc-page__spinner" />
              <span>Yükleniyor...</span>
            </div>
          ) : chips.length === 0 ? (
            <div className="nfc-page__empty">
              <span className="nfc-page__empty-icon">📡</span>
              <span className="nfc-page__empty-text">
                {filter === 'all'
                  ? 'Henüz çip okutulmamış. NFC okuyucuya bir kart tutun.'
                  : filter === 'registered'
                    ? 'Kayıtlı çip bulunmuyor.'
                    : 'Tüm çipler sisteme kayıtlı!'}
              </span>
            </div>
          ) : (
            <div className="nfc-page__chip-grid">
              {chips.map((chip) => (
                <NfcChipCard
                  key={chip.id}
                  chip={chip}
                  isHighlighted={lastScannedUid === chip.uid}
                  onEdit={setEditingChip}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Scan Logs */}
        <div className="nfc-page__logs-section glass-card">
          <h2 className="nfc-page__logs-title">📜 Son Okumalar</h2>
          {logs.length === 0 ? (
            <div className="nfc-page__logs-empty label">Henüz okuma yok</div>
          ) : (
            <div className="nfc-page__logs-list">
              {logs.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className={`nfc-page__log-item ${log.wasRegistered ? '' : 'nfc-page__log-item--unknown'}`}
                >
                  <span className="nfc-page__log-time mono">
                    {new Date(log.scannedAt).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="nfc-page__log-uid mono">{log.chipUid}</span>
                  <span className="nfc-page__log-arrow">→</span>
                  <span className={`nfc-page__log-mode ${log.wasRegistered ? '' : 'nfc-page__log-mode--unknown'}`}>
                    {log.triggeredMode
                      ? `${MODE_NAMES[log.triggeredMode] || log.triggeredMode} ✓`
                      : 'Bilinmeyen ⚠'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Register/Edit Modal ─── */}
      {editingChip && (
        <NfcRegisterModal
          chip={editingChip}
          onClose={() => setEditingChip(null)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
