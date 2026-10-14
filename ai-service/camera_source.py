"""HTTP MJPEG kaynagindan (ornegin DroidCam) kare okuyan, kopunca kendini toparlayan kaynak."""

import logging
import threading
import time
import urllib.request

import cv2
import numpy as np

from frame_buffer import FrameBuffer
from jpeg_info import jpeg_size

log = logging.getLogger("zenith.camera.source")

_JPEG_START = b"\xff\xd8"
_JPEG_END = b"\xff\xd9"
_READ_CHUNK = 8192
_MAX_GARBAGE_BYTES = 256 * 1024
# Ayni hata mesaji bu surede en fazla bir kez loglanir.
_REPEATED_ERROR_LOG_SECONDS = 300.0


class CameraSource:
    """Aday adresleri sirayla deneyerek en son kareyi `frames` tamponuna yazar.

    `wants_frames` False dondurdugu surece (analiz kapali ve yayini izleyen yok)
    kareler cozulmez; akis yalnizca bagli kalmasi icin okunur. Boylece bos
    dururken CPU harcanmaz.
    """

    def __init__(self, urls, connect_timeout, reconnect_delay, wants_frames=None):
        if not urls:
            raise ValueError("En az bir kamera adresi gerekli.")

        self.frames = FrameBuffer()
        self._urls = tuple(urls)
        self._url_index = 0
        self._connect_timeout = connect_timeout
        self._reconnect_delay = reconnect_delay
        self._wants_frames = wants_frames or (lambda: True)

        self._stop_event = threading.Event()
        self._connected = threading.Event()
        self._thread = None
        self._frame_size = None
        self._frames_skipped = False

        # Adres basina son hata mesaji ve zamani (adaylar arasi gecis spam yapmasin).
        self._logged_failures = {}

    @property
    def connected(self):
        return self._connected.is_set()

    @property
    def active_url(self):
        return self._urls[self._url_index] if self.connected else None

    @property
    def frame_size(self):
        """Kameranin son bilinen (genislik, yukseklik) degeri; baglanti yoksa None."""
        return self._frame_size if self.connected else None

    def start(self):
        if self._thread is not None:
            return

        self._thread = threading.Thread(
            target=self._run, name="camera-source", daemon=True
        )
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=self._connect_timeout + 1.0)

    def _run(self):
        while not self._stop_event.is_set():
            url = self._urls[self._url_index]
            failure = None
            was_connected = False

            try:
                self._stream(url)
            except Exception as exc:
                failure = exc

            was_connected = self._connected.is_set()
            self._set_connected(False, url, failure)
            if failure is not None and not was_connected:
                self._log_connect_failure(url, failure)

            if self._stop_event.is_set():
                break

            # Baglanti kurulamadi ya da koptu: bir sonraki adaya gec.
            self._url_index = (self._url_index + 1) % len(self._urls)
            self._stop_event.wait(self._reconnect_delay)

    def _stream(self, url):
        with urllib.request.urlopen(url, timeout=self._connect_timeout) as stream:
            self._set_connected(True, url)
            buffer = bytearray()

            while not self._stop_event.is_set():
                chunk = stream.read(_READ_CHUNK)
                if not chunk:
                    raise ConnectionError("Kamera stream veri gondermeyi durdurdu.")

                buffer.extend(chunk)
                self._drain_frames(buffer)

    def _drain_frames(self, buffer):
        """Tampondaki tamamlanmis JPEG karelerini isler; kalan kismi tamponda birakir."""
        while True:
            start = buffer.find(_JPEG_START)
            if start == -1:
                # Baslangic isareti yok: tamponun sismesini engelle.
                if len(buffer) > _MAX_GARBAGE_BYTES:
                    del buffer[:-4096]
                return

            if start > 0:
                del buffer[:start]

            end = buffer.find(_JPEG_END, 2)
            if end == -1:
                return

            jpeg = bytes(buffer[: end + 2])
            del buffer[: end + 2]
            self._handle_jpeg(jpeg)

    def _handle_jpeg(self, jpeg):
        size = jpeg_size(jpeg)
        if size is not None:
            self._frame_size = size

        if not self._wants_frames():
            if not self._frames_skipped:
                self.frames.clear()  # izleyici gelince eski kare gosterilmesin
                self._frames_skipped = True
            return

        self._frames_skipped = False
        frame = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is not None and frame.size > 0:
            self.frames.publish(frame)

    def _set_connected(self, connected, url, reason=None):
        if connected == self._connected.is_set():
            return

        if connected:
            self._connected.set()
            self._logged_failures.clear()
            log.info("Kamera baglandi: %s", url)
        else:
            self._connected.clear()
            self._frames_skipped = False
            self.frames.clear()
            detail = f" ({reason.__class__.__name__}: {reason})" if reason else ""
            log.warning("Kamera baglantisi kesildi: %s%s", url, detail)

    def _log_connect_failure(self, url, exc):
        message = f"{exc.__class__.__name__}: {exc}"
        now = time.monotonic()
        last_message, last_at = self._logged_failures.get(url, (None, 0.0))

        if message != last_message or now - last_at >= _REPEATED_ERROR_LOG_SECONDS:
            log.warning("Kameraya baglanilamadi (%s: %s)", url, message)
            self._logged_failures[url] = (message, now)
