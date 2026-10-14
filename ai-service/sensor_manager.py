"""BME280 (sicaklik/nem/basinc) ve MQ135 (gaz, ADS1115 uzerinden) okuyup backend'e gonderen servis."""

import logging
import threading

from config import (
    BME280_ADDRESS,
    I2C_PORT,
    SENSOR_MAX_CONSECUTIVE_ERRORS,
    SENSOR_READ_INTERVAL,
    SENSOR_REINIT_DELAY,
    SIMULATE_HARDWARE,
)
from connection_manager import ConnectionManager
from runtime_settings import SENSOR_INTERVAL_RANGE, coerce_number

log = logging.getLogger("zenith.sensor")

MQ135_ADC_CHANNEL = 0
MQ135_FULL_SCALE_VOLTS = 5.0
# MQ135 beslemesiz/kopuk oldugunda AO ~0 V okunur ve "mukemmel hava" gibi gorunur.
_MQ135_DEAD_SIGNAL_VOLTS = 0.01


def voltage_to_air_quality(voltage):
    """MQ135 gerilimini 0-100 olcegine cevirir.

    Bu degerlendirme kalibre degildir: gercek ppm icin temiz havada R0
    kalibrasyonu ve sicaklik/nem duzeltmesi gerekir.
    """
    return round((voltage / MQ135_FULL_SCALE_VOLTS) * 100, 1)


class SensorHardware:
    """BME280 + ADS1115 (MQ135) okuyucusu. open() her cagrida I2C'yi bastan acar."""

    def __init__(self):
        self._bus = None
        self._i2c = None
        self._calibration = None
        self._channel = None
        self._bme280 = None

    def open(self):
        import bme280
        import smbus2
        from adafruit_ads1x15.ads1115 import ADS1115
        from adafruit_ads1x15.analog_in import AnalogIn

        try:
            from adafruit_extended_bus import ExtendedI2C as I2C
        except ImportError:
            from adafruit_blinka.microcontroller.generic_linux.i2c import I2C

        self.close()
        try:
            self._i2c = I2C(I2C_PORT)
            adc = ADS1115(self._i2c)
            self._channel = AnalogIn(adc, MQ135_ADC_CHANNEL)

            self._bus = smbus2.SMBus(I2C_PORT)
            self._bme280 = bme280
            self._calibration = bme280.load_calibration_params(self._bus, BME280_ADDRESS)
        except Exception:
            self.close()
            raise

    def read(self):
        sample = self._bme280.sample(self._bus, BME280_ADDRESS, self._calibration)
        voltage = self._channel.voltage

        return {
            "temp": round(sample.temperature, 1),
            "humidity": round(sample.humidity, 1),
            "pressure": round(sample.pressure, 1),
            "air_quality": voltage_to_air_quality(voltage),
            "gas_voltage": round(voltage, 3),
        }

    @staticmethod
    def _release(resource):
        """smbus2 (close) ve Blinka I2C (deinit) nesnelerini sessizce birakir."""
        for name in ("close", "deinit"):
            method = getattr(resource, name, None)
            if callable(method):
                try:
                    method()
                except Exception:
                    pass
                return

    def close(self):
        for resource in (self._bus, self._i2c):
            if resource is not None:
                self._release(resource)

        self._bus = self._i2c = self._channel = self._calibration = None


class SimulatedHardware:
    """Donanimsiz gelistirme icin sabit degerler (yalnizca SIMULATE_HARDWARE=1)."""

    def open(self):
        log.warning("SIMULATE_HARDWARE acik: sahte sensor verisi uretiliyor.")

    def read(self):
        return {
            "temp": 24.5,
            "humidity": 62.0,
            "pressure": 1013.2,
            "air_quality": 12.5,
            "gas_voltage": 0.450,
        }

    def close(self):
        pass


class SensorManager:
    def __init__(self, hardware=None):
        self.conn = ConnectionManager()
        self._hardware = hardware or (
            SimulatedHardware() if SIMULATE_HARDWARE else SensorHardware()
        )
        self._stop_event = threading.Event()
        self._thread = None

        self._dead_signal_logged = False
        self._last_open_error = None
        # Panelden degistirilebilir; baslangicta .env degeri gecerlidir.
        self._read_interval = SENSOR_READ_INTERVAL

        self.conn.on("settings_changed", self._handle_settings)
        self.conn.on_connect(self._subscribe_settings)

    def _subscribe_settings(self):
        self.conn.emit("settings_subscribe")

    def _handle_settings(self, payload):
        """Panelden degistirilen okuma araligini uygular (null = .env degeri)."""
        raw = payload.get("sensorIntervalSeconds") if isinstance(payload, dict) else None
        interval = coerce_number(raw, SENSOR_READ_INTERVAL, SENSOR_INTERVAL_RANGE)

        if interval != self._read_interval:
            self._read_interval = interval
            log.info("Okuma araligi guncellendi: %.0f sn", interval)

    def start(self):
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run, name="sensor-reader", daemon=True
        )
        self._thread.start()
        log.info("BME280/MQ135 okuma servisi baslatildi.")

    def _run(self):
        opened = False
        consecutive_errors = 0

        while not self._stop_event.is_set():
            if not opened:
                opened = self._try_open()
                if not opened:
                    self._stop_event.wait(SENSOR_REINIT_DELAY)
                    continue

            try:
                reading = self._hardware.read()
            except Exception as exc:
                consecutive_errors += 1
                log.warning(
                    "Okuma hatasi (%d/%d): %s",
                    consecutive_errors, SENSOR_MAX_CONSECUTIVE_ERRORS, exc,
                )
                if consecutive_errors >= SENSOR_MAX_CONSECUTIVE_ERRORS:
                    log.error("Art arda okuma hatasi; I2C yeniden acilacak.")
                    self._hardware.close()
                    opened = False
                    consecutive_errors = 0
                    self._stop_event.wait(SENSOR_REINIT_DELAY)
                    continue
            else:
                if consecutive_errors:
                    log.info("Sensor okumasi duzeldi.")
                consecutive_errors = 0
                self._warn_if_gas_signal_dead(reading["gas_voltage"])
                self.conn.emit("sensor_update", reading)

            self._stop_event.wait(self._read_interval)

    def _try_open(self):
        try:
            self._hardware.open()
            self._last_open_error = None
            return True
        except ImportError as exc:
            message = (
                f"Donanim kutuphaneleri eksik ({exc}). "
                "Gelistirme icin SIMULATE_HARDWARE=1 kullanin."
            )
        except Exception as exc:
            message = f"Donanim baslatilamadi: {exc.__class__.__name__}: {exc}"

        # Yeniden deneme her SENSOR_REINIT_DELAY'de olur; ayni hatayi tekrar basma.
        if message != self._last_open_error:
            log.error(message)
            self._last_open_error = message
        return False

    def _warn_if_gas_signal_dead(self, voltage):
        if voltage <= _MQ135_DEAD_SIGNAL_VOLTS:
            if not self._dead_signal_logged:
                log.warning(
                    "MQ135 sinyali ~0 V. Sensor beslemesi (VCC/GND) ve AO kablosu "
                    "kontrol edilmeli; hava kalitesi degeri guvenilmez."
                )
                self._dead_signal_logged = True
        else:
            self._dead_signal_logged = False

    def stop(self):
        self._stop_event.set()

        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=2.0)

        self._hardware.close()
        log.info("Servis durduruldu.")
