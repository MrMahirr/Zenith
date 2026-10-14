import unittest

from runtime_settings import (
    POSTURE_THRESHOLD_RANGE,
    SENSOR_INTERVAL_RANGE,
    coerce_number,
)


class CoerceNumberTests(unittest.TestCase):
    def test_accepts_values_inside_bounds(self):
        self.assertEqual(coerce_number(0.2, 0.15, POSTURE_THRESHOLD_RANGE), 0.2)
        self.assertEqual(coerce_number(30, 15.0, SENSOR_INTERVAL_RANGE), 30.0)

    def test_bounds_are_inclusive(self):
        self.assertEqual(coerce_number(5, 15.0, SENSOR_INTERVAL_RANGE), 5.0)
        self.assertEqual(coerce_number(300, 15.0, SENSOR_INTERVAL_RANGE), 300.0)

    def test_none_and_garbage_fall_back_to_default(self):
        for value in (None, "0.2", True, [], {}, float("nan")):
            with self.subTest(value=value):
                self.assertEqual(coerce_number(value, 0.15, POSTURE_THRESHOLD_RANGE), 0.15)

    def test_out_of_range_falls_back_to_default(self):
        self.assertEqual(coerce_number(0.01, 0.15, POSTURE_THRESHOLD_RANGE), 0.15)
        self.assertEqual(coerce_number(1, 15.0, SENSOR_INTERVAL_RANGE), 15.0)
        self.assertEqual(coerce_number(10_000, 15.0, SENSOR_INTERVAL_RANGE), 15.0)


if __name__ == "__main__":
    unittest.main()
