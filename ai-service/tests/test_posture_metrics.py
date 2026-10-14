import unittest

from posture_metrics import (
    EmitThrottle,
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
