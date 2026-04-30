import time
import threading
import board
import busio
from config import I2C_PORT, BME280_ADDRESS
from connection_manager import ConnectionManager

try:
    import smbus2
    import bme280
    import adafruit_ads1x15.ads1115 as ADS
    from adafruit_ads1x15.analog_in import AnalogIn
    HAS_HARDWARE = True
except ImportError:
    HAS_HARDWARE = False
    print("UYARI: BME280 veya ADS1115 kütüphaneleri bulunamadı. Mock mod aktif.")

class SensorManager:
    def __init__(self):
        self.conn = ConnectionManager()
        self.running = False
        self.ads = None
        self.mq135_channel = None

        if HAS_HARDWARE:
            try:
                # BME280 Başlatma (smbus2 zaten I2C_PORT kullanıyor)
                self.bus = smbus2.SMBus(I2C_PORT)
                self.calibration_params = bme280.load_calibration_params(self.bus, BME280_ADDRESS)

                # ADS1115 Başlatma
                # busio.I2C varsayılan portu (1) kullanır. 
                # Port 3'ü kullanabilmek için ExtendedI2C veya blinka alt yapısını kullanıyoruz.
                try:
                    from adafruit_extended_bus import ExtendedI2C as I2C
                    self.i2c_bus = I2C(I2C_PORT)
                except ImportError:
                    # Alternatif: Eğer kütüphane yoksa doğrudan blinka'nın linux i2c implementasyonunu deneyelim
                    from adafruit_blinka.microcontroller.generic_linux.i2c import I2C as LinuxI2C
                    self.i2c_bus = LinuxI2C(I2C_PORT)

                self.ads = ADS.ADS1115(self.i2c_bus)
                self.mq135_channel = AnalogIn(self.ads, ADS.P0)

            except Exception as e:
                print(f"[Sensör] Donanım başlatma hatası: {e}")
                self.has_hw = False
            else:
                self.has_hw = True
        else:
            self.has_hw = False

    def start(self):
        self.running = True
        print("[Sensör] BME280/MQ135 okuma servisi başlatıldı...")
        self.thread = threading.Thread(target=self._read_loop)
        self.thread.daemon = True
        self.thread.start()

    def _read_loop(self):
        while self.running:
            if self.has_hw:
                try:
                    # BME280 Okuma
                    data = bme280.sample(self.bus, BME280_ADDRESS, self.calibration_params)

                    # MQ135 (ADS1115 üzerinden) Okuma
                    # Voltajı oku (0-5V arası)
                    voltage = self.mq135_channel.voltage
                    # Basit bir hava kalitesi indeksi (0-100 arası scale edilebilir)
                    # Gerçek PPM hesabı için sensör kalibrasyonu gerekir ancak şimdilik ham veri yeterli
                    air_quality = round((voltage / 5.0) * 100, 1)

                    sensor_data = {
                        "temp": round(data.temperature, 1),
                        "humidity": round(data.humidity, 1),
                        "pressure": round(data.pressure, 1),
                        "air_quality": air_quality,
                        "gas_voltage": round(voltage, 3)
                    }
                    self.conn.emit('sensor_update', sensor_data)
                except Exception as e:
                    print(f"[Sensör] Okuma hatası: {e}")
            else:
                # Mock mod
                sensor_data = {
                    "temp": 24.5,
                    "humidity": 62.0,
                    "pressure": 1013.2,
                    "air_quality": 12.5,
                    "gas_voltage": 0.450
                }
                self.conn.emit('sensor_update', sensor_data)

            time.sleep(5)

    def stop(self):
        self.running = False
        if hasattr(self, 'bus'):
            self.bus.close()
        print("[Sensör] Servis durduruldu.")
if __name__ == "__main__":
    manager = SensorManager()
    manager.start()
    try:
        # Servisin kapanmamasını sağlayan sonsuz döngü
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        manager.stop()