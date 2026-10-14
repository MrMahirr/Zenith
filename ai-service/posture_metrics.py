"""Postur analizinin donanimdan bagimsiz (OpenCV/MediaPipe gerektirmeyen) mantigi."""

import time


def head_to_shoulder_distance(nose_y, left_shoulder_y, right_shoulder_y):
    """Burun ile omuz hattinin ortalamasi arasindaki dikey mesafe (normalize 0-1).

    Goruntude y ekseni asagi dogru buyudugu icin kisi dik oturdukca omuzlar
    burnun altinda kalir ve deger buyur; kamburlasinca deger kuculur.
    """
    return (left_shoulder_y + right_shoulder_y) / 2.0 - nose_y


def is_slouching(distance, threshold):
    return distance < threshold


def landmarks_visible(visibilities, minimum):
    """Verilen tum noktalarin gorunurlugu `minimum` esigini geciyorsa True."""
    return all(value >= minimum for value in visibilities)


class EmitThrottle:
    """Postur olaylarinin backend'e ne zaman gonderilecegine karar verir.

    Durum degistiginde hemen, degismediginde ise `interval` saniyede bir olay
    gonderilir. Zaman kaynagi test edilebilirlik icin disaridan verilebilir.
    """

    def __init__(self, interval, clock=time.monotonic):
        self._interval = interval
        self._clock = clock
        self._last_state = None
        self._last_emit_at = 0.0

    @property
    def last_state(self):
        return self._last_state

    def should_emit(self, slouching):
        if self._last_state is None or slouching != self._last_state:
            return True
        return (self._clock() - self._last_emit_at) >= self._interval

    def mark_emitted(self, slouching):
        self._last_state = slouching
        self._last_emit_at = self._clock()

    def reset(self):
        self._last_state = None
        self._last_emit_at = 0.0
