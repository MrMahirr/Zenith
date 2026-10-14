#!/usr/bin/env bash
# Zenith veritabanı yedeği.
#
# SQLite'ın "online backup" API'sini kullanır; servisler çalışırken tutarlı bir
# kopya alır, bütünlüğünü doğrular, sıkıştırır ve eski kopyaları siler.
#
# Ortam değişkenleri:
#   ZENITH_DB_PATH      yedeklenecek veritabanı  (varsayılan: <repo>/backend/zenith.sqlite)
#   ZENITH_BACKUP_DIR   yedek klasörü            (varsayılan: ~/zenith-backups)
#   ZENITH_BACKUP_KEEP  saklanacak kopya sayısı  (varsayılan: 7)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${ZENITH_DB_PATH:-$ROOT/backend/zenith.sqlite}"
BACKUP_DIR="${ZENITH_BACKUP_DIR:-$HOME/zenith-backups}"
KEEP="${ZENITH_BACKUP_KEEP:-7}"

log() { printf '%s [yedek] %s\n' "$(date '+%F %T')" "$*"; }
die() { log "HATA: $*" >&2; exit 1; }

[ -f "$DB_PATH" ] || die "veritabanı bulunamadı: $DB_PATH"
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || die "ZENITH_BACKUP_KEEP pozitif tam sayı olmalı: $KEEP"
command -v python3 >/dev/null || die "python3 gerekli"

mkdir -p "$BACKUP_DIR"
stamp="$(date +%F_%H%M%S)"
raw="$BACKUP_DIR/.zenith-$stamp.sqlite.partial"
target="$BACKUP_DIR/zenith-$stamp.sqlite.gz"
trap 'rm -f "$raw" "$target.partial"' EXIT

python3 - "$DB_PATH" "$raw" <<'PY'
import sqlite3
import sys

source_path, destination_path = sys.argv[1:3]

source = sqlite3.connect(source_path)
destination = sqlite3.connect(destination_path)
try:
    source.backup(destination)
    verdict = destination.execute("PRAGMA integrity_check").fetchone()[0]
finally:
    destination.close()
    source.close()

if verdict != "ok":
    sys.exit(f"yedek bütünlük kontrolünden geçmedi: {verdict}")
PY

gzip -c "$raw" > "$target.partial"
mv "$target.partial" "$target"
log "alındı: $target ($(du -h "$target" | cut -f1))"

# Yalnızca bu betiğin ürettiği dosyalar silinir; elle alınan yedeklere dokunulmaz.
mapfile -t stale < <(ls -1t "$BACKUP_DIR"/zenith-*.sqlite.gz 2>/dev/null | tail -n +"$((KEEP + 1))")
if [ "${#stale[@]}" -gt 0 ]; then
  rm -f -- "${stale[@]}"
  log "${#stale[@]} eski yedek silindi (son $KEEP saklanıyor)"
fi
