import time
import sys
from connection_manager import ConnectionManager
from posture_analyzer import PostureAnalyzer
from nfc_manager import NFCManager
from sensor_manager import SensorManager
from led_controller import LEDController

def main():
    print("==============================================")
    print("   ZENITH YZ & DONANIM SERVİSİ BAŞLATILIYOR   ")
    print("==============================================\n")
    
    # 1. Backend bağlantısı
    conn = ConnectionManager()
    conn.connect()
    
    # 2. Modülleri oluştur
    led = LEDController()
    sensors = SensorManager()
    nfc = NFCManager()
    posture = PostureAnalyzer()
    
    try:
        # 3. Servisleri başlat
        led.start()
        sensors.start()
        nfc.start()
        posture.start()
        
        print("\n[Sistem] Tüm servisler aktif! Çıkmak için Ctrl+C'ye basın.\n")
        
        # Ana thread hayatta kalsın
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[Sistem] Kapatılma isteği alındı...")
    finally:
        print("[Sistem] Servisler güvenli bir şekilde kapatılıyor...")
        posture.stop()
        nfc.stop()
        sensors.stop()
        led.stop()
        conn.disconnect()
        print("[Sistem] Çıkış yapıldı.")
        sys.exit(0)

if __name__ == "__main__":
    main()
