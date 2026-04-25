import time
import threading
from config import I2C_PORT, BME280_ADDRESS
from connection_manager import ConnectionManager

try:
    import smbus2
    import bme280
    HAS_HARDWARE = True
except ImportError:
    HAS_HARDWARE = False
    print("UYARI: BME280 donanımı bulunamadı. Sensör mock modunda çalışacak.")

class SensorManager:
    def __init__(self):
        global HAS_HARDWARE
        self.conn = ConnectionManager()
        self.running = False
        
        if HAS_HARDWARE:
            try:
                self.bus = smbus2.SMBus(I2C_PORT)
                self.calibration_params = bme280.load_calibration_params(self.bus, BME280_ADDRESS)
            except Exception as e:
                print(f"[Sensör] Donanım başlatma hatası: {e}")
                HAS_HARDWARE = False

    def start(self):
        self.running = True
        print("[Sensör] BME280/MQ135 okuma servisi başlatıldı...")
        
        self.thread = threading.Thread(target=self._read_loop)
        self.thread.daemon = True
        self.thread.start()

    def _read_loop(self):
        while self.running:
            if HAS_HARDWARE:
                try:
                    data = bme280.sample(self.bus, BME280_ADDRESS, self.calibration_params)
                    sensor_data = {
                        "temp": round(data.temperature, 1),
                        "humidity": round(data.humidity, 1),
                        "pressure": round(data.pressure, 1)
                    }
                    self.conn.emit('sensor_update', sensor_data)
                except Exception as e:
                    print(f"[Sensör] Okuma hatası: {e}")
            else:
                # Mock mod
                sensor_data = {
                    "temp": 24.5,
                    "humidity": 62.0,
                    "pressure": 1013.2
                }
                self.conn.emit('sensor_update', sensor_data)
                
            time.sleep(5) # 5 saniyede bir

    def stop(self):
        self.running = False
        print("[Sensör] Servis durduruldu.")