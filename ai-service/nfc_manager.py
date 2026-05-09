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
        self._last_uid = None
        self._last_uid_time = 0.0

    def _initialize_hardware(self):
        if self.reader is not None or self.hardware_error is not None:
            return

        try:
            import RPi.GPIO as GPIO
            from mfrc522 import SimpleMFRC522

            self.gpio = GPIO
            self.reader = SimpleMFRC522()
            self.has_hardware = True
            
            # SPI baglantisini dogrulamak icin Versiyon Register'ini oku (0x37)
            try:
                version = self.reader.READER.Read_MFRC522(0x37)
                print(f"[NFC] MFRC522 donanimi hazir. Cihaz Versiyonu: 0x{version:X}")
                if version == 0x00 or version == 0xFF:
                    print("[NFC] UYARI: SPI iletisimi basarisiz (Versiyon 0x00 veya 0xFF).")
                    print("[NFC] -> Kablolari, lehimleri ve MISO/MOSI baglantilarini kontrol edin!")
            except Exception as e:
                print(f"[NFC] Versiyon okuma basarisiz: {e}")
                
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
                    card_id = self.reader.read_id()
                    uid_str = str(card_id)
                    
                    now = time.time()
                    if uid_str == self._last_uid and now - self._last_uid_time < 10.0:
                        # Son 10 saniye içinde okunan aynı kartı yoksay (cooldown)
                        time.sleep(0.5)
                        continue

                    self._last_uid = uid_str
                    self._last_uid_time = now

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
