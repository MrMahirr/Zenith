import { useBackendOnline } from '../../hooks/useBackendOnline';
import './ConnectionBanner.css';

/**
 * Backend bağlantısı koptuğunda üstte gösterilen uyarı.
 * Açılışta/kısa kopmalarda titremesin diye görünürlük CSS ile 3 sn geciktirilir.
 */
export function ConnectionBanner() {
  const online = useBackendOnline();

  if (online) {
    return null;
  }

  return (
    <div className="connection-banner" role="status" aria-live="polite">
      <span className="connection-banner__dot" />
      <span>Sunucuyla bağlantı yok — yeniden bağlanılıyor…</span>
    </div>
  );
}
