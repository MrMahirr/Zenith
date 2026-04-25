import cv2
import mediapipe as mp
import socketio
import time
import math

# --- Socket.io Bağlantısı ---
sio = socketio.Client()

@sio.event
def connect():
    print("[AI] NestJS Backend'e başarıyla bağlandı!")

@sio.event
def disconnect():
    print("[AI] Bağlantı kesildi!")

# NestJS sunucusuna bağlan
try:
    sio.connect('http://localhost:3000')
except:
    print("Hata: Backend'e bağlanılamadı. Önce NestJS'i çalıştırın.")

# --- Mediapipe Kurulumu ---
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
cap = cv2.VideoCapture(0) # Pi Camera veya USB WebCam

# Eşik Değeri (Kendi oturuşuna göre bu 0.15 değerini biraz değiştirebilirsin)
POSTURE_THRESHOLD = 0.15 
is_currently_slouching = False

print("Zenith AI Analizi Başlatıldı...")

try:
    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        # İşlem hızını artırmak için görüntüyü RGB'ye çeviriyoruz
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)

        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark

            # Kritik Noktalar: Burun ve Omuzlar
            nose = landmarks[mp_pose.PoseLandmark.NOSE]
            l_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
            r_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]

            # Omuzların orta noktasını hesapla
            shoulder_mid_y = (l_shoulder.y + r_shoulder.y) / 2
            
            # Burun ile omuz hizası arasındaki dikey mesafe
            distance = shoulder_mid_y - nose.y

            # Durum Kontrolü
            slouching_detected = distance < POSTURE_THRESHOLD

            # Sadece durum değiştiğinde sinyal gönder (Sistemi yormamak için)
            if slouching_detected != is_currently_slouching:
                is_currently_slouching = slouching_detected
                
                # NestJS'deki 'postur_durumu' dinleyicisine veriyi fırlat
                sio.emit('postur_durumu', {
                    'kambur_mu': is_currently_slouching,
                    'mesafe': float(distance)
                })
                
                status = "⚠️ KAMBUR" if is_currently_slouching else "✅ DUZGUN"
                print(f"Durum Değişti: {status} | Mesafe: {distance:.3f}")

        # Test için görüntüyü göster (İstemezsen kapatabilirsin)
        # cv2.imshow('Zenith AI - Posture Analysis', image)
        
        if cv2.waitKey(5) & 0xFF == 27: # ESC ile çıkış
            break

finally:
    cap.release()
    cv2.destroyAllWindows()
    sio.disconnect()