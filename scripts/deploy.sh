#!/usr/bin/env bash
# Zenith güncelleme betiği: Pi üzerinde tek komutla güvenli sürüm geçişi.
#
#   scripts/deploy.sh                 GitHub'daki master'a güncelle
#   scripts/deploy.sh --ref <sha>     belirli bir sürüme geç (geri alma için de bu)
#   scripts/deploy.sh --dry-run       yalnızca ne yapılacağını göster
#
# Akış: ön kontrol -> veritabanı yedeği -> git güncelle -> (değiştiyse) bağımlılıklar
#       -> testler -> derleme -> servisleri yeniden başlat -> sağlık kontrolü.
# Sağlık kontrolü başarısız olursa önceki sürüme dönmek için gereken komutu yazar.
#
# Seçenekler: --ref <ref> | --force | --skip-tests | --no-backup | --dry-run | -h
set -euo pipefail

ROOT="${ZENITH_HOME:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/zenith"
PYTHON="${ZENITH_PYTHON:-$HOME/miniforge3/envs/zenith-ai/bin/python}"
APPS=(zenith-backend zenith-frontend zenith-camera zenith-sensor zenith-nfc zenith-led)
BACKEND_HEALTH_URL="${ZENITH_BACKEND_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
FRONTEND_URL="${ZENITH_FRONTEND_URL:-http://127.0.0.1:4173}"
HEALTH_TIMEOUT="${ZENITH_HEALTH_TIMEOUT:-120}"

DB_REL="backend/zenith.sqlite"
DB_RESCUE=""

REF=""
FORCE=0
RUN_TESTS=1
DO_BACKUP=1
DRY_RUN=0

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[1;31mHATA:\033[0m %s\n' "$*" >&2; exit 1; }

usage() { sed -n '2,/^set -/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --ref)        [ $# -ge 2 ] || die "--ref bir git referansı bekler"; REF="$2"; shift ;;
    --force)      FORCE=1 ;;
    --skip-tests) RUN_TESTS=0 ;;
    --no-backup)  DO_BACKUP=0 ;;
    --dry-run)    DRY_RUN=1 ;;
    -h|--help)    usage; exit 0 ;;
    *)            die "bilinmeyen seçenek: $1 (yardım için -h)" ;;
  esac
  shift
done

# run: dry-run'da komutu çalıştırmak yerine yazdırır.
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '    [dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

# Kullanıcının nvm varsayılan Node sürümünü seçer. Etkileşimsiz çalışmada (ssh,
# cron, systemd) nvm PATH'te olmaz; sistemde eski bir /usr/bin/node ya da farklı
# sürümde pm2 bulunsa bile yanlış araç zincirine düşmemek için her zaman nvm
# kullanılır.
load_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] || return 0

  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
  nvm use --silent default >/dev/null 2>&1 || true
  set -u
}

hash_of() { sha256sum "$@" | sha256sum | cut -d' ' -f1; }

# deps_changed <ad> <klasör> <dosya...>: kurulum yoksa ya da bağımlılık dosyaları
# son kurulumdan beri değiştiyse 0 döner.
# Daha önce hiç kayıt tutulmadıysa ve kurulum zaten duruyorsa (betik elle
# kurulmuş bir sisteme ilk kez geliyor) mevcut kurulum benimsenir; çalışan
# node_modules/ortam silinip yeniden kurulmaz.
deps_changed() {
  local name="$1" dir="$2"; shift 2
  [ -d "$dir" ] || return 0

  local current stored=""
  current="$(cd "$ROOT" && hash_of "$@")"
  [ -f "$STATE_DIR/$name.sha" ] && stored="$(cat "$STATE_DIR/$name.sha")"

  if [ -z "$stored" ]; then
    if [ "$DRY_RUN" -eq 0 ]; then
      mkdir -p "$STATE_DIR"
      printf '%s\n' "$current" > "$STATE_DIR/$name.sha"
    fi
    return 1
  fi

  [ "$current" != "$stored" ]
}

mark_deps() {
  local name="$1"; shift
  mkdir -p "$STATE_DIR"
  (cd "$ROOT" && hash_of "$@") > "$STATE_DIR/$name.sha"
}

preflight() {
  log "Ön kontrol"
  [ "$(id -u)" -ne 0 ] || die "root olarak çalıştırmayın (dosya sahipleri bozulur); normal kullanıcıyla çalıştırın"
  [ -d "$ROOT/.git" ] || die "git deposu bulunamadı: $ROOT"

  load_node
  local missing=()
  for cmd in git node npm pm2 curl python3; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done
  [ "${#missing[@]}" -eq 0 ] || die "eksik komutlar: ${missing[*]}"
  [ -x "$PYTHON" ] || die "Python ortamı bulunamadı: $PYTHON (ZENITH_PYTHON ile belirtin)"

  # Canlı veritabanı izlenen bir dosya; çalışırken değişmesi normaldir, sayılmaz.
  local dirty
  dirty="$(git -C "$ROOT" -c core.fileMode=false status --porcelain --untracked-files=no \
    | grep -v ' backend/zenith\.sqlite$' || true)"
  if [ -n "$dirty" ]; then
    printf '%s\n' "$dirty" >&2
    die "izlenen dosyalarda commit edilmemiş değişiklik var; güncelleme iptal edildi"
  fi
}

resolve_target() {
  log "Sürüm bilgisi alınıyor"
  git -C "$ROOT" fetch --quiet --tags origin
  PREVIOUS="$(git -C "$ROOT" rev-parse HEAD)"
  if [ -n "$REF" ]; then
    TARGET="$(git -C "$ROOT" rev-parse --verify --quiet "$REF^{commit}")" \
      || die "referans bulunamadı: $REF"
  else
    TARGET="$(git -C "$ROOT" rev-parse origin/master)"
  fi
  printf '    mevcut: %s\n    hedef : %s\n' "${PREVIOUS:0:10}" "${TARGET:0:10}"
}

artifacts_present() {
  [ -f "$ROOT/backend/dist/main.js" ] && [ -f "$ROOT/frontend/dist/index.html" ]
}

backup_database() {
  [ "$DO_BACKUP" -eq 1 ] || return 0
  log "Veritabanı yedeği"
  run "$ROOT/scripts/backup-db.sh"
}

tracked_in() { git -C "$ROOT" cat-file -e "$1:$DB_REL" 2>/dev/null; }

# Canlı veritabanı eski sürümlerde git'te izleniyordu; yeni sürümde izlenmiyor
# (ya da geri alırken tersi). git bu dosyayı silmeye/ezmeye çalışacağı için,
# sürüm geçişi sırasında dosya kenara alınır ve işlem bitince geri konur.
# Backend önce durdurulur ve WAL, ana dosyaya işlenir; böylece kopya tutarlıdır.
rescue_database() {
  local db="$ROOT/$DB_REL"
  [ -f "$db" ] || return 0
  tracked_in HEAD || tracked_in "$TARGET" || return 0

  log "Veritabanı git takibi değişiyor; dosya korumaya alınıyor"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "    [dry-run] backend durdur, WAL checkpoint, $DB_REL kenara al ve geri koy"
    return 0
  fi

  pm2 stop zenith-backend >/dev/null 2>&1 || true
  python3 - "$db" <<'PY' || warn "WAL checkpoint yapılamadı; dosya olduğu gibi kopyalanıyor"
import sqlite3
import sys

connection = sqlite3.connect(sys.argv[1])
connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
connection.close()
PY

  mkdir -p "$STATE_DIR"
  DB_RESCUE="$STATE_DIR/zenith.sqlite.rescue"
  cp -p "$db" "$DB_RESCUE"

  # Bir adım başarısız olursa da dosya yerine konsun.
  trap restore_database EXIT

  if tracked_in HEAD; then
    git -C "$ROOT" checkout --quiet -- "$DB_REL"   # izlenen kopyayı temiz hâle getir
  else
    rm -f "$db"                                     # hedef izliyorsa çakışmasın
  fi
}

restore_database() {
  [ -n "$DB_RESCUE" ] || return 0
  local db="$ROOT/$DB_REL"
  mkdir -p "$(dirname "$db")"   # git, boşalan dizini silmiş olabilir
  mv -f "$DB_RESCUE" "$db"
  rm -f "$db-wal" "$db-shm"   # eski kopyaya ait artık WAL dosyaları
  DB_RESCUE=""
  echo "    veritabanı geri yüklendi: $DB_REL"
}

update_source() {
  log "Kaynak kod güncelleniyor"
  rescue_database
  if [ -n "$REF" ]; then
    run git -C "$ROOT" checkout --quiet --detach "$TARGET"
  else
    local branch
    branch="$(git -C "$ROOT" symbolic-ref --quiet --short HEAD || true)"
    [ "$branch" = "master" ] || run git -C "$ROOT" checkout --quiet master
    run git -C "$ROOT" merge --quiet --ff-only "$TARGET"
  fi
  restore_database
}

install_dependencies() {
  log "Bağımlılıklar"
  if deps_changed backend "$ROOT/backend/node_modules" backend/package-lock.json; then
    echo "    backend: npm ci"
    (cd "$ROOT/backend" && run npm ci --no-audit --no-fund)
    [ "$DRY_RUN" -eq 1 ] || mark_deps backend backend/package-lock.json
  else
    echo "    backend: değişmedi"
  fi

  if deps_changed frontend "$ROOT/frontend/node_modules" frontend/package-lock.json; then
    echo "    frontend: npm ci"
    (cd "$ROOT/frontend" && run npm ci --no-audit --no-fund)
    [ "$DRY_RUN" -eq 1 ] || mark_deps frontend frontend/package-lock.json
  else
    echo "    frontend: değişmedi"
  fi

  local py_files=(ai-service/requirements.txt)
  [ -f "$ROOT/ai-service/requirements.lock" ] && py_files+=(ai-service/requirements.lock)
  if deps_changed ai-service "$ROOT/ai-service" "${py_files[@]}"; then
    echo "    ai-service: pip install"
    local constraint=()
    [ -f "$ROOT/ai-service/requirements.lock" ] && constraint=(-c "$ROOT/ai-service/requirements.lock")
    run "$PYTHON" -m pip install --quiet -r "$ROOT/ai-service/requirements.txt" "${constraint[@]}"
    [ "$DRY_RUN" -eq 1 ] || mark_deps ai-service "${py_files[@]}"
  else
    echo "    ai-service: değişmedi"
  fi
}

# run_suite <ad> <klasör> <komut...>: çıktıyı dosyaya alır; yalnızca başarısız
# olursa son satırları gösterir.
run_suite() {
  local name="$1" dir="$2"; shift 2
  local logfile="$STATE_DIR/test-$name.log"

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '    [dry-run] (%s) %s
' "$name" "$*"
    return 0
  fi

  mkdir -p "$STATE_DIR"
  if (cd "$dir" && "$@") > "$logfile" 2>&1; then
    echo "    $name: geçti ($(grep -Eo 'Ran [0-9]+ tests?|Tests: +[0-9]+ passed' "$logfile" | head -1))"
  else
    tail -n 40 "$logfile" >&2
    die "$name testleri başarısız (tam çıktı: $logfile)"
  fi
}

run_tests() {
  [ "$RUN_TESTS" -eq 1 ] || { warn "testler atlandı (--skip-tests)"; return 0; }
  log "Testler"
  run_suite ai-service "$ROOT/ai-service" "$PYTHON" -m unittest discover
  run_suite backend "$ROOT/backend" npm test --silent
}

build_all() {
  log "Derleme"
  (cd "$ROOT/backend" && run npm run build --silent)
  # /tmp küçük bir tmpfs olabilir; büyük geçici dosyalar için disk kullan.
  mkdir -p "$HOME/.cache/zenith-tmp"
  (cd "$ROOT/frontend" && TMPDIR="$HOME/.cache/zenith-tmp" run npm run build --silent)
}

restart_services() {
  log "Servisler yeniden başlatılıyor"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "    [dry-run] pm2 delete ${APPS[*]}; pm2 start ecosystem.config.js; pm2 save"
    return 0
  fi

  # delete + start: yalnızca ortam değil, args/script değişiklikleri de uygulansın.
  for app in "${APPS[@]}"; do
    pm2 delete "$app" >/dev/null 2>&1 || true
  done
  (cd "$ROOT" && pm2 start ecosystem.config.js >/dev/null)
  pm2 save >/dev/null
}

# Tüm uygulamalar online mi ve yeniden başlama sayısı artmıyor mu?
apps_healthy() {
  pm2 jlist 2>/dev/null | python3 -c '
import json, sys
wanted = set(sys.argv[1:])
apps = {p["name"]: p["pm2_env"] for p in json.load(sys.stdin)}
bad = [n for n in wanted if apps.get(n, {}).get("status") != "online"]
sys.exit(1 if bad else 0)' "${APPS[@]}"
}

restart_counts() {
  pm2 jlist 2>/dev/null | python3 -c '
import json, sys
wanted = set(sys.argv[1:])
for p in json.load(sys.stdin):
    if p["name"] in wanted:
        print(p["name"], p["pm2_env"].get("restart_time", 0))' "${APPS[@]}" | sort
}

health_check() {
  log "Sağlık kontrolü (en fazla ${HEALTH_TIMEOUT} sn)"
  [ "$DRY_RUN" -eq 0 ] || { echo "    [dry-run] atlandı"; return 0; }

  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  until curl -fsS --max-time 3 "$BACKEND_HEALTH_URL" >/dev/null 2>&1 \
     && curl -fsS --max-time 3 -o /dev/null "$FRONTEND_URL" 2>/dev/null \
     && apps_healthy; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      return 1
    fi
    sleep 2
  done

  # Açılışta çöküp yeniden başlayan servisleri yakalamak için kısa bir bekleme.
  local before after
  before="$(restart_counts)"
  sleep 10
  after="$(restart_counts)"
  [ "$before" = "$after" ] && apps_healthy
}

report_failure() {
  warn "Sağlık kontrolü başarısız."
  pm2 ls || true
  for app in "${APPS[@]}"; do
    pm2 jlist 2>/dev/null | python3 -c '
import json, sys
name = sys.argv[1]
for p in json.load(sys.stdin):
    if p["name"] == name and p["pm2_env"].get("status") != "online":
        print(p["pm2_env"].get("pm_err_log_path", ""))' "$app" | while read -r errlog; do
      [ -n "$errlog" ] && { warn "$app son hata satırları:"; tail -n 8 "$errlog" >&2 || true; }
    done
  done
  warn "Önceki sürüme dönmek için:  $ROOT/scripts/deploy.sh --ref $PREVIOUS"
}

main() {
  local started=$SECONDS
  preflight
  resolve_target

  if [ "$TARGET" = "$PREVIOUS" ] && [ "$FORCE" -eq 0 ] && artifacts_present; then
    log "Zaten güncel (${TARGET:0:10}); yapılacak bir şey yok. Yeniden derlemek için --force."
    exit 0
  fi

  backup_database
  update_source
  install_dependencies
  run_tests
  build_all
  restart_services

  if health_check; then
    if [ "$DRY_RUN" -eq 0 ]; then
      mkdir -p "$STATE_DIR"
      printf '%s\n' "$PREVIOUS" > "$STATE_DIR/previous-deploy.sha"
    fi
    log "Tamam: ${PREVIOUS:0:10} -> ${TARGET:0:10} ($((SECONDS - started)) sn)"
  else
    report_failure
    exit 1
  fi
}

# Betik kendi kendini `git merge` ile güncelleyebilir; bash dosyayı artımlı
# okuduğu için `main` ve `exit` aynı satırda olmalı (sonrası okunmasın).
main; exit $?
