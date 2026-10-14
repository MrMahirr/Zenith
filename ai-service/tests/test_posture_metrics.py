import unittest

from posture_metrics import (
    EmitThrottle,
    calibrated_threshold,
    head_to_shoulder_distance,
    is_slouching,
    landmarks_visible,
)


class FakeClock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class DistanceTests(unittest.TestCase):
    def test_upright_posture_has_larger_distance_than_slouching(self):
        upright = head_to_shoulder_distance(0.30, 0.60, 0.60)
        slouched = head_to_shoulder_distance(0.50, 0.60, 0.60)
        self.assertGreater(upright, slouched)

    def test_uses_average_of_both_shoulders(self):
        self.assertAlmostEqual(head_to_shoulder_distance(0.2, 0.5, 0.7), 0.4)

    def test_threshold_comparison(self):
        self.assertTrue(is_slouching(0.10, 0.15))
        self.assertFalse(is_slouching(0.15, 0.15))
        self.assertFalse(is_slouching(0.30, 0.15))


class CalibrationTests(unittest.TestCase):
    BOUNDS = (0.05, 0.5)

    def test_threshold_is_fraction_of_median_distance(self):
        self.assertEqual(calibrated_threshold([0.20, 0.25, 0.30], self.BOUNDS), 0.2)

    def test_even_sample_count_averages_middle_pair(self):
        self.assertEqual(calibrated_threshold([0.2, 0.2, 0.3, 0.3], self.BOUNDS), 0.2)

    def test_outliers_do_not_move_the_median(self):
        samples = [0.25] * 9 + [0.01]
        self.assertEqual(calibrated_threshold(samples, self.BOUNDS), 0.2)

    def test_result_is_clamped_to_bounds(self):
        self.assertEqual(calibrated_threshold([0.01], self.BOUNDS), 0.05)
        self.assertEqual(calibrated_threshold([0.9], self.BOUNDS), 0.5)

    def test_no_samples_returns_none(self):
        self.assertIsNone(calibrated_threshold([], self.BOUNDS))


class VisibilityTests(unittest.TestCase):
    def test_all_points_must_reach_minimum(self):
        self.assertTrue(landmarks_visible([0.9, 0.5, 0.8], 0.5))
        self.assertFalse(landmarks_visible([0.9, 0.49, 0.8], 0.5))

    def test_zero_minimum_disables_check(self):
        self.assertTrue(landmarks_visible([0.0, 0.0], 0.0))


class EmitThrottleTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.throttle = EmitThrottle(interval=5.0, clock=self.clock)

    def test_first_observation_is_always_emitted(self):
        self.assertTrue(self.throttle.should_emit(False))

    def test_unchanged_state_waits_for_interval(self):
        self.throttle.mark_emitted(False)

        self.clock.advance(4.9)
        self.assertFalse(self.throttle.should_emit(False))

        self.clock.advance(0.2)
        self.assertTrue(self.throttle.should_emit(False))

    def test_state_change_is_emitted_immediately(self):
        self.throttle.mark_emitted(False)
        self.assertTrue(self.throttle.should_emit(True))

    def test_reset_forgets_previous_state(self):
        self.throttle.mark_emitted(True)
        self.throttle.reset()

        self.assertIsNone(self.throttle.last_state)
        self.assertTrue(self.throttle.should_emit(True))


if __name__ == "__main__":
    unittest.main()
