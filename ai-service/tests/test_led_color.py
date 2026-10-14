import unittest

from led_color import clamp_brightness, parse_duration_seconds, parse_hex_color


class ParseHexColorTests(unittest.TestCase):
    def test_six_digit_color(self):
        self.assertEqual(parse_hex_color("#EF4444"), (239, 68, 68))

    def test_three_digit_color_is_expanded(self):
        self.assertEqual(parse_hex_color("#0f8"), (0, 255, 136))

    def test_lowercase_and_surrounding_whitespace(self):
        self.assertEqual(parse_hex_color("  #10b981 "), (16, 185, 129))

    def test_invalid_values_return_none(self):
        for value in (None, 123, "", "EF4444", "#12", "#GGGGGG", "#1234567", "red"):
            with self.subTest(value=value):
                self.assertIsNone(parse_hex_color(value))


class ClampBrightnessTests(unittest.TestCase):
    def test_in_range_value_is_kept(self):
        self.assertEqual(clamp_brightness(128), 128)

    def test_out_of_range_values_are_clamped(self):
        self.assertEqual(clamp_brightness(-5), 0)
        self.assertEqual(clamp_brightness(900), 255)

    def test_numeric_strings_and_floats_are_accepted(self):
        self.assertEqual(clamp_brightness("64"), 64)
        self.assertEqual(clamp_brightness(127.6), 128)

    def test_non_numeric_returns_none(self):
        for value in (None, "abc", [], True):
            with self.subTest(value=value):
                self.assertIsNone(clamp_brightness(value))


class ParseDurationTests(unittest.TestCase):
    def test_milliseconds_are_converted_to_seconds(self):
        self.assertEqual(parse_duration_seconds(2000), 2.0)

    def test_invalid_or_non_positive_is_zero(self):
        for value in (None, "abc", -100, 0, True):
            with self.subTest(value=value):
                self.assertEqual(parse_duration_seconds(value), 0.0)


if __name__ == "__main__":
    unittest.main()
