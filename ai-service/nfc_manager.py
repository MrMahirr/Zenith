import time
import threading
from config import NFC_MODES
from connection_manager import ConnectionManager

# Try to import RPi.GPIO and MFRC522, handle gracefully if not on Pi
try:
    import RPi.GPIO as GPIO
    from mfrc522 import SimpleMFRC522
    HAS_HARDWARE = True
except ImportError:
    HAS_HARDWARE = False
    print("UYARI: RPi donanımı bulunamadı. NFC okuyucu mock modunda çalışacak.")

class NFCManager:
    def __init__(self):
        self.conn = ConnectionManager()
        self.running = False
        
        if HAS_HARDWARE:
            self.reader = SimpleMFRC522()

    def start(self):
        self.running = True
        print("[NFC] Kart okuyucu servisi başlatıldı...")
        
        self.thread = threading.Thread(target=self._read_loop)
        self.thread.daemon = True
        self.thread.start()

    def _read_loop(self):
        while self.running:
            if HAS_HARDWARE:
                try:
                    # Okuma işlemi bloklayıcıdır, timeout eklenemezse 
                    # bu thead durdurulana kadar bekler
                    id, text = self.reader.read()
                    print(f"[NFC] Okunan Kart ID: {id}")
                    
                    if id in NFC_MODES:
                        yeni_mod = NFC_MODES[id]
                        print(f"[NFC] Eşleşme bulundu! Geçilen Mod: {yeni_mod}")
                        self.conn.emit('nfc_mode_change', yeni_mod)
                    else:
                        print("[NFC] Tanınmayan kart!")
                        
                    time.sleep(2) # Art arda okumayı engelle
                except Exception as e:
                    print(f"[NFC] Okuma hatası: {e}")
                    time.sleep(1)
            else:
                # Mock modu - Geliştirme için her 60 saniyede rastgele bir moda geç
                time.sleep(60)

    def stop(self):
        self.running = False
        if HAS_HARDWARE:
            try:
                GPIO.cleanup()
            except:
                pass
        print("[NFC] Servis durduruldu.")