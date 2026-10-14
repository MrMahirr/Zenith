"""WS281x LED seridini backend'den gelen komutlara gore suren servis."""

import logging
import os
import threading
import time

from config import (
    LED_BRIGHTNESS,
    LED_CHANNEL,
    LED_COUNT,
    LED_DMA,
    LED_FREQ_HZ,
    LED_INVERT,
    LED_MAX_CURRENT_MA,
    LED_PIN,
)
from connection_manager import ConnectionManager
from hardware_report import ERROR, OK, WARN, device
from led_color import BLACK, clamp_brightness, parse_duration_seconds, parse_hex_color
from led_power import limit_brightness

try:
    from rpi_ws281x import Color, PixelStrip

    LIBRARY_AVAILABLE = True
except ImportError:
    Color = None
    PixelStrip = None
    LIBRARY_AVAILABLE = False

log = logging.getLogger("zenith.led")

_SELF_TEST_COLOR = (0, 0, 255)
_SELF_TEST_SECONDS = 1.0
_EXPIRY_CHECK_SECONDS = 0.1


class LEDController:
    """Rengi/parlakligi tutar ve donanima yazar.

    Donanim yoksa (kutuphane eksik ya da root yetkisi yok) komutlar yine
    islenir ve durum tutulur; yalnizca fiziksel cikis uretilmez.
    """

    def __init__(self):
        self.conn = ConnectionManager()
        self.has_hardware = False

        self._strip = None
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._thread = None

        self._color = BLACK
        # Tabana donulur: sureli komutlar (ornegin 2 sn yesil) bitince ya da
        # uyari kalkinca gosterilen renk. Manuel renk ya da ortam isigi olabilir.
        self._base_color = BLACK
        self._brightness = LED_BRIGHTNESS
        self._expires_at = 0.0  # time.monotonic() cinsinden; 0 = sure siniri yok
        self._last_write_error = None
        # Donanim durum raporu
        self._init_error = None
        self._effective_brightness = self._brightness
        self._last_report = None

        self._initialize_hardware()

        self.conn.on("led_command", self._handle_command)
        self.conn.on("led_state_sync", self._handle_state_sync)
        self.conn.on_connect(self._on_backend_connected)

    # --- Donanim -------------------------------------------------------------

    def _initialize_hardware(self):
        if not LIBRARY_AVAILABLE:
            self._init_error = "rpi_ws281x kutuphanesi yok"
            log.warning("rpi_ws281x kutuphanesi bulunamadi; fiziksel LED surulmeyecek.")
            return

        if hasattr(os, "geteuid") and os.geteuid() != 0:
            self._init_error = "Root yetkisi yok (/dev/mem erisimi gerekir)"
            log.warning("Root yetkisi yok (/dev/mem erisimi gerekir); fiziksel LED surulmeyecek.")
            return

        try:
            strip = PixelStrip(
                LED_COUNT,
                LED_PIN,
                LED_FREQ_HZ,
                LED_DMA,
                LED_INVERT,
                self._brightness,
                LED_CHANNEL,
            )
            strip.begin()
        except Exception as exc:
            self._init_error = f"{exc.__class__.__name__}: {exc}"
            log.error(
                "Donanim baslatilamadi: %s: %s (ses cikisinin PWM ile cakismasi "
                "icin config.txt'te 'dtparam=audio=off' olmali)",
                exc.__class__.__name__, exc,
            )
            return

        self._strip = strip
        self.has_hardware = True
        log.info("Donanim hazir. GPIO=%s, LED_COUNT=%s", LED_PIN, LED_COUNT)

    def _render(self):
        """Mevcut renk ve parlakligi seride gosterir. `_lock` altinda cagrilmali."""
        if self._strip is None:
            return

        # Guc butcesi: yuksek parlaklik besleme gerilimini dusurur ve Pi'yi kisar.
        effective = limit_brightness(self._color, self._brightness, LED_COUNT, LED_MAX_CURRENT_MA)
        self._effective_brightness = effective

        try:
            packed = Color(*self._color)
            self._strip.setBrightness(effective)
            for index in range(self._strip.numPixels()):
                self._strip.setPixelColor(index, packed)
            self._strip.show()
            self._last_write_error = None
        except Exception as exc:
            message = f"{exc.__class__.__name__}: {exc}"
            if message != self._last_write_error:  # ayni hatayi tekrar tekrar basma
                log.error("Donanim yazma hatasi: %s", message)
                self._last_write_error = message

        self._publish_hardware_status()

    def _describe_hardware(self):
        if not self.has_hardware:
            return device("ws281x", "LED serit (WS2812B)", ERROR,
                          self._init_error or "Donanim baslatilamadi")
        if self._last_write_error:
            return device("ws281x", "LED serit (WS2812B)", ERROR, self._last_write_error)

        base = f"GPIO{LED_PIN}, {LED_COUNT} LED. Fiziksel baglanti yazilimla dogrulanamaz."
        if self._effective_brightness < self._brightness:
            percent = round(self._effective_brightness / 255 * 100)
            return device(
                "ws281x", "LED serit (WS2812B)", WARN,
                f"Guc siniri ({LED_MAX_CURRENT_MA} mA) nedeniyle parlaklik %{percent}'e dusuruldu. {base}",
            )
        return device("ws281x", "LED serit (WS2812B)", OK, base)

    def _publish_hardware_status(self, force=False):
        """Durum degistiyse (ya da `force` ise) backend'e bildirir."""
        report = [self._describe_hardware()]
        if not force and report == self._last_report:
            return

        self._last_report = report
        self.conn.emit("hardware_status", {"devices": report})

    def _on_backend_connected(self):
        self._request_state()
        self._publish_hardware_status(force=True)

    # --- Backend olaylari ----------------------------------------------------

    def _request_state(self):
        """Servis (yeniden) baglandiginda backend'deki son LED durumunu ister."""
        self.conn.emit("led_get_state")

    def _handle_command(self, data):
        if not isinstance(data, dict):
            log.warning("Gecersiz led_command yuku: %r", data)
            return

        color = parse_hex_color(data.get("color"))
        if color is None:
            log.warning("Gecersiz renk, komut yok sayildi: %r", data.get("color"))
            return

        brightness = clamp_brightness(data.get("brightness"))
        manual = data.get("type") == "MANUAL"
        # Manuel renk kalicidir; yalnizca diger komutlar sureli olabilir.
        duration = 0.0 if manual else parse_duration_seconds(data.get("duration"))

        with self._lock:
            self._color = color
            if manual:
                self._base_color = color
            if brightness is not None:
                self._brightness = brightness
            self._expires_at = time.monotonic() + duration if duration > 0 else 0.0
            self._render()

        log.debug("Komut uygulandi: renk=%s parlaklik=%s sure=%.1fs", color, brightness, duration)

    def _handle_state_sync(self, data):
        """Backend durumuyla senkronize olur (parlaklik degisimi, yeniden baglanma)."""
        if not isinstance(data, dict):
            return

        brightness = clamp_brightness(data.get("brightness"))

        with self._lock:
            if brightness is not None:
                self._brightness = brightness

            new_base = self._base_from_sync(data)
            if new_base is not None:
                old_base = self._base_color
                self._base_color = new_base
                # Gosterilen renk tabanı izliyorsa yeni tabana gec. Aktif bir
                # uyari (kirmizi) ya da sureli komut varsa ona dokunma; o bitince
                # yeni tabana donulur.
                if self._expires_at == 0.0 and self._color == old_base:
                    self._color = new_base

            self._render()

    @staticmethod
    def _base_from_sync(data):
        """Backend durumundan taban rengi cikarir; belirlenemezse None."""
        mode = data.get("mode")

        if mode == "manual":
            if data.get("isOn") is False:
                return BLACK
            color = parse_hex_color(data.get("color"))
            return color if data.get("isOn") is True and color is not None else None

        if mode == "auto":
            # Ortam isigi kapaliyken ambientColor null'dir: taban sondur.
            return parse_hex_color(data.get("ambientColor")) or BLACK

        return None

    # --- Yasam dongusu -------------------------------------------------------

    def start(self):
        self._stop_event.clear()
        self._self_test()

        self._thread = threading.Thread(
            target=self._expiry_loop, name="led-expiry", daemon=True
        )
        self._thread.start()
        log.info("Kontrol servisi baslatildi.")

    def _self_test(self):
        """Acilista seridin calistigini gosteren kisa mavi yanip sonme."""
        if not self.has_hardware:
            log.info("Self-test atlandi: donanim erisimi yok.")
            return

        log.info("Self-test: mavi yanip sonme.")
        with self._lock:
            previous = self._color
            self._color = _SELF_TEST_COLOR
            self._render()

        self._stop_event.wait(_SELF_TEST_SECONDS)

        with self._lock:
            # Test sirasinda yeni bir komut geldiyse onu ezme.
            if self._color == _SELF_TEST_COLOR:
                self._color = previous
            self._render()

    def _expiry_loop(self):
        """Sureli komutlarin (ornegin 2 sn yesil) suresi dolunca seridi sondurur."""
        while not self._stop_event.wait(_EXPIRY_CHECK_SECONDS):
            with self._lock:
                if self._expires_at and time.monotonic() >= self._expires_at:
                    self._color = self._base_color
                    self._expires_at = 0.0
                    self._render()

    def stop(self):
        self._stop_event.set()

        with self._lock:
            self._color = BLACK
            self._base_color = BLACK
            self._expires_at = 0.0
            self._render()

        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=1.5)

        log.info("Servis durduruldu.")
