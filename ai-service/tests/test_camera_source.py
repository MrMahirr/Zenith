import socketserver
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    import cv2
    import numpy as np
except ImportError:  # OpenCV yoksa (ornegin gelistirme makinesi) testler atlanir
    cv2 = None

if cv2 is not None:
    from camera_source import CameraSource


def _jpeg(width, height):
    image = np.full((height, width, 3), 90, dtype=np.uint8)
    return cv2.imencode(".jpg", image)[1].tobytes()


class _FakeCamera:
    """Verilen boyutta surekli MJPEG kare yayinlayan sahte kamera sunucusu."""

    def __init__(self, width, height):
        jpeg = _jpeg(width, height)
        header = b"--f\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n" % len(jpeg)

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=f")
                self.end_headers()
                try:
                    while True:
                        self.wfile.write(header + jpeg + b"\r\n")
                        time.sleep(0.03)
                except OSError:
                    pass

        class Server(socketserver.ThreadingMixIn, HTTPServer):
            daemon_threads = True

        self._server = Server(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self._server.server_address[1]}/video"
        threading.Thread(target=self._server.serve_forever, daemon=True).start()

    def close(self):
        self._server.shutdown()
        self._server.server_close()


def _wait_until(condition, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(0.02)
    return False


@unittest.skipIf(cv2 is None, "OpenCV gerekli")
class CameraSourceSwitchTests(unittest.TestCase):
    def setUp(self):
        self.camera_a = _FakeCamera(640, 480)
        self.camera_b = _FakeCamera(320, 240)
        self.addCleanup(self.camera_a.close)
        self.addCleanup(self.camera_b.close)

    def _source(self, urls, reconnect_delay=0.1, states=None):
        source = CameraSource(
            urls,
            connect_timeout=1.0,
            reconnect_delay=reconnect_delay,
            on_state_change=states.append if states is not None else None,
        )
        source.start()
        self.addCleanup(source.stop)
        return source

    def test_switches_to_new_url_while_running(self):
        states = []
        source = self._source([self.camera_a.url], states=states)
        self.assertTrue(_wait_until(lambda: source.frame_size == (640, 480)))

        self.assertTrue(source.set_urls([self.camera_b.url]))

        self.assertTrue(_wait_until(lambda: source.frame_size == (320, 240)))
        self.assertEqual(source.active_url, self.camera_b.url)
        self.assertIn(True, states)

    def test_unchanged_urls_do_not_reconnect(self):
        source = self._source([self.camera_a.url])
        self.assertTrue(_wait_until(lambda: source.connected))

        self.assertFalse(source.set_urls([self.camera_a.url]))

    def test_switch_is_immediate_even_with_long_reconnect_delay(self):
        dead = "http://127.0.0.1:9/video"
        source = self._source([dead], reconnect_delay=30.0)
        time.sleep(0.5)  # ilk deneme basarisiz olup 30 sn'lik bekleme basladi

        started = time.monotonic()
        source.set_urls([self.camera_a.url])

        self.assertTrue(_wait_until(lambda: source.connected, timeout=3.0))
        self.assertLess(time.monotonic() - started, 3.0)

    def test_empty_urls_are_rejected(self):
        source = self._source([self.camera_a.url])
        with self.assertRaises(ValueError):
            source.set_urls([])


if __name__ == "__main__":
    unittest.main()
