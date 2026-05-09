import base64
import threading
import time
import urllib.request

import cv2
import mediapipe as mp
import numpy as np

from config import (
    CAMERA_FRAME_EMIT_INTERVAL,
    CAMERA_RECONNECT_DELAY,
    CAMERA_URL,
    POSTURE_EVENT_INTERVAL,
    POSTURE_THRESHOLD,
)
from connection_manager import ConnectionManager


class GecikmesizKamera:
    def __init__(self, url):
        self.url = url
        self.basarili = False
        self.kare = None
        self.calisiyor = True
        self._lock = threading.Lock()
        self._stream_active = False
        self.thread = threading.Thread(target=self.guncelle, daemon=True)
        self.thread.start()

    def _set_stream_state(self, is_active, reason=None):
        if self._stream_active == is_active:
            return

        self._stream_active = is_active

        if is_active:
            print(f"[Kamera] Stream baglandi: {self.url}")
            return

        with self._lock:
            self.basarili = False
            self.kare = None

        if reason:
            print(f"[Kamera] Stream koptu, yeniden baglanilacak: {reason}")
        else:
            print("[Kamera] Stream koptu, yeniden baglanilacak.")

    def guncelle(self):
        while self.calisiyor:
            try:
                with urllib.request.urlopen(self.url, timeout=5) as stream:
                    self._set_stream_state(True)
                    bytes_data = bytearray()

                    while self.calisiyor:
                        chunk = stream.read(8192)
                        if not chunk:
                            raise ConnectionError(
                                "Kamera stream veri gondermeyi durdurdu."
                            )

                        bytes_data.extend(chunk)
                        start = bytes_data.find(b"\xff\xd8")

                        if start == -1:
                            if len(bytes_data) > 256 * 1024:
                                del bytes_data[:-4096]
                            continue

                        if start > 0:
                            del bytes_data[:start]
                            start = 0

                        end = bytes_data.find(b"\xff\xd9", start + 2)
                        if end == -1:
                            continue

                        jpg = bytes(bytes_data[start : end + 2])
                        del bytes_data[: end + 2]

                        frame = cv2.imdecode(
                            np.frombuffer(jpg, dtype=np.uint8),
                            cv2.IMREAD_COLOR,
                        )
                        if frame is None or frame.size == 0:
                            continue

                        with self._lock:
                            self.kare = frame
                            self.basarili = True
            except Exception as exc:
                self._set_stream_state(False, exc)
                time.sleep(CAMERA_RECONNECT_DELAY)

    def oku(self):
        with self._lock:
            return self.basarili, self.kare

    def kapat(self):
        self.calisiyor = False


class PostureAnalyzer:
    def __init__(self):
        self.conn = ConnectionManager()
        self.is_currently_slouching = None
        self.analysis_enabled = False
        self.running = False
        self.kamera_motoru = None
        self.last_frame_emit_at = 0.0
        self.last_posture_emit_at = 0.0
        self.last_distance = 0.0

        self.last_pose_landmarks = None
        self._frame_counter = 0

        self.mp_cizim = mp.solutions.drawing_utils
        self.mp_postur = mp.solutions.pose
        self.postur = self.mp_postur.Pose(
            static_image_mode=False,
            model_complexity=0,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.conn.on("mode_changed", self._handle_mode_change)

    def start(self):
        if self.running:
            return

        self.running = True
        self.kamera_motoru = GecikmesizKamera(CAMERA_URL)
        self.thread = threading.Thread(target=self._process_frames, daemon=True)
        self.thread.start()
        print("[Kamera] Postur analizi baslatildi...")

    def _should_emit_posture(self, slouching_detected):
        if self.is_currently_slouching is None:
            return True

        if slouching_detected != self.is_currently_slouching:
            return True

        return (time.time() - self.last_posture_emit_at) >= POSTURE_EVENT_INTERVAL

    def _emit_posture_update(self, slouching_detected, mesafe):
        self.is_currently_slouching = slouching_detected
        self.last_distance = float(mesafe)
        self.last_posture_emit_at = time.time()
        self.conn.emit(
            "postur_durumu",
            {
                "kambur_mu": slouching_detected,
                "mesafe": round(self.last_distance, 4),
            },
        )

    def _handle_mode_change(self, payload):
        mode = (payload or {}).get("mode", "PASSIVE")
        self.analysis_enabled = mode != "PASSIVE"
        self._frame_counter = 0

        if self.analysis_enabled:
            print(f"[Kamera] Postur analizi aktif: {mode}")
            return

        self.is_currently_slouching = None
        self.last_distance = 0.0
        self.last_posture_emit_at = 0.0
        self.last_pose_landmarks = None
        print("[Kamera] Serbest mod aktif. Postur analizi devre disi.")

    def _process_frames(self):
        while self.running:
            try:
                basarili, kare = self.kamera_motoru.oku()
                if not basarili or kare is None or kare.size == 0:
                    time.sleep(0.1)
                    continue

                if self.analysis_enabled:
                    # Sadece her 3 karede bir MediaPipe analizi yaparak CPU yükünü azaltalım
                    self._frame_counter += 1
                    if self._frame_counter % 3 == 0:
                        kare_rgb = cv2.cvtColor(kare, cv2.COLOR_BGR2RGB)
                        kare_rgb.flags.writeable = False  # MediaPipe'ın gereksiz yere bellek kopyalamasını engelle
                        sonuclar = self.postur.process(kare_rgb)
                        kare_rgb.flags.writeable = True

                        if sonuclar.pose_landmarks:
                            self.last_pose_landmarks = sonuclar.pose_landmarks
                            noktalar = sonuclar.pose_landmarks.landmark

                            if (
                                len(noktalar)
                                > self.mp_postur.PoseLandmark.RIGHT_SHOULDER.value
                            ):
                                burun_y = (
                                    noktalar[self.mp_postur.PoseLandmark.NOSE.value].y
                                )
                                sol_omuz_y = (
                                    noktalar[
                                        self.mp_postur.PoseLandmark.LEFT_SHOULDER.value
                                    ].y
                                )
                                sag_omuz_y = (
                                    noktalar[
                                        self.mp_postur.PoseLandmark.RIGHT_SHOULDER.value
                                    ].y
                                )

                                ortalama_omuz_y = (sol_omuz_y + sag_omuz_y) / 2.0
                                mesafe = ortalama_omuz_y - burun_y
                                slouching_detected = bool(mesafe < POSTURE_THRESHOLD)

                                if self._should_emit_posture(slouching_detected):
                                    self._emit_posture_update(slouching_detected, mesafe)
                        else:
                            self.last_pose_landmarks = None

                    # Çizimleri en son tespit edilen (cached) landmark'larla yaparak görsel akıcılığı koruyalım
                    if self.last_pose_landmarks:
                        self.mp_cizim.draw_landmarks(
                            kare,
                            self.last_pose_landmarks,
                            self.mp_postur.POSE_CONNECTIONS,
                        )

                now = time.time()
                if now - self.last_frame_emit_at >= CAMERA_FRAME_EMIT_INTERVAL:
                    # RPi performansı için görüntüyü küçültelim ve sıkıştırma kalitesini ayarlayalım
                    try:
                        h, w = kare.shape[:2]
                        target_width = 320
                        if w > target_width:
                            target_height = int(h * (target_width / w))
                            kare_gonderim = cv2.resize(
                                kare,
                                (target_width, target_height),
                                interpolation=cv2.INTER_NEAREST,
                            )
                        else:
                            kare_gonderim = kare
                    except Exception as resize_exc:
                        print(f"[Kamera] Resize hatası, orijinal kare kullanılıyor: {resize_exc}")
                        kare_gonderim = kare

                    ret, buffer = cv2.imencode(
                        ".jpg",
                        kare_gonderim,
                        [cv2.IMWRITE_JPEG_QUALITY, 30],
                    )
                    if ret:
                        frame_b64 = base64.b64encode(buffer).decode("utf-8")
                        self.conn.emit("kamera_kare", frame_b64)
                        self.last_frame_emit_at = now
            except Exception as exc:
                print(f"[Kamera Hata] Isleme hatasi: {exc}")

            time.sleep(0.05)

    def stop(self):
        self.running = False

        if hasattr(self, "thread") and self.thread.is_alive():
            self.thread.join(timeout=1.5)

        if self.kamera_motoru:
            self.kamera_motoru.kapat()

        self.postur.close()
        print("[Kamera] Postur analizi durduruldu.")
