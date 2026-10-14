import unittest

from led_power import estimate_current_ma, limit_brightness

WHITE = (255, 255, 255)
GREEN = (0, 255, 0)


class CurrentTests(unittest.TestCase):
    def test_full_white_is_about_60ma_per_led(self):
        self.assertAlmostEqual(estimate_current_ma(WHITE, 255, 55), 55 * 61.0)

    def test_off_draws_only_idle_current(self):
        self.assertAlmostEqual(estimate_current_ma((0, 0, 0), 255, 55), 55.0)

    def test_scales_with_brightness(self):
        half = estimate_current_ma(WHITE, 128, 55) - 55
        full = estimate_current_ma(WHITE, 255, 55) - 55
        self.assertAlmostEqual(half / full, 128 / 255, places=3)


class LimitTests(unittest.TestCase):
    def test_unlimited_when_budget_is_zero(self):
        self.assertEqual(limit_brightness(WHITE, 255, 55, 0), 255)

    def test_white_is_capped_to_the_budget(self):
        limited = limit_brightness(WHITE, 255, 55, 1000)
        self.assertLess(limited, 255)
        self.assertLessEqual(estimate_current_ma(WHITE, limited, 55), 1000)
        # bir adim fazlasi butceyi asardi
        self.assertGreater(estimate_current_ma(WHITE, limited + 1, 55), 1000 - 1e-6)

    def test_dim_colors_are_not_touched(self):
        self.assertEqual(limit_brightness(GREEN, 128, 55, 1000), 128)

    def test_never_exceeds_requested_brightness(self):
        self.assertEqual(limit_brightness(WHITE, 20, 55, 1000), 20)

    def test_black_is_never_limited(self):
        self.assertEqual(limit_brightness((0, 0, 0), 200, 55, 1000), 200)

    def test_budget_below_idle_turns_the_strip_off(self):
        self.assertEqual(limit_brightness(WHITE, 255, 55, 10), 0)


if __name__ == "__main__":
    unittest.main()
