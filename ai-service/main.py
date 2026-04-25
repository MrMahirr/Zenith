import time
import sys
import argparse
from connection_manager import ConnectionManager

def main():
    parser = argparse.ArgumentParser(description="Zenith AI & Donanım Servisi")
    parser.add_argument('--service', type=str, required=True, choices=['camera', 'sensor', 'led', 'nfc'], help="Başlatılacak mikroservis")
    args = parser.parse_args()

    print("==============================================")
    print(f"   ZENITH {args.service.upper()} SERVİSİ BAŞLATILIYOR")
    print("==============================================\n")
    
    # 1. Backend bağlantısı
    conn = ConnectionManager()
    conn.connect()
    
    # 2. İlgili modülü oluştur
    service = None
    if args.service == 'camera':
        from posture_analyzer import PostureAnalyzer
        service = PostureAnalyzer()
    elif args.service == 'sensor':
        from sensor_manager import SensorManager
        service = SensorManager()
    elif args.service == 'led':
        from led_controller import LEDController
        service = LEDController()
    elif args.service == 'nfc':
        from nfc_manager import NFCManager
        service = NFCManager()
    
    try:
        # 3. Servisi başlat
        service.start()
        
        print(f"\n[{args.service.upper()}] Servis aktif! Çıkmak için Ctrl+C'ye basın.\n")
        
        # Ana thread hayatta kalsın
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[Sistem] Kapatılma isteği alındı...")
    finally:
        print(f"[Sistem] {args.service.upper()} servisi güvenli bir şekilde kapatılıyor...")
        if service:
            try:
                service.stop()
            except Exception as e:
                print(f"[Hata] Durdurulurken hata oluştu: {e}")
        conn.disconnect()
        print("[Sistem] Çıkış yapıldı.")
        sys.exit(0)

if __name__ == "__main__":
    main()
