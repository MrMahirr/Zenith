import base64
from http.server import BaseHTTPRequestHandler, HTTPServer
import socketserver
import threading
import time
import urllib.request
from urllib.parse import urlparse, parse_qs

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


class ThreadedHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    """Low-overhead multithreaded HTTP server to handle streaming requests."""
    daemon_threads = True
    allow_reuse_address = True


class MJPEGHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Disable logging requests to console for maximum performance and clean logs
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/camera_info':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            width = getattr(self.server.analyzer, 'native_width', 320)
            height = getattr(self.server.analyzer, 'native_height', 240)
            
            response = f'{{"width": {width}, "height": {height}}}'
            self.wfile.write(response.encode('utf-8'))
            return

        elif parsed_path.path == '/video_feed':
            # Parametreleri oku (Varsayılan değerler: 320px, 15fps, 30 kalite)
            query = parse_qs(parsed_path.query)
            try:
                width = int(query.get('width', [320])[0])
                fps = int(query.get('fps', [15])[0])
                quality = int(query.get('quality', [30])[0])
            except ValueError:
                width = 320
                fps = 15
                quality = 30

            # FPS'e göre minimum bekleme süresini hesapla
            frame_delay = 1.0 / fps if fps > 0 else 0.066

            self.send_response(200)
            self.send_header('Age', '0')
            self.send_header('Cache-Control', 'no-cache, private')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            try:
                last_sent_time = 0
                while getattr(self.server, 'running', False):
                    now = time.time()
                    if now - last_sent_time < frame_delay:
                        time.sleep(0.005)
                        continue

                    # Eğer özel bir çözünürlük veya kalite istenmişse raw_frame üzerinden anlık sıkıştırıyoruz
                    if width != 320 or quality != 30:
                        raw_frame = self.server.analyzer.get_latest_raw_frame()
                        if raw_frame is not None:
                            try:
                                h, w = raw_frame.shape[:2]
                                if w != width:
                                    height = int(h * (width / w))
                                    frame_to_encode = cv2.resize(raw_frame, (width, height), interpolation=cv2.INTER_LINEAR)
                                else:
                                    frame_to_encode = raw_frame
                                
                                ret, buffer = cv2.imencode('.jpg', frame_to_encode, [cv2.IMWRITE_JPEG_QUALITY, quality])
                                jpg_bytes = buffer.tobytes() if ret else None
                            except Exception:
                                jpg_bytes = self.server.analyzer.get_latest_frame()
                        else:
                            jpg_bytes = self.server.analyzer.get_latest_frame()
                    else:
                        # Varsayılan değerler için önceden sıkıştırılmış (sıfır ek CPU) kareyi gönderiyoruz
                        jpg_bytes = self.server.analyzer.get_latest_frame()

                    if jpg_bytes:
                        self.wfile.write(b'--frame\r\n')
                        self.send_header('Content-Type', 'image/jpeg')
                        self.send_header('Content-Length', str(len(jpg_bytes)))
                        self.end_headers()
                        self.wfile.write(jpg_bytes)
                        self.wfile.write(b'\r\n')
                        last_sent_time = now
                    else:
                        time.sleep(0.02)
            except (ConnectionResetError, BrokenPipeError):
                pass
            except Exception as e:
                print(f"[Kamera Stream] Yayın hatası: {e}")
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()


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
        self.native_width = 320
        self.native_height = 240

        self.last_pose_landmarks = None
        self._frame_counter = 0
        self.last_jpg_bytes = None
        self.mjpeg_server = None

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

        # RPi CPU/RAM yükünü sıfırlamak için yüksek performanslı MJPEG Stream Server'ı başlatalım
        self._start_mjpeg_server()
        print("[Kamera] Postur analizi ve MJPEG Stream sunucusu baslatildi...")

    def _start_mjpeg_server(self):
        def run_server():
            port = 5001
            try:
                server = ThreadedHTTPServer(('0.0.0.0', port), MJPEGHandler)
                server.analyzer = self
                server.running = True
                self.mjpeg_server = server
                print(f"[Kamera Stream] MJPEG HTTP Yayini http://localhost:{port}/video_feed adresinde aktif.")
                server.serve_forever()
            except Exception as e:
                print(f"[Kamera Stream] MJPEG Server baslatilamadi: {e}")

        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()

    def get_latest_frame(self):
        return self.last_jpg_bytes

    def get_latest_raw_frame(self):
        return getattr(self, 'last_raw_frame', None)

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
                    # Fiziksel kamera çevrimdışı ise şık bir sanal 1080p demo karesi üretip yayına verelim!
                    kare = self._generate_mock_frame()
                    basarili = True

                # Yerel çözünürlüğü tespit et ve kaydet
                h, w = kare.shape[:2]
                self.native_width = w
                self.native_height = h

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

                # RPi performansı için her kareyi 320px olarak tek bir kez sıkıştırıyoruz (MJPEG ve WS ortak kullanacak)
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

                    ret, buffer = cv2.imencode(
                        ".jpg",
                        kare_gonderim,
                        [cv2.IMWRITE_JPEG_QUALITY, 30],
                    )
                    if ret:
                        self.last_jpg_bytes = buffer.tobytes() # MJPEG burayı doğrudan kullanır (Sıfır ek CPU)
                        self.last_raw_frame = kare.copy()
                        
                        # Direct MJPEG HTTP Stream sayesinde ağır base64 dönüşümleri ve Socket.io trafiği tamamen kaldırılmıştır.
                        # RPi CPU, Bellek ve Ağ bant genişliği tasarrufu maksimuma çıkarıldı.
                        pass
                except Exception as stream_exc:
                    print(f"[Kamera] Sıkıştırma hatası: {stream_exc}")
            except Exception as exc:
                print(f"[Kamera Hata] İşleme hatası: {exc}")

            time.sleep(0.05)

    def _generate_mock_frame(self):
        """Kamera baglantisi koptugunda veya olmadiginda uretilen yuksek kaliteli 1080p canlı test karesi."""
        width, height = 1920, 1080
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Lacivert/Siyah teknolojik arka plan (BGR: #0A0E1A)
        frame[:, :] = [26, 14, 10]
        
        # Izgara (Grid) çizgileri
        grid_size = 80
        for x in range(0, width, grid_size):
            cv2.line(frame, (x, 0), (x, height), (35, 25, 20), 1)
        for y in range(0, height, grid_size):
            cv2.line(frame, (0, y), (width, y), (35, 25, 20), 1)
            
        # Canli akis illüzyonu icin hareketli tarama dairesi
        t = time.time()
        cx = int(width / 2 + 300 * np.cos(t * 1.5))
        cy = int(height / 2 + 150 * np.sin(t * 1.5))
        
        # Hedef dairesi çizimi
        cv2.circle(frame, (cx, cy), 40, (246, 130, 59), 2) # Mavi halka
        cv2.circle(frame, (cx, cy), 4, (246, 130, 59), -1)
        
        # Sanal postur iskeleti
        cv2.circle(frame, (cx, cy - 100), 25, (80, 220, 80), 2) # Bas
        cv2.line(frame, (cx - 120, cy), (cx + 120, cy), (80, 220, 80), 3) # Omuzlar
        cv2.line(frame, (cx, cy), (cx, cy + 200), (80, 220, 80), 3) # Omurga
        
        # Yanip sönen kırmızı durum göstergesi (Blinking REC indicator)
        is_on = int(t * 2) % 2 == 0
        indicator_color = (80, 80, 240) if is_on else (40, 40, 120)
        cv2.circle(frame, (80, 80), 12, indicator_color, -1)
        
        # Bilgilendirici yazilar
        cv2.putText(frame, "DEMO MODE - CAMERA OFFLINE", (110, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (200, 200, 200), 2)
        
        # Zaman damgasi
        time_str = time.strftime("%H:%M:%S", time.localtime())
        cv2.putText(frame, f"TIME: {time_str}", (width - 320, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (120, 200, 120), 2)
        
        # Cozunurluk metadatasi
        cv2.putText(frame, "NATIVE SOURCE: 1920x1080 (1080p)", (110, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (120, 120, 120), 1)
        
        return frame

    def stop(self):
        self.running = False
        if self.mjpeg_server:
            try:
                self.mjpeg_server.running = False
                self.mjpeg_server.shutdown()
                self.mjpeg_server.server_close()
                print("[Kamera Stream] MJPEG HTTP Yayını durduruldu.")
            except Exception:
                pass

        if hasattr(self, "thread") and self.thread.is_alive():
            self.thread.join(timeout=1.5)

        if self.kamera_motoru:
            self.kamera_motoru.kapat()

        self.postur.close()
        print("[Kamera] Postur analizi durduruldu.")
