#!/usr/bin/env bash
# Zenith sıfırdan kurulum betiği (Raspberry Pi OS / Debian, aarch64).
#
#   scripts/install.sh --dry-run     ne yapılacağını göster, hiçbir şey değiştirme
#   scripts/install.sh               kur (sudo şifresi gerekebilir)
#
# Betik idempotenttir: tamamlanmış adımları atlar, tekrar çalıştırmak güvenlidir.
# Repoyu önce klonlayın:  git clone https://github.com/MrMahirr/Zenith.git ~/Zenith
#
# Adımlar: sistem paketleri -> boot ayarları (I2C/SPI) -> Node + PM2 -> Miniforge +
# Python ortamı -> .env dosyaları -> bağımlılık/derleme -> servisler + açılışta
# başlatma -> LED sudo kuralı -> kiosk -> günlük yedek.
#
# Seçenekler: --dry-run | --skip-apt | --with-optimize | --no-kiosk | -h
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONDA_DIR="${CONDA_DIR:-$HOME/miniforge3}"
CONDA_ENV="${CONDA_ENV:-zenith-ai}"
NODE_MAJOR="${NODE_MAJOR:-20}"
NVM_VERSION="${NVM_VERSION:-v0.40.1}"
PYTHON="$CONDA_DIR/envs/$CONDA_ENV/bin/python"

DRY_RUN=0
SKIP_APT=0
WITH_OPTIMIZE=0
WITH_KIOSK=1

APT_PACKAGES=(git curl ca-certificates i2c-tools python3 build-essential libgl1 libglib2.0-0 sqlite3)
BOOT_LINES=(
  "dtparam=i2c_arm=on"
  "dtparam=spi=on"
  "dtparam=audio=off"
  "dtoverlay=i2c-gpio,bus=3,i2c_gpio_sda=17,i2c_gpio_scl=27"
)

step()    { printf '\n\033[1;34m[%s]\033[0m %s\n' "$1" "$2"; }
ok()      { printf '    \033[32mtamam\033[0m   %s\n' "$*"; }
doing()   { printf '    \033[33muygula\033[0m  %s\n' "$*"; }
note()    { printf '    \033[90mnot\033[0m     %s\n' "$*"; }
die()     { printf '\033[1;31mHATA:\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)       DRY_RUN=1 ;;
    --skip-apt)      SKIP_APT=1 ;;
    --with-optimize) WITH_OPTIMIZE=1 ;;
    --no-kiosk)      WITH_KIOSK=0 ;;
    -h|--help)       sed -n '2,/^set -/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//'; exit 0 ;;
    *)               die "bilinmeyen seçenek: $1 (-h)" ;;
  esac
  shift
done

[ "$(id -u)" -ne 0 ] || die "root olarak çalıştırmayın; gerektiğinde sudo kendisi çağrılır"
[ -f "$ROOT/ecosystem.config.js" ] || die "depo kökü bulunamadı: $ROOT"

# sudo_run: dry-run'da yalnızca yazdırır.
act() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '    \033[90m[dry-run]\033[0m %s\n' "$*"
  else
    "$@"
  fi
}

sudo_act() { act sudo "$@"; }

boot_config() {
  if [ -f /boot/firmware/config.txt ]; then echo /boot/firmware/config.txt; else echo /boot/config.txt; fi
}

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] || return 0

  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
  # Sistemdeki eski /usr/bin/node yerine kullanıcının nvm sürümü seçilsin.
  nvm use --silent default >/dev/null 2>&1 || true
  set -u
}

# ---------------------------------------------------------------------------
step_apt() {
  step 1 "Sistem paketleri"
  if [ "$SKIP_APT" -eq 1 ]; then note "atlandı (--skip-apt)"; return; fi

  local missing=()
  for pkg in "${APT_PACKAGES[@]}"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
  done

  if [ "${#missing[@]}" -eq 0 ]; then
    ok "tüm paketler kurulu"
  else
    doing "kurulacak: ${missing[*]}"
    sudo_act apt-get update -qq
    sudo_act apt-get install -y -qq "${missing[@]}"
  fi
}

step_boot() {
  step 2 "Donanım arayüzleri (I2C, SPI, ses kapalı, yazılım I2C bus 3)"
  local cfg line changed=0
  cfg="$(boot_config)"
  [ -f "$cfg" ] || { note "config.txt bulunamadı ($cfg); elle ayarlayın"; return; }

  for line in "${BOOT_LINES[@]}"; do
    if grep -qxF "$line" "$cfg"; then
      ok "$line"
    else
      doing "$cfg: $line ekleniyor"
      if [ "$changed" -eq 0 ]; then sudo_act cp -n "$cfg" "$cfg.zenith.bak"; fi
      if [ "$DRY_RUN" -eq 0 ]; then echo "$line" | sudo tee -a "$cfg" >/dev/null; fi
      changed=1
    fi
  done

  if [ -f /etc/modules-load.d/zenith-i2c.conf ]; then
    ok "i2c-dev modülü açılışta yüklenir"
  else
    doing "i2c-dev modülü açılışa ekleniyor"
    if [ "$DRY_RUN" -eq 0 ]; then echo i2c-dev | sudo tee /etc/modules-load.d/zenith-i2c.conf >/dev/null; fi
  fi

  local grp missing_groups=()
  for grp in i2c spi gpio; do
    if getent group "$grp" >/dev/null && ! id -nG "$USER" | tr ' ' '\n' | grep -qx "$grp"; then
      missing_groups+=("$grp")
    fi
  done
  if [ "${#missing_groups[@]}" -eq 0 ]; then
    ok "kullanıcı i2c/spi/gpio gruplarında"
  else
    doing "gruplara ekleniyor: ${missing_groups[*]}"
    sudo_act usermod -aG "$(IFS=,; echo "${missing_groups[*]}")" "$USER"
  fi

  [ "$changed" -eq 0 ] || note "boot ayarları değişti; kurulum sonunda yeniden başlatın"
}

step_node() {
  step 3 "Node.js $NODE_MAJOR ve PM2"
  load_nvm

  if ! command -v nvm >/dev/null 2>&1 && ! type nvm >/dev/null 2>&1; then
    doing "nvm $NVM_VERSION kuruluyor"
    if [ "$DRY_RUN" -eq 0 ]; then
      curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
      load_nvm
    else
      note "[dry-run] nvm install betiği indirilip çalıştırılacak"
    fi
  else
    ok "nvm kurulu"
  fi

  if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" = "$NODE_MAJOR" ]; then
    ok "node $(node --version)"
  else
    doing "node $NODE_MAJOR kuruluyor"
    if [ "$DRY_RUN" -eq 0 ]; then nvm install "$NODE_MAJOR" && nvm alias default "$NODE_MAJOR"; fi
  fi

  if command -v pm2 >/dev/null 2>&1; then
    ok "pm2 $(pm2 --version)"
  else
    doing "pm2 kuruluyor"
    act npm install -g pm2
  fi

  if command -v pm2 >/dev/null 2>&1 && pm2 conf 2>/dev/null | grep -q 'pm2-logrotate'; then
    ok "pm2-logrotate kurulu"
  else
    doing "pm2-logrotate kuruluyor (10 MB, 3 kopya, sıkıştırmalı)"
    if [ "$DRY_RUN" -eq 0 ]; then
      pm2 install pm2-logrotate
      pm2 set pm2-logrotate:max_size 10M
      pm2 set pm2-logrotate:retain 3
      pm2 set pm2-logrotate:compress true
    fi
  fi
}

step_python() {
  step 4 "Miniforge ve Python ortamı ($CONDA_ENV)"

  if [ -x "$CONDA_DIR/bin/conda" ]; then
    ok "miniforge: $CONDA_DIR"
  else
    doing "Miniforge indiriliyor ve kuruluyor"
    if [ "$DRY_RUN" -eq 0 ]; then
      local installer
      installer="$(mktemp --suffix=.sh)"
      curl -fsSL -o "$installer" \
        "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-$(uname -m).sh"
      bash "$installer" -b -p "$CONDA_DIR"
      rm -f "$installer"
    fi
  fi

  if [ -x "$PYTHON" ]; then
    ok "ortam mevcut: $PYTHON"
  else
    doing "conda ortamı oluşturuluyor"
    act "$CONDA_DIR/bin/conda" env create -y -f "$ROOT/ai-service/environment.yml"
  fi

  if [ -x "$PYTHON" ] && "$PYTHON" -c 'import cv2, mediapipe, socketio, dotenv' >/dev/null 2>&1; then
    ok "Python bağımlılıkları kurulu"
  else
    doing "pip bağımlılıkları kuruluyor (requirements.lock kısıtıyla)"
    act "$PYTHON" -m pip install -r "$ROOT/ai-service/requirements.txt" -c "$ROOT/ai-service/requirements.lock"
  fi
}

step_env_files() {
  step 5 "Ortam dosyaları (.env)"
  local pair target
  for pair in backend ai-service; do
    target="$ROOT/$pair/.env"
    if [ -f "$target" ]; then
      ok "$pair/.env mevcut"
    else
      doing "$pair/.env, .env.example'dan oluşturuluyor"
      act cp "$ROOT/$pair/.env.example" "$target"
      note "$pair/.env içindeki değerleri (kamera adresi, hava durumu API anahtarı...) düzenleyin"
    fi
  done
}

step_build() {
  step 6 "Bağımlılıklar ve derleme"
  load_nvm
  local dir
  for dir in backend frontend; do
    if [ -d "$ROOT/$dir/node_modules" ]; then ok "$dir: node_modules mevcut"
    else doing "$dir: npm ci"; (cd "$ROOT/$dir" && act npm ci --no-audit --no-fund); fi
  done

  if [ -f "$ROOT/backend/dist/main.js" ]; then ok "backend derlenmiş"
  else doing "backend derleniyor"; (cd "$ROOT/backend" && act npm run build); fi

  if [ -f "$ROOT/frontend/dist/index.html" ]; then ok "frontend derlenmiş"
  else doing "frontend derleniyor"; (cd "$ROOT/frontend" && act npm run build); fi
}

step_services() {
  step 7 "Servisler ve açılışta başlatma"
  load_nvm

  if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q '"name":"zenith-backend"'; then
    ok "PM2 servisleri tanımlı"
  else
    doing "PM2 servisleri başlatılıyor"
    (cd "$ROOT" && act pm2 start ecosystem.config.js)
    act pm2 save
  fi

  if systemctl is-enabled "pm2-$USER.service" >/dev/null 2>&1; then
    ok "pm2-$USER.service açılışta başlıyor"
  else
    doing "PM2 açılış servisi (systemd) kuruluyor"
    if [ "$DRY_RUN" -eq 0 ]; then
      sudo env "PATH=$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME"
      pm2 save
    else
      note "[dry-run] pm2 startup systemd -u $USER --hp $HOME"
    fi
  fi
}

step_sudoers() {
  step 8 "LED servisi için sudo kuralı"
  local rule_file="/etc/sudoers.d/zenith-led"
  local rule="$USER ALL=(root) NOPASSWD: $PYTHON -u main.py --service led"

  if sudo -n grep -qxF "$rule" "$rule_file" 2>/dev/null; then
    ok "$rule_file mevcut"
    return
  fi

  doing "$rule_file yazılıyor (yalnızca LED komutuna şifresiz izin)"
  if [ "$DRY_RUN" -eq 1 ]; then
    note "[dry-run] $rule"
    return
  fi

  local tmp
  tmp="$(mktemp)"
  printf '%s\n' "$rule" > "$tmp"
  if sudo visudo -cf "$tmp" >/dev/null; then
    sudo install -m 0440 -o root -g root "$tmp" "$rule_file"
  else
    rm -f "$tmp"
    die "sudoers kuralı doğrulanamadı; dosya yazılmadı"
  fi
  rm -f "$tmp"
}

step_kiosk() {
  step 9 "Kiosk ekranı (açılışta tam ekran panel)"
  if [ "$WITH_KIOSK" -eq 0 ]; then note "atlandı (--no-kiosk)"; return; fi

  local target="$HOME/.config/autostart/zenith-kiosk.desktop"
  local expected
  expected="$(sed "s|^Exec=.*|Exec=$ROOT/kiosk.sh|" "$ROOT/zenith-kiosk.desktop")"

  if [ -f "$target" ] && [ "$(cat "$target")" = "$expected" ]; then
    ok "autostart girdisi güncel"
  else
    doing "$target yazılıyor"
    if [ "$DRY_RUN" -eq 0 ]; then
      mkdir -p "$(dirname "$target")"
      printf '%s\n' "$expected" > "$target"
    fi
  fi
  act chmod +x "$ROOT/kiosk.sh"
}

step_backup_timer() {
  step 10 "Günlük veritabanı yedeği (systemd kullanıcı zamanlayıcısı)"
  local unit_dir="$HOME/.config/systemd/user"
  local name changed=0 expected

  for name in zenith-backup.service zenith-backup.timer; do
    expected="$(sed "s|@ROOT@|$ROOT|g" "$ROOT/deploy/systemd/$name")"
    if [ -f "$unit_dir/$name" ] && [ "$(cat "$unit_dir/$name")" = "$expected" ]; then
      ok "$name güncel"
    else
      doing "$unit_dir/$name yazılıyor"
      if [ "$DRY_RUN" -eq 0 ]; then
        mkdir -p "$unit_dir"
        printf '%s\n' "$expected" > "$unit_dir/$name"
      fi
      changed=1
    fi
  done

  act chmod +x "$ROOT/scripts/backup-db.sh"

  # Oturum açık olmasa da (SSH yokken, açılışta) zamanlayıcının çalışması için.
  if loginctl show-user "$USER" -p Linger 2>/dev/null | grep -q 'Linger=yes'; then
    ok "linger açık"
  else
    doing "loginctl enable-linger $USER"
    sudo_act loginctl enable-linger "$USER"
  fi

  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  if [ "$DRY_RUN" -eq 1 ]; then
    note "[dry-run] systemctl --user daemon-reload && enable --now zenith-backup.timer"
  else
    [ "$changed" -eq 0 ] || systemctl --user daemon-reload
    if systemctl --user is-enabled zenith-backup.timer >/dev/null 2>&1; then
      ok "zamanlayıcı etkin"
    else
      doing "zamanlayıcı etkinleştiriliyor"
      systemctl --user enable --now zenith-backup.timer
    fi
  fi
}

step_optimize() {
  step 11 "İşletim sistemi ayarları (SD kart ömrü)"
  if [ "$WITH_OPTIMIZE" -eq 1 ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      note "[dry-run] sudo scripts/optimize-pi-os.sh --apply"
    else
      sudo "$ROOT/scripts/optimize-pi-os.sh" --apply
    fi
  else
    "$ROOT/scripts/optimize-pi-os.sh" --check || true
    note "uygulamak için: sudo scripts/optimize-pi-os.sh --apply  (ya da install.sh --with-optimize)"
  fi
}

printf 'Zenith kurulumu — depo: %s%s\n' "$ROOT" "$([ "$DRY_RUN" -eq 1 ] && echo '  [DRY-RUN]')"
step_apt
step_boot
step_node
step_python
step_env_files
step_build
step_services
step_sudoers
step_kiosk
step_backup_timer
step_optimize

printf '\n\033[1;32mBitti.\033[0m Boot ayarları değiştiyse: sudo reboot\n'
