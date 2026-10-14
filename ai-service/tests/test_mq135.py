import unittest

import mq135


class IndexTests(unittest.TestCase):
    def test_legacy_scale_is_linear_and_clamped(self):
        self.assertEqual(mq135.legacy_index(0.0), 0.0)
        self.assertEqual(mq135.legacy_index(2.5), 50.0)
        self.assertEqual(mq135.legacy_index(9.0), 100.0)

    def test_clean_air_is_zero(self):
        self.assertEqual(mq135.calibrated_index(0.5, 0.5), 0.0)

    def test_higher_voltage_means_dirtier_air(self):
        # Voltaj artinca Rs duser -> indeks artar.
        low = mq135.calibrated_index(0.8, 0.5)
        high = mq135.calibrated_index(1.5, 0.5)
        self.assertGreater(low, 0)
        self.assertGreater(high, low)
        self.assertLessEqual(high, 100.0)

    def test_cleaner_than_calibration_is_clamped_to_zero(self):
        self.assertEqual(mq135.calibrated_index(0.3, 0.5), 0.0)

    def test_ratio_is_none_for_unmeasurable_voltages(self):
        self.assertIsNone(mq135.resistance_ratio(0.0, 0.5))
        self.assertIsNone(mq135.resistance_ratio(5.0, 0.5))
        self.assertIsNone(mq135.resistance_ratio(0.5, 0.0))

    def test_air_quality_falls_back_without_calibration(self):
        self.assertEqual(mq135.air_quality(0.5), mq135.legacy_index(0.5))
        self.assertEqual(mq135.air_quality(0.5, 0.5), 0.0)
        # olculemeyen voltaj eski olcege duser
        self.assertEqual(mq135.air_quality(0.0, 0.5), 0.0)


class SignalTests(unittest.TestCase):
    def test_dead_signal_is_an_error(self):
        result = mq135.describe_signal(0.0)
        self.assertEqual(result["state"], "error")
        self.assertIn("kablolar", result["detail"])

    def test_overvoltage_for_a_3v3_ads_is_an_error(self):
        result = mq135.describe_signal(3.8, supply_volts=3.3)
        self.assertEqual(result["state"], "error")
        self.assertIn("gerilim bolucu", result["detail"])

    def test_same_voltage_is_fine_on_a_5v_ads(self):
        self.assertNotEqual(mq135.describe_signal(3.8, supply_volts=5.0)["state"], "error")

    def test_saturation_is_an_error(self):
        self.assertEqual(mq135.describe_signal(4.09, supply_volts=5.0)["state"], "error")

    def test_uncalibrated_is_a_warning_calibrated_is_ok(self):
        self.assertEqual(mq135.describe_signal(0.5)["state"], "warn")
        self.assertEqual(mq135.describe_signal(0.5, calibrated=True)["state"], "ok")


if __name__ == "__main__":
    unittest.main()
