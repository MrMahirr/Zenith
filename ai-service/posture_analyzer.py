"""Kameradan gelen kareleri MediaPipe ile analiz edip postur olaylarini backend'e iletir."""

import logging
import threading

import cv2
import mediapipe as mp

from camera_source import CameraSource
from camera_urls import resolve_camera_urls
from config import (
    CAMERA_CONNECT_TIMEOUT,
    CAMERA_RECONNECT_DELAY,
    CAMERA_URLS,
    MJPEG_HOST,
    MJPEG_PORT,
    POSTURE_ANALYSIS_FRAME_STEP,
    POSTURE_EVENT_INTERVAL,
    POSTURE_MIN_VISIBILITY,
    POSTURE_THRESHOLD,
)
from connection_manager import ConnectionManager
from frame_buffer import FrameBuffer
from mjpeg_server import MjpegServer
from offline_frame import HEIGHT as OFFLINE_HEIGHT
from offline_frame import WIDTH as OFFLINE_WIDTH
from offline_frame import render_offline_frame
from runtime_settings import POSTURE_THRESHOLD_RANGE, coerce_number
from hardware_report import OK, WARN, device
from posture_metrics import (
    EmitThrottle,
    head_to_shoulder_distance,
    is_slouching,
    landmarks_visible,
)

log = logging.getLogger("zenith.camera")

_PoseLandmark = mp.solutions.pose.PoseLandmark
_TRACKED_LANDMARKS = (
    _PoseLandmark.NOSE,
    _PoseLandmark.LEFT_SHOULDER,
    _PoseLandmark.RIGHT_SHOULDER,
)
# Kamera yokken yer tutucu karenin yenilenme araligi (saniye).
_OFFLINE_FRAME_INTERVAL = 1.0


class PostureAnalyzer:
    def __init__(self):
        self.conn = ConnectionManager()

        self._camera = CameraSource(
            CAMERA_URLS,
            CAMERA_CONNECT_TIMEOUT,
            CAMERA_RECONNECT_DELAY,
            wants_frames=self._needs_frames,
            on_state_change=self._publish_camera_status,
        )
        self._output = FrameBuffer()
        self._server = MjpegServer(
            self._output, MJPEG_HOST, MJPEG_PORT, self._native_size
        )
        self._throttle = EmitThrottle(POSTURE_EVENT_INTERVAL)
        # Panelden degistirilebilir; baslangicta .env degeri gecerlidir.
        self._threshold = POSTURE_THRESHOLD

        self._pose_module = mp.solutions.pose
        self._drawing = mp.solutions.drawing_utils
        self._pose = self._pose_module.Pose(
            static_image_mode=False,
            model_complexity=0,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        self._stop_event = threading.Event()
        self._thread = None

        # Mod degisimi socket is parcaciginda gelir; durum degisiklikleri
        # islem dongusunde uygulanir (kilitsiz, tek yazar).
        self._analysis_enabled = False
        self._reset_requested = threading.Event()
        self._frame_counter = 0
        self._last_landmarks = None

        self.conn.on("mode_changed", self._handle_mode_change)
        self.conn.on("camera_config", self._handle_camera_config)
        self.conn.on("settings_changed", self._handle_settings)
        self.conn.on_connect(self._on_backend_connected)

    # --- Yasam dongusu -------------------------------------------------------

    def start(self):
        if self._thread is not None:
            return

        self._server.start()  # port doluysa burada hata verir
        self._camera.start()

        self._thread = threading.Thread(
            target=self._run, name="posture-analyzer", daemon=True
        )
        self._thread.start()
        log.info("Postur analizi ve MJPEG yayin sunucusu baslatildi.")

    def stop(self):
        self._stop_event.set()

        if self._thread is not None:
            self._thread.join(timeout=2.0)

        self._camera.stop()
        self._server.stop()
        self._pose.close()
        log.info("Postur analizi durduruldu.")

    # --- Backend olaylari ----------------------------------------------------

    def _handle_mode_change(self, payload):
        mode = (payload or {}).get("mode", "PASSIVE")
        self._analysis_enabled = mode != "PASSIVE"
        self._reset_requested.set()

        if self._analysis_enabled:
            log.info("Postur analizi aktif: %s", mode)
        else:
            log.info("Serbest mod aktif. Postur analizi devre disi.")

    def _handle_camera_config(self, payload):
        """Backend'den gelen kamera adresi ayarini uygular (null = varsayilanlara don)."""
        runtime_url = payload.get("url") if isinstance(payload, dict) else None
        urls = resolve_camera_urls(runtime_url, CAMERA_URLS)

        if self._camera.set_urls(urls):
            origin = "ayarli adres" if runtime_url else "varsayilan adresler"
            log.info("Kamera kaynagi degisti: %s kullaniliyor.", origin)

    def _handle_settings(self, payload):
        """Panelden degistirilen duruş esigini uygular (null = .env degeri)."""
        raw = payload.get("postureThreshold") if isinstance(payload, dict) else None
        threshold = coerce_number(raw, POSTURE_THRESHOLD, POSTURE_THRESHOLD_RANGE)

        if threshold != self._threshold:
            self._threshold = threshold
            self._throttle.reset()
            log.info("Postur esigi guncellendi: %.2f", threshold)

    def _on_backend_connected(self):
        """(Yeniden) baglaninca guncel adresi ister ve mevcut kamera durumunu bildirir."""
        self.conn.emit("camera_config_subscribe")
        self.conn.emit("settings_subscribe")
        self._publish_camera_status(self._camera.connected)

    def _publish_camera_status(self, connected):
        self.conn.emit("camera_status", {"connected": bool(connected)})

        if connected:
            report = device("camera", "Kamera akisi", OK, "Baglandi")
        else:
            report = device(
                "camera", "Kamera akisi", WARN,
                "Akis yok; telefondaki kamera uygulamasi acik ve ayni agda mi?",
            )
        self.conn.emit("hardware_status", {"devices": [report]})

    # --- Islem dongusu -------------------------------------------------------

    def _needs_frames(self):
        """Kare cozmek yalnizca analiz aciksa ya da yayini izleyen varsa anlamlidir."""
        return self._analysis_enabled or self._server.active_clients > 0

    def _native_size(self):
        return self._camera.frame_size or (OFFLINE_WIDTH, OFFLINE_HEIGHT)

    def _run(self):
        last_seq = 0

        while not self._stop_event.is_set():
            try:
                if self._reset_requested.is_set():
                    self._reset_requested.clear()
                    self._reset_analysis_state()

                item = self._camera.frames.wait_for_frame(
                    last_seq, _OFFLINE_FRAME_INTERVAL
                )

                if item is not None:
                    last_seq, frame = item
                    self._process_live_frame(frame)
                elif not self._camera.connected:
                    self._publish_offline_frame()
            except Exception:
                log.exception("Kare isleme hatasi")
                self._stop_event.wait(0.5)

    def _reset_analysis_state(self):
        self._throttle.reset()
        self._frame_counter = 0
        self._last_landmarks = None

    def _publish_offline_frame(self):
        self._last_landmarks = None
        self._output.publish(render_offline_frame())

    def _process_live_frame(self, frame):
        output = frame
        if self._analysis_enabled:
            self._frame_counter += 1
            if self._frame_counter % POSTURE_ANALYSIS_FRAME_STEP == 0:
                self._analyze(frame)

            if self._last_landmarks is not None:
                # Yayindaki kare degistirilmemeli; yalnizca cizim gerektiginde kopyala.
                output = frame.copy()
                self._drawing.draw_landmarks(
                    output, self._last_landmarks, self._pose_module.POSE_CONNECTIONS
                )

        self._output.publish(output)

    def _analyze(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False  # MediaPipe'in gereksiz kopyalamasini engeller
        result = self._pose.process(rgb)

        landmarks = result.pose_landmarks
        if landmarks is None:
            self._last_landmarks = None
            return

        points = landmarks.landmark
        tracked = [points[landmark.value] for landmark in _TRACKED_LANDMARKS]
        if not landmarks_visible(
            [point.visibility for point in tracked], POSTURE_MIN_VISIBILITY
        ):
            # Omuzlar/burun kadraj disinda: olcum guvenilmez, alarm uretme.
            self._last_landmarks = None
            return

        self._last_landmarks = landmarks
        nose, left_shoulder, right_shoulder = tracked
        distance = head_to_shoulder_distance(nose.y, left_shoulder.y, right_shoulder.y)
        slouching = is_slouching(distance, self._threshold)

        if self._throttle.should_emit(slouching):
            self._throttle.mark_emitted(slouching)
            self.conn.emit(
                "postur_durumu",
                {"kambur_mu": slouching, "mesafe": round(float(distance), 4)},
            )
