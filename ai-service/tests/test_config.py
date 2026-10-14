import importlib
import os
import unittest
from unittest import mock

import config


def _reload_with(env):
    with mock.patch.dict(os.environ, env, clear=False):
        return importlib.reload(config)


class EnvHelperTests(unittest.TestCase):
    def test_int_accepts_decimal_and_hex(self):
        with mock.patch.dict(os.environ, {"T_DEC": "42", "T_HEX": "0x76"}):
            self.assertEqual(config.env_int("T_DEC", 0), 42)
            self.assertEqual(config.env_int("T_HEX", 0), 0x76)

    def test_invalid_or_out_of_range_falls_back_to_default(self):
        with mock.patch.dict(os.environ, {"T_BAD": "abc", "T_BIG": "999"}):
            self.assertEqual(config.env_int("T_BAD", 7), 7)
            self.assertEqual(config.env_int("T_BIG", 7, maximum=255), 7)

    def test_missing_or_blank_uses_default(self):
        with mock.patch.dict(os.environ, {"T_BLANK": "   "}):
            self.assertEqual(config.env_float("T_BLANK", 1.5), 1.5)
            self.assertEqual(config.env_float("T_MISSING_X", 2.5), 2.5)

    def test_bool_parsing(self):
        with mock.patch.dict(os.environ, {"T_ON": "Yes", "T_OFF": "0", "T_BAD": "maybe"}):
            self.assertTrue(config.env_bool("T_ON"))
            self.assertFalse(config.env_bool("T_OFF", True))
            self.assertTrue(config.env_bool("T_BAD", True))

    def test_url_list_is_deduplicated_and_ordered(self):
        env = {"U_A": "http://a", "U_B": "http://b", "U_C": "http://a", "U_D": ""}
        with mock.patch.dict(os.environ, env):
            self.assertEqual(
                config.env_url_list("U_A", "U_B", "U_C", "U_D"),
                ("http://a", "http://b"),
            )


class ModuleConfigTests(unittest.TestCase):
    def tearDown(self):
        importlib.reload(config)

    def test_camera_urls_follow_env_order_without_duplicates(self):
        cfg = _reload_with(
            {
                "CAMERA_URL": "",
                "CAMERA_URL_1": "http://192.168.1.10:4747/video",
                "CAMERA_URL_2": "http://192.168.1.10:4747/video",
            }
        )
        self.assertEqual(cfg.CAMERA_URLS, ("http://192.168.1.10:4747/video",))

    def test_health_url_is_derived_from_backend_url(self):
        env = {"BACKEND_URL": "http://10.0.0.5:3000", "BACKEND_HEALTH_URL": ""}
        cfg = _reload_with(env)
        self.assertEqual(cfg.BACKEND_HEALTH_URL, "http://10.0.0.5:3000/api/health")

    def test_simulation_is_off_by_default(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SIMULATE_HARDWARE", None)
            self.assertFalse(importlib.reload(config).SIMULATE_HARDWARE)


if __name__ == "__main__":
    unittest.main()
