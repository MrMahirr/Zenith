import time
import socketio
from mfrc522 import SimpleMFRC522
import RPi.GPIO as GPIO

# Socket.io İstemcisi
sio = socketio.Client()
reader = SimpleMFRC522()

# Kendi kartlarının ID numaralarını buraya ekleyeceğiz (Şimdilik örnek numaralar)
# Hangi kart okutulursa o moda geçecek.
KART_MODLARI = {
    83749274923: "CODING",   # Örnek: Beyaz Kart -> Kodlama Modu
    29384729384: "FOCUS",    # Örnek: Mavi Anahtarlık -> Odak Modu
    11223344556: "RELAX"     # Örnek: Telefon NFC'si -> Relax Modu
}

@sio.event
def connect():
    print("[NFC Servisi] NestJS Backend'e bağlandı. Kart bekleniyor...")

def start_nfc_reader():
    try:
        sio.connect('http://localhost:3000')
        
        while True:
            # Kart okutulana kadar bekle
            print("Kart veya NFC etiket okutun...")
            id, text = reader.read()
            print(f"Okunan Kart ID: {id}")
            
            # Okunan kartın ID'si listemizde varsa o moda geç
            if id in KART_MODLARI:
                yeni_mod = KART_MODLARI[id]
                print(f"Eşleşme bulundu! Geçilen Mod: {yeni_mod}")
                sio.emit('nfc_mode_change', yeni_mod)
            else:
                print("Tanınmayan kart! Sadece ID'si okundu.")
                
            # Arka arkaya defalarca okumasını engellemek için 2 saniye bekle
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("Servis durduruldu.")
    finally:
        GPIO.cleanup()
        sio.disconnect()

if __name__ == '__main__':
    start_nfc_reader()