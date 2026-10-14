#!/bin/bash
# Zenith kiosk ekranı – masaüstü oturumu açılınca ~/.config/autostart/zenith-kiosk.desktop
# tarafından çalıştırılır. Frontend (PM2: zenith-frontend) hazır olana kadar bekler,
# ardından Brave'i tam ekran kiosk modunda açar. Tarayıcı kapanırsa yeniden açar.

URL="http://localhost:4173"

# Frontend ayağa kalkana kadar bekle (en fazla ~3 dakika)
for _ in $(seq 1 90); do
  curl -fs -o /dev/null "$URL" && break
  sleep 2
done

while true; do
  brave-browser \
    --kiosk "$URL" \
    --password-store=basic \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --hide-crash-restore-bubble \
    --ozone-platform=wayland
  sleep 3
done
