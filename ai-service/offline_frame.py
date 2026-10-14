"""Kamera baglantisi yokken yayinda gosterilen hafif yer tutucu kare."""

import time

import cv2
import numpy as np

WIDTH = 320
HEIGHT = 240

_BACKGROUND_BGR = (26, 14, 10)
_TEXT_BGR = (200, 200, 200)
_MUTED_BGR = (140, 140, 140)
_ALERT_BGR = (80, 80, 240)


def render_offline_frame(now=None):
    """320x240 'kamera cevrimdisi' karesi uretir (OpenCV fontlari Turkce karakter desteklemez)."""
    clock = time.localtime(now)
    frame = np.full((HEIGHT, WIDTH, 3), _BACKGROUND_BGR, dtype=np.uint8)

    cv2.circle(frame, (30, 30), 6, _ALERT_BGR, -1)
    cv2.putText(frame, "CAMERA OFFLINE", (48, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.6, _TEXT_BGR, 1, cv2.LINE_AA)
    cv2.putText(frame, "Waiting for camera stream...", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.5, _MUTED_BGR, 1, cv2.LINE_AA)
    cv2.putText(frame, time.strftime("%H:%M:%S", clock), (20, 215), cv2.FONT_HERSHEY_SIMPLEX, 0.5, _MUTED_BGR, 1, cv2.LINE_AA)
    return frame
