# Zenith Smart Room

**Zenith Smart Room**, çalışma odasını "akıllı, duyarlı ve sağlığa odaklı" bir ortama dönüştüren IoT projesidir. Bir Raspberry Pi üzerinde çalışır; kameradan postürü, sensörlerden oda havasını, NFC kartlardan çalışma modunu okur ve hepsini 7 inç dokunmatik ekranda (resmi Raspberry Pi DSI ekranı, 800×480) tek panelde gösterir.

- **Postür analizi:** Kamera görüntüsü MediaPipe ile analiz edilir; kambur duruşta arayüz uyarır ve LED şerit kırmızıya döner.
- **Ortam farkındalığı:** BME280 (sıcaklık, nem, basınç) ve MQ135 (gaz) verileri anlık izlenir, geçmişe dönük grafikler sunulur.
- **Modlar (NFC):** Kart okutarak oda modu değiştirilir (CODING, FOCUS, RELAX, MEETING, PASSIVE); her mod WS2812B LED şeride kendi rengini verir.
- **Panel:** React arayüzü 800×480 ekrana göre doğrulanmıştır (daha büyük ekranlarda da çalışır); Pi açılınca tam ekran kiosk olarak başlar.

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
| Frontend | React, Vite (üretimde `serve` ile statik sunum) | 4173 | `zenith-frontend` |
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

## Veritabanı

SQLite dosyası `backend/zenith.sqlite` **git'te tutulmaz** (canlı veridir). Şema TypeORM migration'larıyla (`backend/src/database/migrations`) yönetilir: backend açılırken bekleyen migration'lar otomatik uygulanır, veritabanı yoksa sıfırdan kurulur. Yeni bir tablo/sütun eklerken yeni bir migration yazıp `migrations/index.ts` listesinin sonuna ekleyin. WAL modu açıktır (`*.sqlite-wal`/`-shm` dosyaları normaldir).

> Eski sürümden güncellerken `scripts/deploy.sh` canlı veritabanını otomatik korur. Pi'de elle `git pull` yapılırsa git, dosyayı ezmemek için işlemi reddeder; `scripts/deploy.sh` kullanın.

## LED, ortam ışığı ve modlar

LED durumu (manuel/otomatik, renk, parlaklık) ve aktif mod yeniden başlatmada korunur. **Ortam ışığı varsayılan olarak kapalıdır**: kapalıyken mod değişimi LED'i 5 saniye o modun renginde yakıp söndürür; **LED Kontrol** sayfasından "Ortam ışığı" açılırsa aktif modun rengi kalıcı yanar (Serbest modda sönük). Duruş uyarısı kırmızıdır, düzelince kısa yeşil gösterilir ve taban renge (ortam ışığı ya da kapalı) dönülür. LED'i elle yönetiyorsanız mod değişimi rengi ezmez.

Mod tanımları tek kaynaktan gelir: `GET /api/modes/config`. `GET /api/modes/stats` her modda geçirilen **süreyi (dakika)** döndürür.

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
cd frontend   && npm test                        # saf mantık testleri (Node >= 22.6)
cd frontend   && npm run lint                    # ESLint (0 hata beklenir)
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

## Ayarlar sayfası

Dashboard'daki mod menüsünden **Ayarlar**'a girilir:

- **Sistem** (sunucuda saklanır, servisler yeniden başlamadan uygulanır): duruş hassasiyeti (kambur eşiği), sensör okuma aralığı, hava durumu şehri. "Varsayılana dön" ayarı kaldırır ve `.env` değerlerine geri döner.
- **Ekran (bu cihaz)** (tarayıcıda saklanır): ekran koruyucu (belirli süre dokunulmazsa loş saat; dokununca ya da kambur uyarısında uyanır) ve gece modu (22:00–07:00 arası karartma). İkisi de varsayılan olarak kapalıdır.
- LED sayısı gibi donanım ayarları `ai-service/.env` ile değişir ve servis yeniden başlatılır.

Modlar dashboard'daki mod menüsünden ekrandan da değiştirilebilir (NFC kart olmadan).

Sunucu adresleri `frontend/src/config` içinde tek yerde hesaplanır. Panel Pi dışından açılacaksa build sırasında `VITE_BACKEND_URL` / `VITE_STREAM_URL` (ya da `VITE_BACKEND_PORT` / `VITE_STREAM_PORT`) verilebilir. Backend ile bağlantı koparsa ekranın üstünde uyarı görünür.

## Donanım durumu ve güç

**Ayarlar → Donanım durumu** kartı, her cihazın sağlığını gösterir: BME280, ADS1115, MQ135 sinyali, RC522, LED şerit, kamera akışı, **güç kaynağı** ve işlemci sıcaklığı. Bir kablo gevşediğinde ya da gerilim düştüğünde ana ekranda uyarı bandı çıkar.

- **Düşük gerilim:** `vcgencmd get_throttled` izlenir. LED şerit ve ekran aynı beslemeden çalışıyorsa Pi kısılabilir. En az 5V/3A adaptör kullanın; şeridi ayrı bir 5V kaynaktan beslemek en iyisidir.
- **LED güç sınırı:** `LED_MAX_CURRENT_MA` (varsayılan 1000 mA) aşılacaksa parlaklık otomatik kısılır; ayrı beslemeli kurulumda `0` yaparak kaldırın.
- **MQ135:** sensör ısındıktan (en az 10 dk) sonra temiz havada **Temiz havada kalibre et** düğmesine basın; hava kalitesi, kalibrasyon anına göre göreli bir indekse (0 = temiz) dönüşür. Kalibrasyon yokken eski dogrusal ölçek kullanılır. ADS1115 3.3V ile besleniyorsa MQ135 AO çıkışı 3.6 V'u aşmamalıdır; aşarsa kart uyarır (gerilim bölücü ekleyin ya da ADS1115'i 5V'tan besleyin, `ADS1115_SUPPLY_VOLTS`).
- **Ekran parlaklığı:** resmi DSI ekranın arka ışığı (`/sys/class/backlight`) yazılımdan ayarlanır; Ayarlar'dan gündüz ve gece (22:00–07:00) parlaklığı seçilir.
- `GET /api/hardware` aynı bilgiyi JSON olarak verir.

## Kiosk ekranı

Masaüstü oturumu açılınca `zenith-kiosk.desktop` → `kiosk.sh` çalışır: frontend hazır olana kadar bekler, Brave'i tam ekran açar, kapanırsa yeniden açar. Tarayıcı sürekli çökerse bekleme süresini katlar; bellek kullanımı (PSS) `ZENITH_KIOSK_MAX_MEM_MB` (varsayılan 1000) değerini art arda 3 kontrolde aşarsa yeniden başlatır. Log: `~/.cache/zenith/kiosk.log`.

## Sorun giderme

```bash
pm2 ls                                  # servis durumu
pm2 logs zenith-camera --lines 50       # servis logu
curl localhost:3000/api/health          # backend + veritabanı + bağlı servisler
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
