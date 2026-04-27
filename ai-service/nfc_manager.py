import threading
import time

from config import NFC_MODES
from connection_manager import ConnectionManager


class NFCManager:
    def __init__(self):
        self.conn = ConnectionManager()
        self.running = False
        self.thread = None
        self.reader = None
        self.gpio = None
        self.has_hardware = False
        self.hardware_error = None

    def _initialize_hardware(self):
        if self.reader is not None or self.hardware_error is not None:
            return

        try:
            import RPi.GPIO as GPIO
            from mfrc522 import SimpleMFRC522

            self.gpio = GPIO
            self.reader = SimpleMFRC522()
            self.has_hardware = True
            print("[NFC] MFRC522 donanimi hazir.")
        except Exception as exc:
            self.hardware_error = exc
            self.has_hardware = False
            print(
                "[NFC] Donanim surucusu yuklenemedi, mock moduna geciliyor: "
                f"{exc.__class__.__name__}: {exc}"
            )

    def start(self):
        self.running = True
        self._initialize_hardware()
        print("[NFC] Kart okuyucu servisi baslatildi...")

        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def _read_loop(self):
        while self.running:
            if self.has_hardware and self.reader is not None:
                try:
                    card_id, text = self.reader.read()
                    # Convert card_id to hex format for consistency (optional but recommended)
                    # SimpleMFRC522 returns integer ID.
                    uid_hex = hex(card_id)[2:].upper()
                    # Add colons for MAC-like format (e.g., AA:BB:CC:DD)
                    # MFRC522 typical ID length is 4 or 5 bytes
                    # If it's a simple integer, we can just send it as a string
                    uid_str = str(card_id)
                    
                    print(f"[NFC] Okunan Kart ID: {uid_str}")
                    
                    # Backend'e nfc_chip_scanned event'i gönder
                    self.conn.emit("nfc_chip_scanned", {"uid": uid_str})

                    time.sleep(2)
                except Exception as exc:
                    print(f"[NFC] Okuma hatasi: {exc}")
                    time.sleep(1)
            else:
                time.sleep(60)

    def stop(self):
        self.running = False

        if self.has_hardware and self.gpio is not None:
            try:
                self.gpio.cleanup()
            except Exception:
                pass

        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.5)

        print("[NFC] Servis durduruldu.")
