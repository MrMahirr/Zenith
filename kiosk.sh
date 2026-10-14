#!/bin/bash
# Zenith kiosk ekranı – masaüstü oturumu açılınca ~/.config/autostart/zenith-kiosk.desktop
# tarafından çalıştırılır.
#
# - Frontend (PM2: zenith-frontend) hazır olana kadar bekler.
# - Brave'i tam ekran kiosk modunda açar; kapanırsa yeniden açar.
# - Tarayıcı hemen çökmeye devam ederse bekleme süresini katlayarak artırır.
# - Toplam bellek kullanımı sınırı aşarsa tarayıcıyı yeniden başlatır (sızıntı koruması).
#
# Ortam değişkenleri:
#   ZENITH_KIOSK_URL            açılacak adres               (varsayılan: http://localhost:4173)
#   ZENITH_KIOSK_MAX_RSS_MB     bellek sınırı (MB)           (varsayılan: 900)
#   ZENITH_KIOSK_CHECK_SECONDS  bellek kontrol aralığı (sn)  (varsayılan: 30)

URL="${ZENITH_KIOSK_URL:-http://localhost:4173}"
MAX_RSS_MB="${ZENITH_KIOSK_MAX_RSS_MB:-900}"
CHECK_SECONDS="${ZENITH_KIOSK_CHECK_SECONDS:-30}"

MIN_HEALTHY_SECONDS=20   # bundan kısa süren oturum "çökme" sayılır
MIN_BACKOFF=3
MAX_BACKOFF=60

LOG_DIR="$HOME/.cache/zenith"
LOG_FILE="$LOG_DIR/kiosk.log"
mkdir -p "$LOG_DIR"
# Log dosyası şişmesin (SD kart ömrü): 1 MB'ı aşarsa sıfırla.
if [ -f "$LOG_FILE" ] && [ "$(stat -c %s "$LOG_FILE")" -gt 1048576 ]; then
  : > "$LOG_FILE"
fi

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG_FILE"; }

# Kiosk oturumuna (setsid ile ayrı oturum) ait tüm süreçlerin toplam RSS'i, MB.
session_rss_mb() {
  ps -o rss= --sid "$1" 2>/dev/null | awk '{s += $1} END {print int(s / 1024)}'
}

stop_session() {
  kill -TERM -- "-$1" 2>/dev/null
  for _ in 1 2 3 4 5; do
    kill -0 "$1" 2>/dev/null || return 0
    sleep 1
  done
  kill -KILL -- "-$1" 2>/dev/null
}

# Frontend ayağa kalkana kadar bekle (en fazla ~3 dakika)
for _ in $(seq 1 90); do
  curl -fs -o /dev/null "$URL" && break
  sleep 2
done

backoff="$MIN_BACKOFF"

while true; do
  started="$(date +%s)"

  setsid brave-browser \
    --kiosk "$URL" \
    --password-store=basic \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --hide-crash-restore-bubble \
    --ozone-platform=wayland &
  pid=$!
  log "tarayici basladi (pid $pid)"

  while kill -0 "$pid" 2>/dev/null; do
    sleep "$CHECK_SECONDS"
    kill -0 "$pid" 2>/dev/null || break

    rss="$(session_rss_mb "$pid")"
    if [ "${rss:-0}" -gt "$MAX_RSS_MB" ]; then
      log "bellek siniri asildi (${rss} MB > ${MAX_RSS_MB} MB); tarayici yeniden baslatiliyor"
      stop_session "$pid"
      break
    fi
  done

  wait "$pid" 2>/dev/null
  runtime=$(( $(date +%s) - started ))

  if [ "$runtime" -lt "$MIN_HEALTHY_SECONDS" ]; then
    backoff=$(( backoff * 2 > MAX_BACKOFF ? MAX_BACKOFF : backoff * 2 ))
    log "tarayici ${runtime} sn icinde kapandi; ${backoff} sn sonra yeniden denenecek"
  else
    backoff="$MIN_BACKOFF"
    log "tarayici ${runtime} sn calisip kapandi; ${backoff} sn sonra yeniden aciliyor"
  fi

  sleep "$backoff"
done
