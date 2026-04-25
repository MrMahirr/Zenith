import os
from dotenv import load_dotenv

# .env dosyasını yükle
load_dotenv()

# Backend bağlantısı
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:3000")

# Kamera Ayarları
CAMERA_URL = os.getenv("CAMERA_URL", "http://192.168.6.28:4747/video")
POSTURE_THRESHOLD = float(os.getenv("POSTURE_THRESHOLD", "0.15"))

# Sensör Ayarları (I2C)
I2C_PORT = int(os.getenv("I2C_PORT", "3"))
BME280_ADDRESS = int(os.getenv("BME280_ADDRESS", "0x76"), 16)

# LED Ayarları
LED_COUNT = int(os.getenv("LED_COUNT", "55"))
LED_PIN = int(os.getenv("LED_PIN", "18"))  # GPIO pin 18 (PWM destekli)
LED_FREQ_HZ = 800000
LED_DMA = 10
LED_BRIGHTNESS = 255
LED_INVERT = False
LED_CHANNEL = 0

# NFC Kart Mod Eşleştirmeleri (Gerçek ID'leri buraya gireceksiniz)
NFC_MODES = {
    int(os.getenv("NFC_CARD_1", "83749274923")): "CODING",
    int(os.getenv("NFC_CARD_2", "29384729384")): "FOCUS",
    int(os.getenv("NFC_CARD_3", "11223344556")): "RELAX",
    int(os.getenv("NFC_CARD_4", "99887766554")): "MEETING"
}
