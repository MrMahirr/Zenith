#!/usr/bin/env bash
# Zenith için Raspberry Pi OS ayarları: SD kart ömrünü uzatır, RAM'i boşaltır.
#
#   scripts/optimize-pi-os.sh            ne uygulanmış, ne eksik (salt okunur)
#   scripts/optimize-pi-os.sh --check    aynısı
#   sudo scripts/optimize-pi-os.sh --apply   eksik olanları uygula
#
# Betik idempotenttir: uygulanmış ayarlara dokunmaz, değiştirdiği dosyaların
# yedeğini (*.zenith.bak) alır. Bu işletim sisteminde geçerli olmayan adımlar
# (ör. dphys-swapfile yokken swap boyutu) hata vermeden atlanır.
#
# Kapatılacak servisler ZENITH_DISABLE_SERVICES ile değiştirilebilir.
# avahi-daemon bilerek listede yok: `<hostname>.local` adıyla erişimi sağlar.
set -euo pipefail

MODE="check"
case "${1:-}" in
  ""|--check) MODE="check" ;;
  --apply)    MODE="apply" ;;
  -h|--help)  sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *)          echo "bilinmeyen seçenek: $1 (-h)" >&2; exit 2 ;;
esac

if [ "$MODE" = "apply" ] && [ "$(id -u)" -ne 0 ]; then
  echo "--apply için root gerekir: sudo $0 --apply" >&2
  exit 1
fi

SERVICES=(${ZENITH_DISABLE_SERVICES:-bluetooth hciuart triggerhappy cups cups-browsed ModemManager})
FSTAB=/etc/fstab
CONFIG_TXT=/boot/firmware/config.txt
[ -f "$CONFIG_TXT" ] || CONFIG_TXT=/boot/config.txt

MISSING=0
ok()      { printf '  \033[32m[tamam]\033[0m  %s\n' "$*"; }
missing() { printf '  \033[33m[eksik]\033[0m  %s\n' "$*"; MISSING=$((MISSING + 1)); }
skip()    { printf '  \033[90m[atlandı]\033[0m %s\n' "$*"; }
applied() { printf '  \033[36m[uygulandı]\033[0m %s\n' "$*"; }

backup_once() {
  [ -f "$1.zenith.bak" ] || cp -p "$1" "$1.zenith.bak"
}

# --- 1. SD kart: noatime + tmpfs ---------------------------------------------
step_sd_card() {
  echo "SD kart yazma azaltma"

  if grep -Eq '^[^#].*[[:space:]]/[[:space:]]+ext4[[:space:]]+[^[:space:]]*noatime' "$FSTAB"; then
    ok "kök bölüm noatime ile bağlı"
  elif [ "$MODE" = "apply" ]; then
    backup_once "$FSTAB"
    sed -i -E '/[[:space:]]\/[[:space:]]+ext4[[:space:]]/ s/(defaults)([[:space:]])/\1,noatime,nodiratime\2/' "$FSTAB"
    applied "kök bölüme noatime,nodiratime eklendi"
  else
    missing "kök bölümde noatime yok"
  fi

  local mountpoint size
  for entry in "/tmp:64M" "/var/log:32M"; do
    mountpoint="${entry%%:*}"; size="${entry##*:}"
    if grep -Eq "^[^#]*tmpfs[[:space:]]+${mountpoint}[[:space:]]" "$FSTAB"; then
      ok "$mountpoint tmpfs (RAM disk)"
    elif [ "$MODE" = "apply" ]; then
      backup_once "$FSTAB"
      printf 'tmpfs  %s  tmpfs  defaults,noatime,nosuid,nodev,size=%s  0  0\n' "$mountpoint" "$size" >> "$FSTAB"
      applied "$mountpoint için $size tmpfs eklendi"
    else
      missing "$mountpoint tmpfs değil"
    fi
  done
}

# --- 2. Swap ------------------------------------------------------------------
step_swap() {
  echo "Swap"
  if [ -f /etc/dphys-swapfile ]; then
    if grep -q '^CONF_SWAPSIZE=1024$' /etc/dphys-swapfile; then
      ok "swap 1024 MB"
    elif [ "$MODE" = "apply" ]; then
      backup_once /etc/dphys-swapfile
      dphys-swapfile swapoff || true
      sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
      dphys-swapfile setup && dphys-swapfile swapon
      applied "swap 1024 MB yapıldı"
    else
      missing "swap boyutu 1024 MB değil"
    fi
  elif command -v zramctl >/dev/null 2>&1 || [ -d /sys/block/zram0 ]; then
    skip "dphys-swapfile yok; sistem zram kullanıyor (ayar gerekmiyor)"
  else
    skip "swap yönetimi tespit edilemedi"
  fi
}

# --- 3. GPU belleği -----------------------------------------------------------
step_gpu_mem() {
  echo "GPU belleği"
  if [ ! -f "$CONFIG_TXT" ]; then
    skip "config.txt bulunamadı"
  elif grep -q '^dtoverlay=vc4-kms-v3d' "$CONFIG_TXT"; then
    skip "KMS sürücüsü açık; gpu_mem etkisiz (bellek CMA'dan ayrılır)"
  elif grep -q '^gpu_mem=64$' "$CONFIG_TXT"; then
    ok "gpu_mem=64"
  elif [ "$MODE" = "apply" ]; then
    backup_once "$CONFIG_TXT"
    sed -i '/^gpu_mem=/d' "$CONFIG_TXT"
    echo "gpu_mem=64" >> "$CONFIG_TXT"
    applied "gpu_mem=64 eklendi"
  else
    missing "gpu_mem=64 ayarlı değil"
  fi
}

# --- 4. Gereksiz servisler ----------------------------------------------------
step_services() {
  echo "Gereksiz servisler"
  local svc state
  for svc in "${SERVICES[@]}"; do
    if ! systemctl cat "$svc.service" >/dev/null 2>&1; then
      skip "$svc kurulu değil"
      continue
    fi

    state="$(systemctl is-enabled "$svc.service" 2>/dev/null || true)"
    if [ "$state" = "disabled" ] || [ "$state" = "masked" ]; then
      ok "$svc kapalı ($state)"
    elif [ "$MODE" = "apply" ]; then
      systemctl disable --now "$svc.service" >/dev/null 2>&1 || true
      applied "$svc kapatıldı"
    else
      missing "$svc açık ($state)"
    fi
  done
}

echo "Zenith OS ayarları (${MODE})"
step_sd_card
step_swap
step_gpu_mem
step_services

echo
if [ "$MODE" = "check" ]; then
  if [ "$MISSING" -eq 0 ]; then
    echo "Her şey uygulanmış."
  else
    echo "$MISSING ayar eksik. Uygulamak için: sudo $0 --apply"
  fi
else
  echo "Bitti. Değişikliklerin tamamı için yeniden başlatma önerilir: sudo reboot"
fi
