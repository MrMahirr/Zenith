import cv2
import mediapipe as mp
import threading
import math
import socketio # YENİ: Node.js ile konuşacak elçimiz

# DİKKAT: iPhone/Android IP adresi
URL = "http://192.168.6.28:4747/video"

# --- SİSTEM SOKET BAĞLANTISI ---
# Hata dedektifi açık (Bağlanamazsa kırmızı kırmızı nedenini yazacak)
sio = socketio.Client(logger=True, engineio_logger=True)
try:
    # NestJS aynı Pi'de çalıştığı için 127.0.0.1 kalabilir. 
    # Eğer bağlanmazsa buraya Pi'nin ağdaki IP'sini yaz (örn: 192.168.6.X)
    sio.connect('http://127.0.0.1:3000') 
    print("Backend sunucusuna başarıyla bağlanıldı!")
except Exception as e:
    print(f"UYARI: Backend'e bağlanılamadı! Hata: {e}")
# -------------------------------

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

    def oku(self):
        return self.basarili, self.kare

    def kapat(self):
        self.calisiyor = False
        self.thread.join()
        self.kamera.release()

mp_cizim = mp.solutions.drawing_utils
mp_postur = mp.solutions.pose

kamera_motoru = GecikmesizKamera(URL)

print("Zenith Yapay Zeka Beyni Aktif... Çıkmak için 'q' tuşuna basın.")

with mp_postur.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as postur:
    while True:
        basarili, kare = kamera_motoru.oku()
        if not basarili or kare is None:
            continue

        kare_rgb = cv2.cvtColor(kare, cv2.COLOR_BGR2RGB)
        sonuclar = postur.process(kare_rgb)

        if sonuclar.pose_landmarks:
            mp_cizim.draw_landmarks(
                kare, 
                sonuclar.pose_landmarks, 
                mp_postur.POSE_CONNECTIONS,
                mp_cizim.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                mp_cizim.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=2)
            )

            noktalar = sonuclar.pose_landmarks.landmark
            burun_y = noktalar[mp_postur.PoseLandmark.NOSE.value].y
            sol_omuz_y = noktalar[mp_postur.PoseLandmark.LEFT_SHOULDER.value].y
            sag_omuz_y = noktalar[mp_postur.PoseLandmark.RIGHT_SHOULDER.value].y
            
            ortalama_omuz_y = (sol_omuz_y + sag_omuz_y) / 2.0
            mesafe = ortalama_omuz_y - burun_y

            # --- SOKET VERİ GÖNDERİMİ (KRİTİK DÜZELTME) ---
            # Numpy tiplerini Node.js'in anlayacağı standart tiplere çeviriyoruz
            kambur = bool(mesafe < 0.15) 
            mesafe_temiz = float(mesafe)

            if sio.connected:
                try:
                    sio.emit('postur_durumu', {
                        'kambur_mu': kambur,
                        'mesafe': mesafe_temiz
                    })
                except Exception as e:
                    print(f"Veri Gönderim Hatası: {e}")
            # --------------------------------------------------------

            if kambur:
                cv2.putText(kare, "DIKKAT: KAMBUR DURUYORSUN!", (30, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3, cv2.LINE_AA)
            else:
                cv2.putText(kare, "DURUSUN HARIKA!", (30, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)

        cv2.imshow("Zenith AI - Durus Analizi", kare)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

# Çıkarken soket bağlantısını nazikçe kapatıyoruz
if sio.connected:
    sio.disconnect()
kamera_motoru.kapat()
cv2.destroyAllWindows()