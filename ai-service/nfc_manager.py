"""MFRC522 okuyucudan kart okuyup backend'e bildiren servis."""

import logging
import threading
import time

from config import NFC_POLL_INTERVAL, NFC_REPEAT_COOLDOWN
from connection_manager import ConnectionManager

log = logging.getLogger("zenith.nfc")

_VERSION_REGISTER = 0x37
_ERROR_RETRY_SECONDS = 1.0
_NO_HARDWARE_WAIT_SECONDS = 60.0


class NFCManager:
    def __init__(self):
        self.conn = ConnectionManager()
        self.has_hardware = False

        self._reader = None
        self._gpio = None
        self._stop_event = threading.Event()
        self._thread = None

        self._last_uid = None
        self._last_seen_at = 0.0

    # --- Donanim -------------------------------------------------------------

    def _initialize_hardware(self):
        try:
            import RPi.GPIO as GPIO
            from mfrc522 import SimpleMFRC522

            self._gpio = GPIO
            self._reader = SimpleMFRC522()
        except Exception as exc:
            log.error(
                "Donanim surucusu yuklenemedi, kart okunmayacak: %s: %s",
                exc.__class__.__name__, exc,
            )
            return

        self.has_hardware = True
        self._verify_spi()

    def _verify_spi(self):
        """Surum register'ini okuyarak SPI baglantisinin saglam oldugunu dogrular."""
        try:
            version = self._reader.READER.Read_MFRC522(_VERSION_REGISTER)
        except Exception as exc:
            log.warning("Versiyon okuma basarisiz: %s", exc)
            return

        if version in (0x00, 0xFF):
            log.error(
                "SPI iletisimi basarisiz (versiyon 0x%02X). "
                "Kablolari ve MISO/MOSI baglantilarini kontrol edin.",
                version,
            )
        else:
            log.info("MFRC522 hazir. Cihaz versiyonu: 0x%02X", version)

    # --- Yasam dongusu -------------------------------------------------------

    def start(self):
        self._stop_event.clear()
        self._initialize_hardware()

        self._thread = threading.Thread(
            target=self._read_loop, name="nfc-reader", daemon=True
        )
        self._thread.start()
        log.info("Kart okuyucu servisi baslatildi.")

    def _read_loop(self):
        if not self.has_hardware:
            while not self._stop_event.wait(_NO_HARDWARE_WAIT_SECONDS):
                pass
            return

        while not self._stop_event.is_set():
            try:
                # read_id() kart gelene kadar beklemesiz donerek CPU'yu %100
                # tuketir; bu yuzden bloklamayan surum kisa bir beklemeyle sorgulanir.
                card_id = self._reader.read_id_no_block()
            except Exception as exc:
                log.error("Okuma hatasi: %s", exc)
                self._stop_event.wait(_ERROR_RETRY_SECONDS)
                continue

            if card_id:
                self._handle_card(str(card_id))

            self._stop_event.wait(NFC_POLL_INTERVAL)

    def _handle_card(self, uid):
        now = time.monotonic()
        previous_seen_at = self._last_seen_at
        previous_uid = self._last_uid

        # Kart okuyucunun ustunde durdukca "son gorulme" yenilenir, boylece
        # tekrar tetiklenmez; cekilip cooldown dolunca yeniden bildirilir.
        self._last_uid = uid
        self._last_seen_at = now

        if uid == previous_uid and now - previous_seen_at < NFC_REPEAT_COOLDOWN:
            return

        log.info("Okunan kart ID: %s", uid)
        self.conn.emit("nfc_chip_scanned", {"uid": uid})

    def stop(self):
        self._stop_event.set()

        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=1.5)

        if self._gpio is not None:
            try:
                self._gpio.cleanup()
            except Exception:
                pass

        log.info("Servis durduruldu.")
