# Zenith Smart Room

**Zenith Smart Room**, çalışma odasını "akıllı, duyarlı ve sağlığa odaklı" bir ortama dönüştüren IoT projesidir. Bir Raspberry Pi üzerinde çalışır; kameradan postürü, sensörlerden oda havasını, NFC kartlardan çalışma modunu okur ve hepsini 7 inç dokunmatik ekranda tek panelde gösterir.

- **Postür analizi:** Kamera görüntüsü MediaPipe ile analiz edilir; kambur duruşta arayüz uyarır ve LED şerit kırmızıya döner.
- **Ortam farkındalığı:** BME280 (sıcaklık, nem, basınç) ve MQ135 (gaz) verileri anlık izlenir, geçmişe dönük grafikler sunulur.
- **Modlar (NFC):** Kart okutarak oda modu değiştirilir (CODING, FOCUS, RELAX, MEETING, PASSIVE); her mod WS2812B LED şeride kendi rengini verir.
- **Panel:** React arayüzü 1024×600 ekrana göre tasarlanmıştır; Pi açılınca tam ekran kiosk olarak başlar.

## Mimari

```
 Kamera (DroidCam) ─┐
 BME280 / MQ135 ────┤                    ┌──────────────┐
 RC522 NFC ─────────┼─► ai-service ◄────►│   backend    │◄───► frontend (kiosk / tarayıcı)
 WS2812B LED ◄──────┘   (Python)  socket │  (NestJS +   │  REST + socket
                                         │   SQLite)    │
                                         └──────────────┘
```

| Bileşen | Teknoloji | Port | PM2 adı |
|---|---|---|---|
| Backend | NestJS, TypeORM, SQLite, Socket.io | 3000 | `zenith-backend` |
| Frontend | React, Vite | 4173 | `zenith-frontend` |
| Kamera / postür | Python, OpenCV, MediaPipe | 5001 (MJPEG) | `zenith-camera` |
| Sensör | Python (I2C) | — | `zenith-sensor` |
| NFC | Python (SPI) | — | `zenith-nfc` |
| LED | Python (rpi_ws281x, root gerekir) | — | `zenith-led` |

## Dizin yapısı

```
zenith-workspace/
├── ai-service/          # Python servisleri (kamera, sensör, NFC, LED) + testler
├── backend/             # NestJS REST API & WebSocket sunucusu
├── frontend/            # React + Vite paneli
├── scripts/             # kurulum, güncelleme, yedekleme, OS ayarı
├── deploy/systemd/      # günlük yedek zamanlayıcısı
├── ecosystem.config.js  # PM2 süreç tanımları (6 servis)
├── kiosk.sh             # açılışta tam ekran panel
└── zenith-kiosk.desktop # kiosk autostart girdisi
```

## Raspberry Pi'ye kurulum

Raspberry Pi OS (Debian, 64-bit) üzerinde:

```bash
git clone https://github.com/MrMahirr/Zenith.git ~/Zenith
cd ~/Zenith
scripts/install.sh --dry-run     # önce ne yapacağını gör
scripts/install.sh               # kur
sudo reboot
```

`install.sh` idempotenttir; tekrar çalıştırmak güvenlidir ve tamamlanmış adımları atlar. Sırasıyla: sistem paketleri → I2C/SPI ve yazılım I2C (bus 3) ayarları → Node 20 + PM2 → Miniforge + `zenith-ai` ortamı → `.env` dosyaları → bağımlılık/derleme → PM2 servisleri ve açılışta başlatma → LED sudo kuralı → kiosk autostart → günlük yedek zamanlayıcısı.

Kurulumdan sonra `backend/.env` ve `ai-service/.env` dosyalarını düzenleyin (hava durumu API anahtarı, kamera adresi). SD kart ömrü için işletim sistemi ayarlarına bakmak isterseniz:

```bash
scripts/optimize-pi-os.sh              # ne uygulanmış / ne eksik (salt okunur)
sudo scripts/optimize-pi-os.sh --apply # eksikleri uygula
```

## Güncelleme ve geri alma

```bash
cd ~/Zenith
scripts/deploy.sh                  # GitHub master'ına güncelle
scripts/deploy.sh --dry-run        # yalnızca ne yapılacağını göster
scripts/deploy.sh --ref <sha>      # belirli bir sürüme geç (geri alma)
```

Akış: ön kontrol → veritabanı yedeği → git güncelle → değiştiyse bağımlılıkları kur → testler → derleme → servisleri yeniden başlat → sağlık kontrolü. Sağlık kontrolü başarısız olursa betik önceki sürüme dönmek için gereken komutu yazdırır. Servisler yaklaşık 20–30 saniye boyunca yeniden başlar.

## Veritabanı yedeği

Günlük yedek (03:30, cihaz kapalıysa açılışta) `systemd` kullanıcı zamanlayıcısıyla alınır, son 7 kopya `~/zenith-backups/` altında saklanır.

```bash
scripts/backup-db.sh                          # elle yedek al
systemctl --user list-timers zenith-backup    # zamanlayıcı durumu

# Geri yükleme
pm2 stop zenith-backend
gunzip -c ~/zenith-backups/zenith-<tarih>.sqlite.gz > backend/zenith.sqlite
pm2 start zenith-backend
```

## Kamera adresi

Kamera adresi servis çalışırken **Kamera sayfasındaki "Kamera Adresi" kartından** değiştirilebilir (adres varsayılan olarak gizlidir, "Göster / Değiştir"e basınca açılır). Yalnızca IP girilirse `:4747` ve `/video` otomatik eklenir. Ayar veritabanında saklanır; "Varsayılana dön" ayarı silerek `ai-service/.env` içindeki `CAMERA_URL_1/2` adreslerine döner.

## Geliştirme ortamı

```bash
# Backend  (http://localhost:3000)
cd backend && npm ci && npm run start:dev

# Frontend (http://localhost:5173)
cd frontend && npm ci && npm run dev

# AI servisi — donanımsız geliştirme için sahte sensör verisiyle
cd ai-service && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
SIMULATE_HARDWARE=1 python main.py --service sensor     # camera | sensor | led | nfc
```

> `SIMULATE_HARDWARE=1` yalnızca geliştirme içindir; gerçek sistemde açılırsa sahte ölçümler veritabanına yazılır.

### Testler

```bash
cd ai-service && python -m unittest discover -v   # Python (donanım gerektirmez)
cd backend    && npm test                        # Jest birim testleri
node scripts/ws-led-smoke.js                     # çalışan backend'e WebSocket duman testi
```

## Yapılandırma

Ayarlar `.env` dosyalarından okunur; tüm anahtarlar ve açıklamaları için `backend/.env.example` ve `ai-service/.env.example` dosyalarına bakın. Öne çıkanlar:

| Anahtar | Dosya | Açıklama |
|---|---|---|
| `WEATHER_API_KEY`, `WEATHER_CITY` | backend | Hava durumu (OpenWeatherMap) |
| `CAMERA_URL_1`, `CAMERA_URL_2` | ai-service | Varsayılan kamera adayları |
| `POSTURE_THRESHOLD` | ai-service | Kambur duruş eşiği |
| `LED_COUNT`, `LED_PIN` | ai-service | LED şerit |
| `LOG_LEVEL` | ai-service | `DEBUG` / `INFO` / `WARNING` |

## Kiosk ekranı

Masaüstü oturumu açılınca `zenith-kiosk.desktop` → `kiosk.sh` çalışır: frontend hazır olana kadar bekler, Brave'i tam ekran açar, kapanırsa yeniden açar. Tarayıcı sürekli çökerse bekleme süresini katlar; bellek kullanımı (PSS) `ZENITH_KIOSK_MAX_MEM_MB` (varsayılan 1000) değerini art arda 3 kontrolde aşarsa yeniden başlatır. Log: `~/.cache/zenith/kiosk.log`.

## Sorun giderme

```bash
pm2 ls                                  # servis durumu
pm2 logs zenith-camera --lines 50       # servis logu
curl localhost:3000/api/health          # backend sağlığı
sudo i2cdetect -y 3                     # BME280 (0x76) + ADS1115 (0x48)
systemctl is-enabled pm2-root           # "disabled" olmalı (çift servis sorununu önler)
```

- **Servisler iki kez çalışıyor / port çakışması:** `pm2-root` servisi etkinse devre dışı bırakın; yalnızca kullanıcının PM2'si çalışmalıdır.
- **Kamera "çevrimdışı":** Telefondaki DroidCam açık ve aynı ağda mı? Adresi Kamera sayfasından kontrol edin.
- **MQ135 hep 0 V:** Sensörün VCC (5V), GND ve AO kablolarını kontrol edin; AO ADS1115'in A0 girişine gitmelidir.

## Script özeti

| Script | Ne yapar |
|---|---|
| `scripts/install.sh` | Sıfırdan kurulum (idempotent, `--dry-run`) |
| `scripts/deploy.sh` | Güncelleme / geri alma, sağlık kontrolü |
| `scripts/backup-db.sh` | Doğrulamalı, sıkıştırılmış veritabanı yedeği |
| `scripts/optimize-pi-os.sh` | SD kart ömrü / RAM ayarları (`--check`, `--apply`) |
| `scripts/ws-led-smoke.js` | WebSocket LED duman testi |
