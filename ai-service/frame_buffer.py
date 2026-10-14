"""Kareleri iki uretici/tuketici arasinda paylasan, JPEG'i talep uzerine ureten tampon."""

import threading

import cv2


def encode_jpeg(frame, width, quality):
    """Kareyi (gerekirse kucultup) JPEG'e cevirir. Buyutme yapilmaz."""
    height, native_width = frame.shape[:2]
    if width < native_width:
        scaled_height = max(1, int(height * (width / native_width)))
        frame = cv2.resize(frame, (width, scaled_height), interpolation=cv2.INTER_AREA)

    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buffer.tobytes() if ok else None


class FrameBuffer:
    """En son kareyi tutar ve yeni kare gelince bekleyenleri uyandirir.

    Sozlesme: `publish` edilen kare sonradan degistirilmemelidir; tuketiciler
    ayni diziyi kopyalamadan paylasir.
    """

    def __init__(self):
        self._cond = threading.Condition()
        self._frame = None
        self._seq = 0
        self._jpeg_cache = {}

    def publish(self, frame):
        with self._cond:
            self._frame = frame
            self._seq += 1
            self._jpeg_cache.clear()
            self._cond.notify_all()

    def clear(self):
        """Eski kareyi unutturur. Sayac geriye gitmez, bekleyenler yeni kareyi bekler."""
        with self._cond:
            self._frame = None
            self._jpeg_cache.clear()

    def wait_for_frame(self, last_seq, timeout):
        """`last_seq`'den yeni bir kare gelene kadar bekler. (seq, kare) ya da None doner."""
        with self._cond:
            self._cond.wait_for(
                lambda: self._frame is not None and self._seq > last_seq, timeout
            )
            if self._frame is not None and self._seq > last_seq:
                return self._seq, self._frame
            return None

    def jpeg(self, seq, frame, width, quality):
        """Belirtilen kare icin JPEG uretir; ayni kare/ayar tekrar istenirse onbellekten verir."""
        key = (width, quality)
        with self._cond:
            cached = self._jpeg_cache.get(key) if self._seq == seq else None
        if cached is not None:
            return cached

        data = encode_jpeg(frame, width, quality)

        if data is not None:
            with self._cond:
                if self._seq == seq:
                    self._jpeg_cache[key] = data
        return data
