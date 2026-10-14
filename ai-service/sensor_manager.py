"""BME280 (sicaklik/nem/basinc) ve MQ135 (gaz, ADS1115 uzerinden) okuyup backend'e gonderen servis."""

import logging
import statistics
import threading
import time

from config import (
    ADS1115_SUPPLY_VOLTS,
    BME280_ADDRESS,
    I2C_PORT,
    MQ135_VCC_VOLTS,
    SENSOR_MAX_CONSECUTIVE_ERRORS,
    SENSOR_READ_INTERVAL,
    SENSOR_REINIT_DELAY,
    SIMULATE_HARDWARE,
)
import mq135
from connection_manager import ConnectionManager
from hardware_report import ERROR, OK, UNKNOWN, device
from runtime_settings import MQ135_CLEAN_VOLTAGE_RANGE, SENSOR_INTERVAL_RANGE, coerce_number
from system_health import read_system_devices

log = logging.getLogger("zenith.sensor")

MQ135_ADC_CHANNEL = 0
# Guc/sicaklik bilgisi cok sik degismez; her okuma turunda sorgulanmaz.
_SYSTEM_HEALTH_INTERVAL_SECONDS = 30.0
# Kalibrasyon: temiz havada bu kadar olcumun ortancasi alinir.
_CALIBRATION_SAMPLES = 10
_CALIBRATION_SPACING_SECONDS = 1.0
_MAX_CALIBRATION_SPREAD_VOLTS = 0.15


def voltage_to_air_quality(voltage):
    """Kalibrasyonsuz (eski dogrusal) 0-100 olcegi; geriye uyumluluk icin korunur."""
    return mq135.legacy_index(voltage)


class DeviceReadError(Exception):
    """Hangi cihazin okunamadigini tasiyan hata (`bme280` ya da `ads1115`)."""

    def __init__(self, device_id, original):
        super().__init__(f"{device_id}: {original}")
        self.device_id = device_id


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
        try:
            sample = self._bme280.sample(self._bus, BME280_ADDRESS, self._calibration)
        except Exception as exc:
            raise DeviceReadError("bme280", exc) from exc

        try:
            voltage = self._channel.voltage
        except Exception as exc:
            raise DeviceReadError("ads1115", exc) from exc

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
        # Temiz havada olculen MQ135 gerilimi (None = kalibre degil).
        self._clean_voltage = None

        # Donanim durum raporu
        self._last_gas_voltage = None
        self._device_errors = {}
        self._open_failed = False
        self._system_devices = []
        self._system_read_at = 0.0
        self._last_report = None

        # Uyku bekleyisini durdurma ya da kalibrasyon istegiyle bolmek icin.
        self._wake = threading.Event()
        self._calibration_requested = threading.Event()

        self.conn.on("settings_changed", self._handle_settings)
        self.conn.on("mq135_calibrate", self._handle_calibrate_request)
        self.conn.on_connect(self._on_backend_connected)

    def _on_backend_connected(self):
        self.conn.emit("settings_subscribe")
        self._publish_hardware_status(force=True)

    def _handle_calibrate_request(self, _payload=None):
        log.info("MQ135 kalibrasyon istegi alindi.")
        self._calibration_requested.set()
        self._wake.set()

    def _handle_settings(self, payload):
        """Panelden degistirilen okuma araligini uygular (null = .env degeri)."""
        data = payload if isinstance(payload, dict) else {}

        interval = coerce_number(
            data.get("sensorIntervalSeconds"), SENSOR_READ_INTERVAL, SENSOR_INTERVAL_RANGE
        )
        if interval != self._read_interval:
            self._read_interval = interval
            log.info("Okuma araligi guncellendi: %.0f sn", interval)

        clean = coerce_number(data.get("mq135CleanVoltage"), None, MQ135_CLEAN_VOLTAGE_RANGE)
        if clean != self._clean_voltage:
            self._clean_voltage = clean
            log.info(
                "MQ135 kalibrasyonu: %s",
                f"temiz hava {clean:.3f} V" if clean is not None else "yok (eski olcek)",
            )

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
                self._open_failed = not opened
                self._publish_hardware_status()
                if not opened:
                    self._stop_event.wait(SENSOR_REINIT_DELAY)
                    continue

            if self._calibration_requested.is_set():
                self._calibration_requested.clear()
                self._run_calibration()

            try:
                reading = self._hardware.read()
            except Exception as exc:
                consecutive_errors += 1
                failed = getattr(exc, "device_id", "bme280")
                self._device_errors[failed] = str(exc)
                log.warning(
                    "Okuma hatasi (%d/%d): %s",
                    consecutive_errors, SENSOR_MAX_CONSECUTIVE_ERRORS, exc,
                )
                self._publish_hardware_status()
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
                self._device_errors.clear()
                self._last_gas_voltage = reading["gas_voltage"]
                reading["air_quality"] = mq135.air_quality(
                    reading["gas_voltage"], self._clean_voltage, MQ135_VCC_VOLTS
                )
                self._warn_if_gas_signal_dead(reading["gas_voltage"])
                self.conn.emit("sensor_update", reading)
                self._publish_hardware_status()

            self._wake.wait(self._read_interval)
            self._wake.clear()

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

    def _run_calibration(self):
        """Temiz havada ardisik olcumlerin ortancasini kalibrasyon gerilimi olarak bildirir."""
        samples = []
        for _ in range(_CALIBRATION_SAMPLES):
            if self._stop_event.is_set():
                return
            try:
                samples.append(self._hardware.read()["gas_voltage"])
            except Exception as exc:
                log.warning("Kalibrasyon olcumu basarisiz: %s", exc)
            self._stop_event.wait(_CALIBRATION_SPACING_SECONDS)

        if len(samples) < _CALIBRATION_SAMPLES // 2:
            log.error("MQ135 kalibrasyonu iptal: yeterli olcum alinamadi.")
            return

        spread = max(samples) - min(samples)
        clean = statistics.median(samples)
        lower, upper = MQ135_CLEAN_VOLTAGE_RANGE
        if spread > _MAX_CALIBRATION_SPREAD_VOLTS or not lower <= clean <= upper:
            log.error(
                "MQ135 kalibrasyonu iptal: olcumler kararsiz (yayilim %.2f V, ortanca %.2f V). "
                "Sensor isinmamis ya da hava degisken olabilir.",
                spread, clean,
            )
            return

        log.info("MQ135 kalibrasyonu tamam: temiz hava %.3f V", clean)
        self.conn.emit("mq135_calibrated", {"cleanVoltage": round(clean, 3)})

    def _publish_hardware_status(self, force=False):
        """Cihaz saglik raporunu degistiyse (ya da `force` ise) backend'e gonderir."""
        now = time.monotonic()
        if now - self._system_read_at >= _SYSTEM_HEALTH_INTERVAL_SECONDS:
            self._system_devices = read_system_devices()
            self._system_read_at = now

        devices = [*self._sensor_devices(), *self._system_devices]
        if not force and devices == self._last_report:
            return

        self._last_report = devices
        self.conn.emit("hardware_status", {"devices": devices})

    def _sensor_devices(self):
        if self._open_failed:
            detail = self._last_open_error or "I2C acilamadi"
            return [
                device("bme280", "BME280 (sicaklik/nem/basinc)", ERROR, detail),
                device("ads1115", "ADS1115 (analog donusturucu)", ERROR, detail),
                device("mq135", "MQ135 gaz sensoru", UNKNOWN, "ADS1115 okunamiyor"),
            ]

        devices = []
        for device_id, name in (("bme280", "BME280 (sicaklik/nem/basinc)"),
                                ("ads1115", "ADS1115 (analog donusturucu)")):
            if device_id in self._device_errors:
                devices.append(device(device_id, name, ERROR, self._device_errors[device_id]))
            elif self._last_report is None and self._last_gas_voltage is None:
                devices.append(device(device_id, name, UNKNOWN, "Henuz olculmedi"))
            else:
                devices.append(device(device_id, name, OK, "Yanit veriyor"))

        if self._last_gas_voltage is None:
            devices.append(device("mq135", "MQ135 gaz sensoru", UNKNOWN, "Henuz olculmedi"))
        elif "ads1115" in self._device_errors:
            devices.append(device("mq135", "MQ135 gaz sensoru", UNKNOWN, "ADS1115 okunamiyor"))
        else:
            devices.append(
                mq135.describe_signal(
                    self._last_gas_voltage,
                    supply_volts=ADS1115_SUPPLY_VOLTS,
                    calibrated=self._clean_voltage is not None,
                )
            )
        return devices

    def _warn_if_gas_signal_dead(self, voltage):
        if voltage <= mq135.DEAD_SIGNAL_VOLTS:
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
        self._wake.set()

        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=2.0)

        self._hardware.close()
        log.info("Servis durduruldu.")
