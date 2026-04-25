import time
import smbus2
import bme280
import socketio

# Socket.io İstemcisi
sio = socketio.Client()

# I2C Ayarları (Oluşturduğumuz Özel Hat: Bus 3)
port = 3
address = 0x76 # BME280'in I2C Adresi (Eğer i2cdetect 77 gösterdiyse burayı 0x77 yap)
bus = smbus2.SMBus(port)

# BME280 Kalibrasyon Verilerini Yükle
calibration_params = bme280.load_calibration_params(bus, address)

@sio.event
def connect():
    print("[Sensör Servisi] NestJS Backend'e bağlandı!")

@sio.event
def disconnect():
    print("[Sensör Servisi] Bağlantı koptu!")

def start_sensors():
    try:
        print("Sensör verileri okunuyor...")
        # NestJS çalışıyorsa bağlan (localhost:3000 varsayılan)
        sio.connect('http://localhost:3000')
        
        while True:
            # BME280'den verileri oku
            data = bme280.sample(bus, address, calibration_params)
            
            # Verileri toparla ve yuvarla
            sensor_data = {
                "temp": round(data.temperature, 1),
                "humidity": round(data.humidity, 1),
                "pressure": round(data.pressure, 1)
            }
            
            print(f"Sıcaklık: {sensor_data['temp']}°C | Nem: %{sensor_data['humidity']}")
            
            # Veriyi NestJS'e fırlat
            sio.emit('sensor_update', sensor_data)
            
            # Her 5 saniyede bir güncelle
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("Servis durduruldu.")
        sio.disconnect()
    except Exception as e:
        print(f"Hata oluştu: {e}")

if __name__ == '__main__':
    start_sensors()