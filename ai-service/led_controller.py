import threading
import time
import os

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
        self._lock = threading.Lock()

        self._initialize_hardware()
        self.conn.on("led_command", self._handle_command)

    def _initialize_hardware(self):
        if not LIBRARY_AVAILABLE:
            return

        if hasattr(os, "geteuid") and os.geteuid() != 0:
            self.hardware_error = PermissionError(
                "LED servisi root olmadan calisiyor; /dev/mem erisimi yok."
            )
            print("[LED] Root yetkisi yok. Mock mod aktif; fiziksel LED surulmeyecek.")
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
        color_hex = data.get("color", "#000000")
        color = hex_to_color(color_hex)
        duration = data.get("duration", 0)
        brightness = data.get("brightness")

        self.target_color = color

        if duration > 0:
            self.animation_end_time = time.time() + (duration / 1000.0)
        else:
            self.animation_end_time = 0

        self._set_color(self.target_color, brightness)
        
        # Backend'e durum raporu gonder (istege bagli)
        self.conn.emit("led_state_report", {
            "color": color_hex,
            "brightness": brightness if brightness is not None else LED_BRIGHTNESS,
            "isOn": color_hex != "#000000" and color_hex != "#000"
        })

    def _set_color(self, color, brightness=None):
        self.current_color = color

        if not self.has_hardware or self.strip is None:
            return

        with self._lock:
            try:
                if brightness is not None:
                    # RPi WS281x kutuphanesinde setBrightness mevcuttur
                    self.strip.setBrightness(int(brightness))
                    
                for i in range(self.strip.numPixels()):
                    self.strip.setPixelColor(i, color)
                self.strip.show()
            except Exception as exc:
                self.has_hardware = False
                self.hardware_error = exc
                print(f"[LED] Donanim yazma hatasi (Muhtemelen DMA/PWM cakismasi): {exc}")
                print("[LED] Ipucu: Raspberry Pi'da ses (Audio) cikisi PWM ile cakısıyor olabilir.")
                print("[LED] /boot/config.txt icinde 'dtparam=audio=on' satirini 'off' yapmayi deneyin.")

    def start(self):
        self.running = True
        print("[LED] Kontrol servisi baslatildi...")
        
        # Donanim saglik testi (Self-test)
        self._self_test()

        self.thread = threading.Thread(target=self._anim_loop, daemon=True)
        self.thread.start()

    def _self_test(self):
        """Baslangicta donanimi test etmek icin kisa sureli mavi yakar."""
        if not self.has_hardware:
            print("[LED] Self-test atlandi: Donanim erisimi yok.")
            return

        print("[LED] Self-test baslatiliyor (Mavi goz kirpma)...")
        test_color = Color(0, 0, 255) # Mavi
        self._set_color(test_color)
        time.sleep(1.0)
        self._set_color(Color(0, 0, 0))
        print("[LED] Self-test tamamlandi.")

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
