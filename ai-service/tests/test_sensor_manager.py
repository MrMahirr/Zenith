import sys
import threading
import unittest
from unittest import mock

# socketio yalnizca ConnectionManager icin gerekli; testler agsiz calissin.
with mock.patch.dict(sys.modules, {"socketio": mock.MagicMock()}):
    import sensor_manager

READING = {
    "temp": 23.0,
    "humidity": 50.0,
    "pressure": 1000.0,
    "air_quality": 10.0,
    "gas_voltage": 0.5,
}


class FakeConnection:
    def __init__(self):
        self.emitted = []

    def emit(self, event, data=None):
        self.emitted.append((event, data))
        return True


class ScriptedHardware:
    """read() cagrilarini sirayla `script`'e gore sonuclandirir; bitince yoneticiyi durdurur."""

    def __init__(self, script, open_failures=0):
        self.script = list(script)
        self.open_failures = open_failures
        self.open_calls = 0
        self.close_calls = 0
        self.manager = None

    def open(self):
        self.open_calls += 1
        if self.open_calls <= self.open_failures:
            raise OSError("i2c yok")

    def read(self):
        if not self.script:
            self.manager._stop_event.set()
            return dict(READING)

        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    def close(self):
        self.close_calls += 1


class SensorManagerTests(unittest.TestCase):
    def setUp(self):
        patches = [
            mock.patch.object(sensor_manager, "SENSOR_READ_INTERVAL", 0.001),
            mock.patch.object(sensor_manager, "SENSOR_REINIT_DELAY", 0.001),
            mock.patch.object(sensor_manager, "SENSOR_MAX_CONSECUTIVE_ERRORS", 3),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def _run(self, hardware):
        manager = sensor_manager.SensorManager(hardware=hardware)
        manager.conn = FakeConnection()
        hardware.manager = manager

        worker = threading.Thread(target=manager._run, daemon=True)
        worker.start()
        worker.join(timeout=5)
        self.assertFalse(worker.is_alive(), "okuma dongusu durmadi")
        return manager

    def test_readings_are_emitted_as_sensor_update(self):
        hardware = ScriptedHardware([dict(READING), dict(READING)])
        manager = self._run(hardware)

        events = [event for event, _ in manager.conn.emitted]
        self.assertGreaterEqual(events.count("sensor_update"), 2)
        self.assertEqual(manager.conn.emitted[0][1], READING)

    def test_isolated_error_does_not_reopen_hardware(self):
        hardware = ScriptedHardware([OSError("tek hata"), dict(READING)])
        self._run(hardware)

        self.assertEqual(hardware.open_calls, 1)

    def test_consecutive_errors_reopen_hardware(self):
        errors = [OSError("hata")] * 3
        hardware = ScriptedHardware(errors + [dict(READING)])
        manager = self._run(hardware)

        self.assertEqual(hardware.open_calls, 2)
        self.assertGreaterEqual(hardware.close_calls, 1)
        self.assertTrue(manager.conn.emitted)

    def test_open_failure_is_retried_without_emitting(self):
        hardware = ScriptedHardware([dict(READING)], open_failures=2)
        manager = self._run(hardware)

        self.assertEqual(hardware.open_calls, 3)
        self.assertTrue(manager.conn.emitted)

    def test_live_interval_setting_is_applied_and_validated(self):
        manager = sensor_manager.SensorManager(hardware=ScriptedHardware([]))
        default = manager._read_interval

        manager._handle_settings({"sensorIntervalSeconds": 60})
        self.assertEqual(manager._read_interval, 60.0)

        manager._handle_settings({"sensorIntervalSeconds": 1})      # aralik disi
        self.assertEqual(manager._read_interval, default)

        manager._handle_settings({"sensorIntervalSeconds": 30})
        manager._handle_settings({"sensorIntervalSeconds": None})   # tercih kaldirildi
        self.assertEqual(manager._read_interval, default)

        manager._handle_settings("garbage")                         # bozuk yuk
        self.assertEqual(manager._read_interval, default)

    def test_voltage_to_air_quality_scale(self):
        self.assertEqual(sensor_manager.voltage_to_air_quality(0.0), 0.0)
        self.assertEqual(sensor_manager.voltage_to_air_quality(2.5), 50.0)
        self.assertEqual(sensor_manager.voltage_to_air_quality(5.0), 100.0)


if __name__ == "__main__":
    unittest.main()
