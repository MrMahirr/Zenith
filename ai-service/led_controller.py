import threading
import time

from config import (
    LED_BRIGHTNESS,
    LED_CHANNEL,
    LED_COUNT,
    LED_DMA,
    LED_FREQ_HZ,
    LED_INVERT,
    LED_PIN,
)
from connection_manager import ConnectionManager

try:
    from rpi_ws281x import Color, PixelStrip

    LIBRARY_AVAILABLE = True
except ImportError:
    LIBRARY_AVAILABLE = False

    def Color(r, g, b):
        return (r, g, b)

    PixelStrip = None
    print("[LED] rpi_ws281x kutuphanesi bulunamadi. Mock mod aktif.")


def hex_to_color(hex_str):
    if not hex_str or not hex_str.startswith("#"):
        return Color(0, 0, 0)

    hex_str = hex_str.lstrip("#")
    r, g, b = tuple(int(hex_str[i : i + 2], 16) for i in (0, 2, 4))
    return Color(r, g, b)


class LEDController:
    def __init__(self):
        self.conn = ConnectionManager()
        self.running = False
        self.thread = None
        self.current_color = Color(0, 0, 0)
        self.target_color = Color(0, 0, 0)
        self.animation_end_time = 0
        self.strip = None
        self.has_hardware = False
        self.hardware_error = None

        self._initialize_hardware()
        self.conn.on("led_command", self._handle_command)

    def _initialize_hardware(self):
        if not LIBRARY_AVAILABLE:
            return

        try:
            self.strip = PixelStrip(
                LED_COUNT,
                LED_PIN,
                LED_FREQ_HZ,
                LED_DMA,
                LED_INVERT,
                LED_BRIGHTNESS,
                LED_CHANNEL,
            )
            self.strip.begin()
            self.has_hardware = True
            print(f"[LED] Donanim hazir. GPIO={LED_PIN}, LED_COUNT={LED_COUNT}")
        except Exception as exc:
            self.strip = None
            self.has_hardware = False
            self.hardware_error = exc
            print(
                "[LED] Donanim baslatilamadi, mock moduna geciliyor: "
                f"{exc.__class__.__name__}: {exc}"
            )
            print(
                "[LED] Not: rpi_ws281x genelde /dev/mem erisimi icin root yetkisi ister."
            )

    def _handle_command(self, data):
        print(f"[LED] Komut alindi: {data}")
        color = hex_to_color(data.get("color", "#000000"))
        duration = data.get("duration", 0)

        self.target_color = color

        if duration > 0:
            self.animation_end_time = time.time() + (duration / 1000.0)
        else:
            self.animation_end_time = 0

        self._set_color(self.target_color)

    def _set_color(self, color):
        self.current_color = color

        if not self.has_hardware or self.strip is None:
            return

        try:
            for i in range(self.strip.numPixels()):
                self.strip.setPixelColor(i, color)
            self.strip.show()
        except Exception as exc:
            self.has_hardware = False
            self.hardware_error = exc
            print(f"[LED] Donanim yazma hatasi, mock moda geciliyor: {exc}")

    def start(self):
        self.running = True
        print("[LED] Kontrol servisi baslatildi...")
        self._set_color(Color(0, 0, 0))

        self.thread = threading.Thread(target=self._anim_loop, daemon=True)
        self.thread.start()

    def _anim_loop(self):
        while self.running:
            if self.animation_end_time > 0 and time.time() > self.animation_end_time:
                self._set_color(Color(0, 0, 0))
                self.animation_end_time = 0

            time.sleep(0.5)

    def stop(self):
        self.running = False
        self._set_color(Color(0, 0, 0))

        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.5)

        print("[LED] Servis durduruldu.")
