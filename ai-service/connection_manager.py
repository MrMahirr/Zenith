import socketio
import time
from config import BACKEND_URL

class ConnectionManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConnectionManager, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.sio = socketio.Client(logger=False, engineio_logger=False)
        self.is_connected = False
        
        @self.sio.event
        def connect():
            print("[Bağlantı] Backend sunucusuna başarıyla bağlanıldı!")
            self.is_connected = True

        @self.sio.event
        def disconnect():
            print("[Bağlantı] Backend bağlantısı koptu! Yeniden bağlanılmaya çalışılıyor...")
            self.is_connected = False

    def connect(self):
        if not self.is_connected:
            try:
                self.sio.connect(BACKEND_URL)
            except Exception as e:
                print(f"[Hata] Backend'e bağlanılamadı: {e}")
                
    def emit(self, event, data=None):
        if self.is_connected:
            try:
                self.sio.emit(event, data)
            except Exception as e:
                print(f"[Hata] Veri gönderilemedi: {e}")

    def on(self, event, handler):
        self.sio.on(event, handler)

    def disconnect(self):
        if self.is_connected:
            self.sio.disconnect()
