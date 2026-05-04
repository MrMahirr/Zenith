import os
import urllib.request
from urllib.parse import urlsplit, urlunsplit

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*_args, **_kwargs):
        print("[Config] python-dotenv bulunamadi. Ortam degiskenleri .env olmadan okunacak.")


load_dotenv()


def _default_health_url(base_url):
    parsed = urlsplit(base_url)
    return urlunsplit((parsed.scheme, parsed.netloc, "/api/health", "", ""))


def _get_camera_candidates():
    candidates = [
        os.getenv("CAMERA_URL", "").strip(),
        os.getenv("CAMERA_URL_1", "").strip(),
        os.getenv("CAMERA_URL_2", "").strip(),
    ]

    unique_candidates = []
    for url in candidates:
        if url and url not in unique_candidates:
            unique_candidates.append(url)
    return unique_candidates


def _get_active_camera_url():
    """Env'deki kamera URL'lerini dener, aktif olani dondurur."""
    candidates = _get_camera_candidates()

    if not candidates:
        fallback_url = "http://127.0.0.1:4747/video"
        print("[Config] UYARI: .env icinde kamera URL tanimi yok. Varsayilan URL kullaniliyor.")
        return fallback_url

    print("[Config] Aktif kamera araniyor...")

    for url in candidates:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as response:
                if response.getcode() == 200:
                    print(f"[Config] Kamera bulundu: {url}")
                    return url
        except Exception:
            continue

    print(f"[Config] UYARI: Hicbir kamera aktif degil. Ilk .env kaydi kullaniliyor: {candidates[0]}")
    return candidates[0]


BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:3000")
BACKEND_HEALTH_URL = os.getenv(
    "BACKEND_HEALTH_URL",
    _default_health_url(BACKEND_URL),
)
BACKEND_RETRY_INTERVAL = float(os.getenv("BACKEND_RETRY_INTERVAL", "2"))
BACKEND_WAIT_TIMEOUT = float(os.getenv("BACKEND_WAIT_TIMEOUT", "0"))

CAMERA_URL = _get_active_camera_url()
POSTURE_THRESHOLD = float(os.getenv("POSTURE_THRESHOLD", "0.15"))
POSTURE_EVENT_INTERVAL = float(os.getenv("POSTURE_EVENT_INTERVAL", "5"))
CAMERA_RECONNECT_DELAY = float(os.getenv("CAMERA_RECONNECT_DELAY", "2"))
CAMERA_FRAME_EMIT_INTERVAL = float(os.getenv("CAMERA_FRAME_EMIT_INTERVAL", "0.2"))

I2C_PORT = int(os.getenv("I2C_PORT", "3"))
BME280_ADDRESS = int(os.getenv("BME280_ADDRESS", "0x76"), 16)

LED_COUNT = int(os.getenv("LED_COUNT", "60"))
LED_PIN = int(os.getenv("LED_PIN", "18"))
LED_FREQ_HZ = 800000
LED_DMA = int(os.getenv("LED_DMA", "5"))
LED_BRIGHTNESS = int(os.getenv("LED_BRIGHTNESS", "128"))
LED_INVERT = False
LED_CHANNEL = 0

NFC_MODES = {
    int(os.getenv("NFC_CARD_1", "83749274923")): "CODING",
    int(os.getenv("NFC_CARD_2", "29384729384")): "FOCUS",
    int(os.getenv("NFC_CARD_3", "11223344556")): "RELAX",
    int(os.getenv("NFC_CARD_4", "99887766554")): "MEETING",
}
