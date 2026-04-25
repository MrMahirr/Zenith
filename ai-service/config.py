import os
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


BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:3000")
BACKEND_HEALTH_URL = os.getenv(
    "BACKEND_HEALTH_URL",
    _default_health_url(BACKEND_URL),
)
BACKEND_RETRY_INTERVAL = float(os.getenv("BACKEND_RETRY_INTERVAL", "2"))
BACKEND_WAIT_TIMEOUT = float(os.getenv("BACKEND_WAIT_TIMEOUT", "0"))

CAMERA_URL = os.getenv("CAMERA_URL", "http://192.168.6.28:4747/video")
POSTURE_THRESHOLD = float(os.getenv("POSTURE_THRESHOLD", "0.15"))
POSTURE_EVENT_INTERVAL = float(os.getenv("POSTURE_EVENT_INTERVAL", "5"))
CAMERA_RECONNECT_DELAY = float(os.getenv("CAMERA_RECONNECT_DELAY", "2"))
CAMERA_FRAME_EMIT_INTERVAL = float(os.getenv("CAMERA_FRAME_EMIT_INTERVAL", "0.2"))

I2C_PORT = int(os.getenv("I2C_PORT", "3"))
BME280_ADDRESS = int(os.getenv("BME280_ADDRESS", "0x76"), 16)

LED_COUNT = int(os.getenv("LED_COUNT", "55"))
LED_PIN = int(os.getenv("LED_PIN", "18"))
LED_FREQ_HZ = 800000
LED_DMA = 10
LED_BRIGHTNESS = 255
LED_INVERT = False
LED_CHANNEL = 0

NFC_MODES = {
    int(os.getenv("NFC_CARD_1", "83749274923")): "CODING",
    int(os.getenv("NFC_CARD_2", "29384729384")): "FOCUS",
    int(os.getenv("NFC_CARD_3", "11223344556")): "RELAX",
    int(os.getenv("NFC_CARD_4", "99887766554")): "MEETING",
}
