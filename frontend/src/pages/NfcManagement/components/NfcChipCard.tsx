import type { NfcChip } from '../../../hooks/useNfcChips';
import { useModeCatalog } from '../../../hooks/useModeCatalog';
import { isModeName } from '../../../modes/modeCatalog';
import './NfcChipCard.css';

interface NfcChipCardProps {
  chip: NfcChip;
  isHighlighted: boolean;
  onEdit: (chip: NfcChip) => void;
  onDelete: (id: number) => void;
}

/** Zaman farkını okunabilir formata çevirir */
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

/**
 * Tekil NFC çip kartı.
 * Kayıtlı çiplerde mod badge'i ve düzenle butonu,
 * kayıtsız çiplerde belirgin "Sisteme Ekle" butonu gösterir.
 */
export function NfcChipCard({ chip, isHighlighted, onEdit, onDelete }: NfcChipCardProps) {
  const { byMode } = useModeCatalog();
  const mode =
    chip.assignedMode && isModeName(chip.assignedMode) ? byMode[chip.assignedMode] : undefined;
  const modeColor = mode?.color ?? (chip.assignedMode ? '#666' : undefined);

  return (
    <div
      className={`nfc-chip-card glass-card ${!chip.isRegistered ? 'nfc-chip-card--unregistered' : ''} ${isHighlighted ? 'nfc-chip-card--highlighted' : ''}`}
      style={{ '--chip-accent': modeColor || '#F59E0B' } as React.CSSProperties}
      id={`nfc-chip-${chip.id}`}
    >
      {/* Status Dot */}
      <div className={`nfc-chip-card__status ${chip.isRegistered ? 'nfc-chip-card__status--registered' : 'nfc-chip-card__status--unregistered'}`}>
        {chip.isRegistered ? '✓' : '⚠'}
      </div>

      {/* Mode Badge (kayıtlıysa) */}
      {chip.isRegistered && chip.assignedMode && (
        <div
          className="nfc-chip-card__mode-badge"
          style={{ background: `${modeColor}20`, color: modeColor, borderColor: `${modeColor}40` }}
        >
          <span>{mode?.icon ?? '📱'}</span>
          <span>{mode?.label ?? chip.assignedMode}</span>
        </div>
      )}

      {/* Kayıtsız Badge */}
      {!chip.isRegistered && (
        <div className="nfc-chip-card__mode-badge nfc-chip-card__mode-badge--unknown">
          <span>⚠</span>
          <span>Kayıtsız</span>
        </div>
      )}

      {/* UID */}
      <div className="nfc-chip-card__uid mono">{chip.uid}</div>

      {/* Label */}
      <div className="nfc-chip-card__label">
        {chip.label || (chip.isRegistered ? 'İsimsiz Çip' : 'Yeni çip algılandı!')}
      </div>

      {/* Son okuma */}
      <div className="nfc-chip-card__seen label">
        Son: {timeAgo(chip.lastSeenAt)}
      </div>

      {/* Actions */}
      <div className="nfc-chip-card__actions">
        {chip.isRegistered ? (
          <>
            <button
              className="nfc-chip-card__btn nfc-chip-card__btn--edit"
              onClick={() => onEdit(chip)}
              id={`edit-chip-${chip.id}`}
            >
              ✏️ Düzenle
            </button>
            <button
              className="nfc-chip-card__btn nfc-chip-card__btn--delete"
              onClick={() => onDelete(chip.id)}
              id={`delete-chip-${chip.id}`}
            >
              🗑️
            </button>
          </>
        ) : (
          <button
            className="nfc-chip-card__btn nfc-chip-card__btn--register"
            onClick={() => onEdit(chip)}
            id={`register-chip-${chip.id}`}
          >
            ➕ Sisteme Ekle
          </button>
        )}
      </div>
    </div>
  );
}
