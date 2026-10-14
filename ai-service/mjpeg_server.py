"""Kareleri tarayiciya MJPEG olarak sunan hafif, cok is parcacikli HTTP sunucusu.

Uc nokta sunar:
  GET /video_feed?width=&fps=&quality=   canli MJPEG yayini
  GET /camera_info                       {"width": .., "height": ..}
"""

import json
import logging
import socketserver
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

log = logging.getLogger("zenith.camera.stream")

DEFAULT_WIDTH = 320
DEFAULT_FPS = 15
DEFAULT_QUALITY = 30

_WIDTH_RANGE = (64, 1920)
_FPS_RANGE = (1, 30)
_QUALITY_RANGE = (1, 95)
# Yavas ya da kopmus istemciler bir is parcacigini sonsuza dek tutmasin.
_CLIENT_TIMEOUT_SECONDS = 10
_FRAME_WAIT_SECONDS = 1.0
_BOUNDARY = b"frame"


def _int_param(query, name, default, bounds):
    try:
        value = int(query.get(name, [default])[0])
    except (TypeError, ValueError):
        return default
    return max(bounds[0], min(bounds[1], value))


class _StreamServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, frames, size_provider):
        super().__init__(address, _StreamHandler)
        self.frames = frames
        self.size_provider = size_provider
        self.stopping = threading.Event()
        self._clients_lock = threading.Lock()
        self._active_clients = 0

    @property
    def active_clients(self):
        with self._clients_lock:
            return self._active_clients

    def _adjust_clients(self, delta):
        with self._clients_lock:
            self._active_clients += delta


class _StreamHandler(BaseHTTPRequestHandler):
    timeout = _CLIENT_TIMEOUT_SECONDS

    def log_message(self, format, *args):  # noqa: A002 - BaseHTTPRequestHandler imzasi
        pass

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/camera_info":
            self._send_camera_info()
        elif parsed.path == "/video_feed":
            self._stream_video(parse_qs(parsed.query))
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.send_header("Content-Length", "0")
            self.end_headers()

    def _send_camera_info(self):
        width, height = self.server.size_provider()
        body = json.dumps({"width": width, "height": height}).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _stream_video(self, query):
        width = _int_param(query, "width", DEFAULT_WIDTH, _WIDTH_RANGE)
        fps = _int_param(query, "fps", DEFAULT_FPS, _FPS_RANGE)
        quality = _int_param(query, "quality", DEFAULT_QUALITY, _QUALITY_RANGE)
        min_interval = 1.0 / fps

        self.send_response(200)
        self.send_header("Cache-Control", "no-cache, private")
        self.send_header("Pragma", "no-cache")
        self.send_header(
            "Content-Type", f"multipart/x-mixed-replace; boundary={_BOUNDARY.decode()}"
        )
        self._send_cors_headers()
        self.end_headers()

        frames = self.server.frames
        last_seq = 0
        next_due = 0.0

        self.server._adjust_clients(1)
        try:
            while not self.server.stopping.is_set():
                item = frames.wait_for_frame(last_seq, _FRAME_WAIT_SECONDS)
                if item is None:
                    continue

                last_seq, frame = item
                now = time.monotonic()
                if now < next_due:
                    continue  # istemcinin istedigi fps'i asma

                jpeg = frames.jpeg(last_seq, frame, width, quality)
                if jpeg is None:
                    continue

                self.wfile.write(
                    b"--" + _BOUNDARY + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                )
                self.wfile.write(jpeg)
                self.wfile.write(b"\r\n")
                next_due = now + min_interval
        except OSError:
            pass  # istemci ayrildi (kopma, zaman asimi)
        except Exception:
            log.exception("Yayin hatasi")
        finally:
            self.server._adjust_clients(-1)


class MjpegServer:
    def __init__(self, frames, host, port, size_provider):
        """`size_provider` () -> (genislik, yukseklik) donduren bir fonksiyondur."""
        self._frames = frames
        self._host = host
        self._port = port
        self._size_provider = size_provider
        self._server = None
        self._thread = None

    def start(self):
        """Portu hemen baglar; port doluysa OSError firlatir (hata gizlenmez)."""
        self._server = _StreamServer(
            (self._host, self._port), self._frames, self._size_provider
        )
        self._thread = threading.Thread(
            target=self._server.serve_forever, name="mjpeg-server", daemon=True
        )
        self._thread.start()
        log.info("MJPEG yayini http://%s:%d/video_feed adresinde aktif.", self._host, self._port)

    @property
    def active_clients(self):
        """Su anda yayini izleyen istemci sayisi."""
        return self._server.active_clients if self._server is not None else 0

    def stop(self):
        if self._server is None:
            return

        self._server.stopping.set()
        self._server.shutdown()
        self._server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        self._server = None
        log.info("MJPEG yayini durduruldu.")
