import { useNavigate } from 'react-router-dom';
import { useHardware } from '../../hooks/useHardware';
import { SERVICE_LABELS, criticalAlerts } from '../../hardware/hardwareStatus';
import './HardwareBanner.css';

/**
 * Ana ekranda donanım sorunu uyarısı (ör. düşük gerilim, kopuk sensör).
 * Dokununca ayrıntıların olduğu Ayarlar sayfasına gider.
 */
export function HardwareBanner() {
  const navigate = useNavigate();
  const snapshot = useHardware();
  const alerts = criticalAlerts(snapshot);

  if (alerts.length === 0) {
    return null;
  }

  const [first] = alerts;
  const extra = alerts.length - 1;

  return (
    <button
      type="button"
      className="hardware-banner"
      onClick={() => navigate('/settings')}
      aria-label="Donanım sorunu: ayrıntılar için ayarlara git"
    >
      <span className="hardware-banner__icon">⚠️</span>
      <span className="hardware-banner__text">
        <strong>{first.device.name}</strong>
        <span>{first.device.detail || SERVICE_LABELS[first.service]}</span>
      </span>
      {extra > 0 && <span className="hardware-banner__more">+{extra}</span>}
    </button>
  );
}
