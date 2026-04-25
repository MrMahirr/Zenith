import time
import urllib.request

import socketio

from config import (
    BACKEND_HEALTH_URL,
    BACKEND_RETRY_INTERVAL,
    BACKEND_URL,
    BACKEND_WAIT_TIMEOUT,
)


class ConnectionManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConnectionManager, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.sio = socketio.Client(
            logger=False,
            engineio_logger=False,
            reconnection=True,
            reconnection_attempts=0,
            reconnection_delay=1,
            reconnection_delay_max=5,
            request_timeout=5,
        )
        self.is_connected = False
        self._waiting_for_backend_logged = False
        self._connect_error_logged = False

        @self.sio.event
        def connect():
            self.is_connected = True
            self._waiting_for_backend_logged = False
            self._connect_error_logged = False
            print("[Baglanti] Backend sunucusuna basariyla baglanildi!")

        @self.sio.event
        def disconnect():
            if self.is_connected:
                print("[Baglanti] Backend baglantisi koptu. Yeniden baglaniliyor...")
            self.is_connected = False

        @self.sio.event
        def connect_error(data):
            if not self._connect_error_logged:
                print(f"[Baglanti] Socket baglantisi kurulamadi: {data}")
                self._connect_error_logged = True

    def _is_backend_ready(self):
        request = urllib.request.Request(
            BACKEND_HEALTH_URL,
            headers={"User-Agent": "ZenithAI/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=3) as response:
                return 200 <= response.status < 300
        except Exception:
            return False

    @staticmethod
    def _get_deadline(timeout):
        if timeout is None or timeout <= 0:
            return None
        return time.time() + timeout

    @staticmethod
    def _ensure_not_timed_out(deadline):
        if deadline is not None and time.time() >= deadline:
            raise TimeoutError("Backend belirtilen sure icinde hazir olmadi.")

    def wait_for_backend(self, timeout=BACKEND_WAIT_TIMEOUT):
        deadline = self._get_deadline(timeout)

        while not self._is_backend_ready():
            self._ensure_not_timed_out(deadline)

            if not self._waiting_for_backend_logged:
                print(
                    f"[Baglanti] Backend aktif degil. {BACKEND_HEALTH_URL} bekleniyor..."
                )
                self._waiting_for_backend_logged = True

            time.sleep(BACKEND_RETRY_INTERVAL)

    def connect(self, wait_for_backend=True, timeout=BACKEND_WAIT_TIMEOUT):
        if self.is_connected or self.sio.connected:
            return True

        deadline = self._get_deadline(timeout)

        if wait_for_backend:
            self.wait_for_backend(timeout=timeout)

        while not self.is_connected and not self.sio.connected:
            self._ensure_not_timed_out(deadline)

            try:
                self.sio.connect(BACKEND_URL, wait_timeout=5)
            except Exception as exc:
                if not self._connect_error_logged:
                    print(
                        "[Baglanti] Backend socket hazir degil, tekrar denenecek: "
                        f"{exc}"
                    )
                    self._connect_error_logged = True
                time.sleep(BACKEND_RETRY_INTERVAL)
            else:
                return True

        return True

    def emit(self, event, data=None):
        if not self.is_connected:
            return

        try:
            self.sio.emit(event, data)
        except Exception as exc:
            print(f"[Hata] Veri gonderilemedi: {exc}")

    def on(self, event, handler):
        self.sio.on(event, handler)

    def disconnect(self):
        if self.is_connected or self.sio.connected:
            self.sio.disconnect()
