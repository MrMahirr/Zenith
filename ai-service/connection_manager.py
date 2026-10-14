import logging
import time
import urllib.request

import socketio

from config import (
    BACKEND_HEALTH_URL,
    BACKEND_RETRY_INTERVAL,
    BACKEND_URL,
    BACKEND_WAIT_TIMEOUT,
)

log = logging.getLogger("zenith.connection")


class ConnectionManager:
    """Backend ile Socket.io baglantisini yoneten, surec basina tek ornekli sinif."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            instance = super().__new__(cls)
            instance._initialize()
            cls._instance = instance
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
        self._shutting_down = False
        self._waiting_for_backend_logged = False
        self._connect_error_logged = False
        self._connect_callbacks = []
        self._service_name = None

        @self.sio.event
        def connect():
            self.is_connected = True
            self._waiting_for_backend_logged = False
            self._connect_error_logged = False
            log.info("Backend sunucusuna baglanildi.")
            self._run_connect_callbacks()

        @self.sio.event
        def disconnect():
            if self.is_connected and not self._shutting_down:
                log.warning("Backend baglantisi koptu. Yeniden baglaniliyor...")
            self.is_connected = False

        @self.sio.event
        def connect_error(data):
            if not self._connect_error_logged:
                log.warning("Socket baglantisi kurulamadi: %s", data)
                self._connect_error_logged = True

    def _run_connect_callbacks(self):
        for callback in list(self._connect_callbacks):
            try:
                callback()
            except Exception:
                log.exception("Baglanti callback'i hata verdi")

    @staticmethod
    def _is_backend_ready():
        request = urllib.request.Request(
            BACKEND_HEALTH_URL, headers={"User-Agent": "ZenithAI/1.0"}
        )
        try:
            with urllib.request.urlopen(request, timeout=3) as response:
                return 200 <= response.status < 300
        except Exception:
            return False

    def wait_for_backend(self, timeout=BACKEND_WAIT_TIMEOUT):
        """Backend saglik adresi cevap verene kadar bekler. timeout<=0 sonsuz bekler."""
        deadline = time.monotonic() + timeout if timeout and timeout > 0 else None

        while not self._is_backend_ready():
            if deadline is not None and time.monotonic() >= deadline:
                raise TimeoutError("Backend belirtilen sure icinde hazir olmadi.")

            if not self._waiting_for_backend_logged:
                log.info("Backend aktif degil. %s bekleniyor...", BACKEND_HEALTH_URL)
                self._waiting_for_backend_logged = True

            time.sleep(BACKEND_RETRY_INTERVAL)

    def connect(self, wait_for_backend=False, timeout=BACKEND_WAIT_TIMEOUT, service=None):
        """Backend'e baglanir.

        wait_for_backend=True ise sunucu hazir olana kadar bekler. Baglanti
        kurulamazsa yeniden baglanma arka planda devam eder. `service`, el
        sikismada backend'e bildirilir (saglik ucunda "bagli servis" olarak gorunur).
        """
        if self.is_connected or self.sio.connected:
            return True

        self._shutting_down = False
        if service:
            self._service_name = service

        if wait_for_backend:
            try:
                self.wait_for_backend(timeout=timeout)
            except TimeoutError as exc:
                log.warning("Backend bekleme suresi doldu: %s", exc)

        try:
            auth = {"service": self._service_name} if self._service_name else None
            self.sio.connect(BACKEND_URL, auth=auth, wait_timeout=5)
            return True
        except Exception as exc:
            if not self._connect_error_logged:
                log.warning(
                    "Backend'e su an ulasilamiyor (%s). Baglanti arka planda saglanacak.",
                    exc,
                )
                self._connect_error_logged = True
            return False

    def on(self, event, handler):
        """Backend'den gelen bir olay icin isleyici kaydeder."""
        self.sio.on(event, handler)

    def on_connect(self, callback):
        """Her (yeniden) baglantida cagrilacak parametresiz bir fonksiyon kaydeder."""
        self._connect_callbacks.append(callback)

    def emit(self, event, data=None):
        """Olay gonderir. Baglanti yoksa veri atilir ve False doner."""
        if not self.is_connected:
            return False

        try:
            self.sio.emit(event, data)
            return True
        except Exception as exc:
            log.error("Veri gonderilemedi (%s): %s", event, exc)
            return False

    def disconnect(self):
        if self.is_connected or self.sio.connected:
            self._shutting_down = True
            self.sio.disconnect()
