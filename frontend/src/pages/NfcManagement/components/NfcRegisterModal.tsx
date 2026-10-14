import { useState } from 'react';
import type { NfcChip } from '../../../hooks/useNfcChips';
import { useModeCatalog } from '../../../hooks/useModeCatalog';
import './NfcRegisterModal.css';

interface NfcRegisterModalProps {
  chip: NfcChip;
  onClose: () => void;
  onSave: (id: number, label: string, mode: string) => Promise<void>;
}

/**
 * NFC çip kayıt/düzenleme modal'ı.
 * Çipin etiketini ve atanacak modu belirlemek için kullanılır.
 */
export function NfcRegisterModal({ chip, onClose, onSave }: NfcRegisterModalProps) {
  const { modes } = useModeCatalog();
  const [label, setLabel] = useState(chip.label || '');
  const [selectedMode, setSelectedMode] = useState(chip.assignedMode || '');
  const [saving, setSaving] = useState(false);

  const isEditing = chip.isRegistered;

  const handleSave = async () => {
    if (!label.trim() || !selectedMode) return;
    setSaving(true);
    try {
      await onSave(chip.id, label.trim(), selectedMode);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="nfc-modal__overlay" onClick={onClose} id="nfc-modal-overlay">
      <div
        className="nfc-modal glass-card"
        onClick={(e) => e.stopPropagation()}
        id="nfc-modal"
      >
        {/* Header */}
        <div className="nfc-modal__header">
          <h2 className="nfc-modal__title">
            {isEditing ? '✏️ Çipi Düzenle' : '📱 Yeni Çip Kaydet'}
          </h2>
          <button className="nfc-modal__close" onClick={onClose} id="nfc-modal-close">
            ✕
          </button>
        </div>

        {/* UID */}
        <div className="nfc-modal__uid-row">
          <span className="nfc-modal__uid-label label">ÇİP UID</span>
          <span className="nfc-modal__uid-value mono">{chip.uid}</span>
        </div>

        {/* Etiket */}
        <div className="nfc-modal__field">
          <label className="nfc-modal__field-label label" htmlFor="chip-label-input">
            ETİKET
          </label>
          <input
            id="chip-label-input"
            className="nfc-modal__input"
            type="text"
            placeholder="ör. Kodlama Kartım"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={100}
            autoFocus
          />
        </div>

        {/* Mod Seçimi */}
        <div className="nfc-modal__field">
          <span className="nfc-modal__field-label label">MOD ATAMA</span>
          <div className="nfc-modal__modes">
            {modes.map((mode) => (
              <button
                key={mode.mode}
                className={`nfc-modal__mode-btn ${selectedMode === mode.mode ? 'nfc-modal__mode-btn--active' : ''}`}
                style={{
                  '--mode-btn-color': mode.color,
                  borderColor: selectedMode === mode.mode ? mode.color : undefined,
                } as React.CSSProperties}
                onClick={() => setSelectedMode(mode.mode)}
                id={`mode-btn-${mode.mode.toLowerCase()}`}
              >
                <span className="nfc-modal__mode-icon">{mode.icon}</span>
                <span className="nfc-modal__mode-name">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Butonlar */}
        <div className="nfc-modal__actions">
          <button
            className="nfc-modal__btn nfc-modal__btn--cancel"
            onClick={onClose}
            id="nfc-modal-cancel"
          >
            İptal
          </button>
          <button
            className="nfc-modal__btn nfc-modal__btn--save"
            onClick={handleSave}
            disabled={!label.trim() || !selectedMode || saving}
            id="nfc-modal-save"
          >
            {saving ? '⏳ Kaydediliyor...' : isEditing ? '💾 Güncelle' : '✅ Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
