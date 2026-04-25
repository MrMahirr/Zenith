import time
import threading
from config import LED_COUNT, LED_PIN, LED_FREQ_HZ, LED_DMA, LED_BRIGHTNESS, LED_INVERT, LED_CHANNEL
from connection_manager import ConnectionManager

try:
    from rpi_ws281x import PixelStrip, Color
    HAS_HARDWARE = True
except ImportError:
    HAS_HARDWARE = False
    print("UYARI: rpi_ws281x kütüphanesi bulunamadı. LED'ler mock modunda çalışacak.")

# Hex string'i Color objesine çevir (#EF4444 -> Color(239, 68, 68))
def hex_to_color(hex_str):
    if not hex_str or not hex_str.startswith('#'):
        return Color(0, 0, 0)
    hex_str = hex_str.lstrip('#')
    r, g, b = tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
    return Color(r, g, b)

class LEDController:
    def __init__(self):
        self.conn = ConnectionManager()
        self.running = False
        self.current_color = Color(0, 0, 0)
        self.target_color = Color(0, 0, 0)
        self.animation_end_time = 0
        
        if HAS_HARDWARE:
            self.strip = PixelStrip(LED_COUNT, LED_PIN, LED_FREQ_HZ, LED_DMA, LED_INVERT, LED_BRIGHTNESS, LED_CHANNEL)
            self.strip.begin()
            
        # Backend'den gelen LED komutlarını dinle
        self.conn.on('led_command', self._handle_command)

    def _handle_command(self, data):
        """Backend'den gelen komut: { type: 'POSTURE'|'MODE_CHANGE', color: '#10B981', duration: 5000 }"""
        print(f"[LED] Komut alındı: {data}")
        color = hex_to_color(data.get('color', '#000000'))
        duration = data.get('duration', 0)
        
        self.target_color = color
        
        if duration > 0:
            self.animation_end_time = time.time() + (duration / 1000.0)
        else:
            self.animation_end_time = 0 # Süresiz (kambur durumu gibi)
            
        self._set_color(self.target_color)

    def _set_color(self, color):
        self.current_color = color
        if HAS_HARDWARE:
            for i in range(self.strip.numPixels()):
                self.strip.setPixelColor(i, color)
            self.strip.show()

    def start(self):
        self.running = True
        print("[LED] Kontrol servisi başlatıldı...")
        self._set_color(Color(0, 0, 0)) # Başlangıçta kapat
        
        self.thread = threading.Thread(target=self._anim_loop)
        self.thread.daemon = True
        self.thread.start()

    def _anim_loop(self):
        while self.running:
            # Süreli bir animasyon bittiyse (örn: 5sn'lik mod değişimi) LED'i kapat
            if self.animation_end_time > 0 and time.time() > self.animation_end_time:
                self._set_color(Color(0, 0, 0))
                self.animation_end_time = 0
                
            time.sleep(0.5)

    def stop(self):
        self.running = False
        self._set_color(Color(0, 0, 0))
        print("[LED] Servis durduruldu.")
