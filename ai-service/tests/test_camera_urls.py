import unittest

from camera_urls import resolve_camera_urls, sanitize_camera_url

DEFAULTS = ("http://192.168.1.10:4747/video", "http://10.0.0.5:4747/video")


class SanitizeTests(unittest.TestCase):
    def test_accepts_http_and_https(self):
        self.assertEqual(
            sanitize_camera_url(" http://192.168.1.20:4747/video "),
            "http://192.168.1.20:4747/video",
        )
        self.assertEqual(sanitize_camera_url("https://cam.local/s"), "https://cam.local/s")

    def test_rejects_invalid_values(self):
        for value in (None, 42, "", "192.168.1.20", "ftp://x/y", "file:///etc/passwd",
                      "http://", "javascript:alert(1)", "http://[::1"):
            with self.subTest(value=value):
                self.assertIsNone(sanitize_camera_url(value))


class ResolveTests(unittest.TestCase):
    def test_runtime_url_replaces_defaults(self):
        self.assertEqual(
            resolve_camera_urls("http://192.168.1.99:4747/video", DEFAULTS),
            ("http://192.168.1.99:4747/video",),
        )

    def test_falls_back_to_defaults_when_missing_or_invalid(self):
        self.assertEqual(resolve_camera_urls(None, DEFAULTS), DEFAULTS)
        self.assertEqual(resolve_camera_urls("garbage", DEFAULTS), DEFAULTS)


if __name__ == "__main__":
    unittest.main()
