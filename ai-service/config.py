"""Zenith AI servisi yapilandirmasi.

Tum degerler ortam degiskenlerinden (veya .env dosyasindan) okunur. Gecersiz bir
deger verilirse uyari loglanir ve varsayilan deger kullanilir.
"""

import logging
import os

try:
    from dotenv import load_dotenv
except ImportError:  # python-dotenv kurulu degilse ortam degiskenleri yeterli
    def load_dotenv(*_args, **_kwargs):
        return False


load_dotenv()

_log = logging.getLogger("zenith.config")

_TRUE_VALUES = {"1", "true", "yes", "on"}
_FALSE_VALUES = {"0", "false", "no", "off"}


def _raw(name):
    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def _to_int(raw):
    """Ondalik veya 0x onekli onaltilik tamsayiyi cevirir."""
    return int(raw, 16) if raw.lower().startswith("0x") else int(raw)


def _parse_number(name, default, cast, minimum, maximum):
    raw = _raw(name)
    if raw is None:
        return default

    try:
        value = cast(raw)
    except ValueError:
        _log.warning("%s gecersiz (%r); varsayilan kullaniliyor: %r", name, raw, default)
        return default

    if (minimum is not None and value < minimum) or (
        maximum is not None and value > maximum
    ):
        _log.warning(
            "%s aralik disi (%r, izin verilen %r..%r); varsayilan kullaniliyor: %r",
            name, value, minimum, maximum, default,
        )
        return default

    return value


def env_str(name, default=""):
    raw = _raw(name)
    return default if raw is None else raw


def env_int(name, default, minimum=None, maximum=None):
    return _parse_number(name, default, _to_int, minimum, maximum)


def env_float(name, default, minimum=None, maximum=None):
    return _parse_number(name, default, float, minimum, maximum)


def env_bool(name, default=False):
    raw = _raw(name)
    if raw is None:
        return default

    lowered = raw.lower()
    if lowered in _TRUE_VALUES:
        return True
    if lowered in _FALSE_VALUES:
        return False

    _log.warning("%s gecersiz (%r); varsayilan kullaniliyor: %r", name, raw, default)
    return default


def env_url_list(*names):
    """Verilen ortam degiskenlerindeki bos olmayan adresleri sirayi bozmadan tekilleştirir."""
    urls = []
    for name in names:
        value = _raw(name)
        if value and value not in urls:
            urls.append(value)
    return tuple(urls)


def _default_health_url(base_url):
    from urllib.parse import urlsplit, urlunsplit

    parsed = urlsplit(base_url)
    return urlunsplit((parsed.scheme, parsed.netloc, "/api/health", "", ""))


# --- Genel -------------------------------------------------------------------
LOG_LEVEL = env_str("LOG_LEVEL", "INFO").upper()
# Gercek donanim yokken sahte sensor verisi uretir. Yalnizca gelistirme icindir;
# uretimde kapali kalmali, aksi halde sahte olcumler veritabanina yazilir.
SIMULATE_HARDWARE = env_bool("SIMULATE_HARDWARE", False)

# --- Backend baglantisi ------------------------------------------------------
BACKEND_URL = env_str("BACKEND_URL", "http://127.0.0.1:3000")
BACKEND_HEALTH_URL = env_str("BACKEND_HEALTH_URL", _default_health_url(BACKEND_URL))
BACKEND_RETRY_INTERVAL = env_float("BACKEND_RETRY_INTERVAL", 2.0, minimum=0.1)
BACKEND_WAIT_TIMEOUT = env_float("BACKEND_WAIT_TIMEOUT", 0.0, minimum=0.0)

# --- Kamera ve postur --------------------------------------------------------
# Kaynaklar sirayla denenir; baglanti koparsa bir sonraki adaya gecilir.
CAMERA_URLS = env_url_list("CAMERA_URL", "CAMERA_URL_1", "CAMERA_URL_2") or (
    "http://127.0.0.1:4747/video",
)
CAMERA_CONNECT_TIMEOUT = env_float("CAMERA_CONNECT_TIMEOUT", 3.0, minimum=0.5)
CAMERA_RECONNECT_DELAY = env_float("CAMERA_RECONNECT_DELAY", 2.0, minimum=0.1)

MJPEG_HOST = env_str("MJPEG_HOST", "0.0.0.0")
MJPEG_PORT = env_int("MJPEG_PORT", 5001, minimum=1, maximum=65535)

POSTURE_THRESHOLD = env_float("POSTURE_THRESHOLD", 0.15)
POSTURE_EVENT_INTERVAL = env_float("POSTURE_EVENT_INTERVAL", 5.0, minimum=0.0)
# MediaPipe her N. karede bir calistirilir (CPU tasarrufu).
POSTURE_ANALYSIS_FRAME_STEP = env_int("POSTURE_ANALYSIS_FRAME_STEP", 3, minimum=1)
# Burun/omuz noktalarinin gorunurluk esigi; altindaysa olcum guvenilmez sayilir.
POSTURE_MIN_VISIBILITY = env_float("POSTURE_MIN_VISIBILITY", 0.5, minimum=0.0, maximum=1.0)

# --- Sensorler ---------------------------------------------------------------
I2C_PORT = env_int("I2C_PORT", 3, minimum=0)
BME280_ADDRESS = env_int("BME280_ADDRESS", 0x76, minimum=0x03, maximum=0x77)
SENSOR_READ_INTERVAL = env_float("SENSOR_READ_INTERVAL", 15.0, minimum=1.0)
# Art arda bu kadar okuma hatasindan sonra I2C yeniden acilir.
SENSOR_MAX_CONSECUTIVE_ERRORS = env_int("SENSOR_MAX_CONSECUTIVE_ERRORS", 3, minimum=1)
SENSOR_REINIT_DELAY = env_float("SENSOR_REINIT_DELAY", 10.0, minimum=1.0)

# --- MQ135 / ADS1115 ---
# ADS1115'in besleme gerilimi; MQ135 AO bunun +0.3 V'unu asarsa cip zarar gorur.
ADS1115_SUPPLY_VOLTS = env_float("ADS1115_SUPPLY_VOLTS", 3.3, minimum=1.8, maximum=5.5)
# MQ135 modulunun besleme gerilimi (goreli indeks hesabinda kullanilir).
MQ135_VCC_VOLTS = env_float("MQ135_VCC_VOLTS", 5.0, minimum=3.0, maximum=6.0)

# --- LED ---------------------------------------------------------------------
LED_COUNT = env_int("LED_COUNT", 60, minimum=1)
LED_PIN = env_int("LED_PIN", 18, minimum=0)
LED_FREQ_HZ = 800000
LED_DMA = env_int("LED_DMA", 5, minimum=0)
LED_BRIGHTNESS = env_int("LED_BRIGHTNESS", 128, minimum=0, maximum=255)
LED_INVERT = False
LED_CHANNEL = 0
# Seridin cekebilecegi en yuksek akim (mA); asilirsa parlaklik otomatik kisilir.
# Pi'nin 5V hattindan beslenen kurulumlarda dusuk gerilimi onler. 0 = sinirsiz
# (serit ayri bir 5V kaynaktan besleniyorsa).
LED_MAX_CURRENT_MA = env_int("LED_MAX_CURRENT_MA", 1000, minimum=0)

# --- NFC ---------------------------------------------------------------------
# mfrc522 kutuphanesi kart yokken her sorguda ~2000 SPI okumasi yapar (~90 ms);
# aralik kisaldikca CPU artar. 0.5 sn, dokunarak okutma icin yeterince duyarlidir.
NFC_POLL_INTERVAL = env_float("NFC_POLL_INTERVAL", 0.5, minimum=0.05)
# Ayni kart, en son gorulmesinden bu kadar saniye gecmeden tekrar bildirilmez.
NFC_REPEAT_COOLDOWN = env_float("NFC_REPEAT_COOLDOWN", 3.0, minimum=0.0)
