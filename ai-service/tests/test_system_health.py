import unittest

import system_health


class ParseTests(unittest.TestCase):
    def test_current_under_voltage_and_throttle(self):
        flags = system_health.parse_throttled("throttled=0x50005")
        self.assertTrue(flags["under_voltage"])
        self.assertTrue(flags["throttled"])
        self.assertTrue(flags["under_voltage_occurred"])
        self.assertTrue(flags["throttled_occurred"])
        self.assertFalse(flags["freq_capped"])

    def test_clean_state(self):
        flags = system_health.parse_throttled("throttled=0x0\n")
        self.assertFalse(any(flags.values()))

    def test_unparseable_output(self):
        self.assertIsNone(system_health.parse_throttled(""))
        self.assertIsNone(system_health.parse_throttled("error"))

    def test_temperature(self):
        self.assertEqual(system_health.parse_temperature("temp=63.3'C"), 63.3)
        self.assertIsNone(system_health.parse_temperature("nope"))


class DescribeTests(unittest.TestCase):
    def devices(self, throttled, temp):
        outputs = {"get_throttled": throttled, "measure_temp": temp}
        result = system_health.read_system_devices(lambda args: outputs[args[0]])
        return {d["id"]: d for d in result}

    def test_active_under_voltage_is_an_error(self):
        devices = self.devices("throttled=0x50005", "temp=60.0'C")
        self.assertEqual(devices["power"]["state"], "error")
        self.assertIn("adaptor", devices["power"]["detail"])

    def test_past_under_voltage_is_a_warning(self):
        devices = self.devices("throttled=0x50000", "temp=50.0'C")
        self.assertEqual(devices["power"]["state"], "warn")

    def test_healthy(self):
        devices = self.devices("throttled=0x0", "temp=45.0'C")
        self.assertEqual(devices["power"]["state"], "ok")
        self.assertEqual(devices["cpu_temp"]["state"], "ok")

    def test_hot_cpu_warns(self):
        devices = self.devices("throttled=0x0", "temp=83.0'C")
        self.assertEqual(devices["cpu_temp"]["state"], "warn")

    def test_missing_vcgencmd_is_unknown_not_an_error(self):
        devices = self.devices("", "")
        self.assertEqual(devices["power"]["state"], "unknown")
        self.assertEqual(devices["cpu_temp"]["state"], "unknown")


if __name__ == "__main__":
    unittest.main()
