import cv2
import mediapipe as mp
import threading
import time
import base64
import urllib.request
import numpy as np
from config import CAMERA_URL, POSTURE_THRESHOLD
from connection_manager import ConnectionManager

class GecikmesizKamera:
    def __init__(self, url):
        self.url = url
        self.basarili = False
        self.kare = None
        self.calisiyor = True
        
        self.thread = threading.Thread(target=self.guncelle, args=())
        self.thread.daemon = True
        self.thread.start()

    def guncelle(self):
        bytes_data = bytes()
        while self.calisiyor:
            try:
                # C++ FFMPEG çökmelerini engellemek için HTTP üzerinden raw MJPEG okuması yapıyoruz
                stream = urllib.request.urlopen(self.url, timeout=5)
                while self.calisiyor:
                    chunk = stream.read(4096)
                    if not chunk:
                        break
                    bytes_data += chunk
                    a = bytes_data.find(b'\xff\xd8') # JPEG Başlangıç
                    b = bytes_data.find(b'\xff\xd9') # JPEG Bitiş
                    if a != -1 and b != -1:
                        jpg = bytes_data[a:b+2]
                        bytes_data = bytes_data[b+2:]
                        
                        kare = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                        if kare is not None:
                            self.basarili = True
                            self.kare = kare
            except Exception as e:
                self.basarili = False
                time.sleep(2) # Bağlantı koparsa 2 saniye bekle ve tekrar dene

    def oku(self):
        return self.basarili, self.kare

    def kapat(self):
        self.calisiyor = False
        if hasattr(self, 'thread') and self.thread.is_alive():
            self.thread.join(timeout=1.0)

class PostureAnalyzer:
    def __init__(self):
        self.conn = ConnectionManager()
        self.is_currently_slouching = False
        self.running = False
        self.kamera_motoru = None
        
        self.mp_cizim = mp.solutions.drawing_utils
        self.mp_postur = mp.solutions.pose
        self.postur = self.mp_postur.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

    def start(self):
        self.running = True
        self.kamera_motoru = GecikmesizKamera(CAMERA_URL)
        print("[Kamera] Postür analizi başlatıldı...")
        
        self.thread = threading.Thread(target=self._process_frames)
        self.thread.daemon = True
        self.thread.start()

    def _process_frames(self):
        while self.running:
            basarili, kare = self.kamera_motoru.oku()
            if not basarili or kare is None:
                time.sleep(0.1)
                continue

            kare_rgb = cv2.cvtColor(kare, cv2.COLOR_BGR2RGB)
            sonuclar = self.postur.process(kare_rgb)

            if sonuclar.pose_landmarks:
                self.mp_cizim.draw_landmarks(kare, sonuclar.pose_landmarks, self.mp_postur.POSE_CONNECTIONS)
                noktalar = sonuclar.pose_landmarks.landmark
                burun_y = noktalar[self.mp_postur.PoseLandmark.NOSE.value].y
                sol_omuz_y = noktalar[self.mp_postur.PoseLandmark.LEFT_SHOULDER.value].y
                sag_omuz_y = noktalar[self.mp_postur.PoseLandmark.RIGHT_SHOULDER.value].y
                
                ortalama_omuz_y = (sol_omuz_y + sag_omuz_y) / 2.0
                mesafe = ortalama_omuz_y - burun_y

                # Durum Kontrolü
                slouching_detected = bool(mesafe < POSTURE_THRESHOLD)

                # Sadece durum değiştiğinde sinyal gönder (Throttling)
                if slouching_detected != self.is_currently_slouching:
                    self.is_currently_slouching = slouching_detected
                    
                    self.conn.emit('postur_durumu', {
                        'kambur_mu': self.is_currently_slouching,
                        'mesafe': float(mesafe)
                    })
                    
            
            # Çizimli kareyi frontend için gönder (50% kalite)
            ret, buffer = cv2.imencode('.jpg', kare, [cv2.IMWRITE_JPEG_QUALITY, 50])
            if ret:
                frame_b64 = base64.b64encode(buffer).decode('utf-8')
                self.conn.emit('kamera_kare', frame_b64)
                
            time.sleep(0.05) # FPS'yi sınırlama (Maks ~20 FPS)

    def stop(self):
        self.running = False
        if self.kamera_motoru:
            self.kamera_motoru.kapat()
        self.postur.close()
        print("[Kamera] Postür analizi durduruldu.")