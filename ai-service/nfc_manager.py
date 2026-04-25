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
                    print(f"[NFC] Okunan Kart ID: {card_id}")

                    if card_id in NFC_MODES:
                        yeni_mod = NFC_MODES[card_id]
                        print(f"[NFC] Eslesme bulundu. Gecilen Mod: {yeni_mod}")
                        self.conn.emit("nfc_mode_change", yeni_mod)
                    else:
                        print("[NFC] Taninmayan kart!")

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
