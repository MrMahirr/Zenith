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
        self.thread = threading.Thread(target=self.guncelle)
        self.thread.daemon = True
        self.thread.start()

    def guncelle(self):
        while self.calisiyor:
            stream = None
            try:
                # Timeout süresini kısalttık, bloklanmayı önledik
                stream = urllib.request.urlopen(self.url, timeout=3)
                bytes_data = bytes()
                while self.calisiyor:
                    chunk = stream.read(8192) # Buffer boyutunu artırdık
                    if not chunk:
                        break
                    bytes_data += chunk
                    a = bytes_data.find(b'\xff\xd8')
                    b = bytes_data.find(b'\xff\xd9')
                    if a != -1 and b != -1:
                        jpg = bytes_data[a:b+2]
                        bytes_data = bytes_data[b+2:]
                        
                        # Ham veriyi decode etmeden önce kontrol
                        nparr = np.frombuffer(jpg, dtype=np.uint8)
                        kare = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        
                        if kare is not None and kare.size > 0:
                            self.kare = kare
                            self.basarili = True
                        
                        # CPU'yu rahatlatmak için çok kısa bir es
                        time.sleep(0.01)
            except Exception as e:
                self.basarili = False
                # Hata durumunda stream'i kapat ve bekle
                if stream: stream.close()
                time.sleep(2) 
            finally:
                if stream: stream.close()

    def oku(self):
        return self.basarili, self.kare

    def kapat(self):
        self.calisiyor = False

class PostureAnalyzer:
    def __init__(self):
        self.conn = ConnectionManager()
        self.is_currently_slouching = False
        self.running = False
        self.kamera_motoru = None
        
        # Mediapipe ayarlarını daha hafif hale getirdik
        self.mp_cizim = mp.solutions.drawing_utils
        self.mp_postur = mp.solutions.pose
        self.postur = self.mp_postur.Pose(
            static_image_mode=False,
            model_complexity=0, # Pi için 0 (en hızlısı), PC için 1 idealdir
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    def start(self):
        if not self.running:
            self.running = True
            self.kamera_motoru = GecikmesizKamera(CAMERA_URL)
            self.thread = threading.Thread(target=self._process_frames)
            self.thread.daemon = True
            self.thread.start()
            print("[Kamera] Postür analizi başlatıldı...")

    def _process_frames(self):
        while self.running:
            try:
                basarili, kare = self.kamera_motoru.oku()
                
                # Kare kontrolü çok kritik
                if not basarili or kare is None or kare.size == 0:
                    time.sleep(0.1)
                    continue

                kare_rgb = cv2.cvtColor(kare, cv2.COLOR_BGR2RGB)
                sonuclar = self.postur.process(kare_rgb)

                if sonuclar.pose_landmarks:
                    noktalar = sonuclar.pose_landmarks.landmark
                    
                    # Güvenlik: Landmark listesi tam mı?
                    if len(noktalar) > self.mp_postur.PoseLandmark.RIGHT_SHOULDER.value:
                        burun_y = noktalar[self.mp_postur.PoseLandmark.NOSE.value].y
                        sol_omuz_y = noktalar[self.mp_postur.PoseLandmark.LEFT_SHOULDER.value].y
                        sag_omuz_y = noktalar[self.mp_postur.PoseLandmark.RIGHT_SHOULDER.value].y
                        
                        ortalama_omuz_y = (sol_omuz_y + sag_omuz_y) / 2.0
                        mesafe = ortalama_omuz_y - burun_y

                        slouching_detected = bool(mesafe < POSTURE_THRESHOLD)

                        if slouching_detected != self.is_currently_slouching:
                            self.is_currently_slouching = slouching_detected
                            self.conn.emit('postur_durumu', {
                                'kambur_mu': self.is_currently_slouching,
                                'mesafe': round(float(mesafe), 4)
                            })

                    # Görselleştirme (opsiyonel, istersen kapatıp hızı artırabilirsin)
                    self.mp_cizim.draw_landmarks(kare, sonuclar.pose_landmarks, self.mp_postur.POSE_CONNECTIONS)

                # Base64 gönderimini sadece belirli aralıklarla yap (Bandwidth tasarrufu)
                ret, buffer = cv2.imencode('.jpg', kare, [cv2.IMWRITE_JPEG_QUALITY, 40])
                if ret:
                    frame_b64 = base64.b64encode(buffer).decode('utf-8')
                    self.conn.emit('kamera_kare', frame_b64)

            except Exception as e:
                print(f"[Kamera Hata] İşleme hatası: {e}")
            
            time.sleep(0.05) # ~20 FPS

    def stop(self):
        self.running = False
        if self.kamera_motoru:
            self.kamera_motoru.kapat()
        self.postur.close()
        print("[Kamera] Postür analizi durduruldu.")