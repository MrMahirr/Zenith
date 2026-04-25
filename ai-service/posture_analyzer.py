import cv2
import mediapipe as mp
import threading
import time
from config import CAMERA_URL, POSTURE_THRESHOLD
from connection_manager import ConnectionManager

class GecikmesizKamera:
    def __init__(self, url):
        self.kamera = cv2.VideoCapture(url)
        self.kamera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.basarili, self.kare = self.kamera.read()
        self.calisiyor = True
        
        self.thread = threading.Thread(target=self.guncelle, args=())
        self.thread.daemon = True
        self.thread.start()

    def guncelle(self):
        while self.calisiyor:
            basarili, kare = self.kamera.read()
            if basarili:
                self.basarili, self.kare = basarili, kare
            time.sleep(0.01) # CPU'yu yormamak için küçük bekleme

    def oku(self):
        return self.basarili, self.kare

    def kapat(self):
        self.calisiyor = False
        self.thread.join()
        self.kamera.release()

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
                    
            time.sleep(0.05) # FPS'yi sınırlama

    def stop(self):
        self.running = False
        if self.kamera_motoru:
            self.kamera_motoru.kapat()
        self.postur.close()
        print("[Kamera] Postür analizi durduruldu.")