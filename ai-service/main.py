import argparse
import importlib
import logging
import signal
import sys
from threading import Event

from connection_manager import ConnectionManager
from logging_setup import setup_logging

log = logging.getLogger("zenith.main")

# Servis adi -> (modul, sinif). Modüller yalnizca ilgili servis calisirken
# yuklenir; boylece ornegin LED servisi OpenCV/MediaPipe'i import etmez.
SERVICES = {
    "camera": ("posture_analyzer", "PostureAnalyzer"),
    "sensor": ("sensor_manager", "SensorManager"),
    "led": ("led_controller", "LEDController"),
    "nfc": ("nfc_manager", "NFCManager"),
}


def build_service(service_name):
    try:
        module_name, class_name = SERVICES[service_name]
    except KeyError:
        raise ValueError(f"Desteklenmeyen servis: {service_name}") from None

    module = importlib.import_module(module_name)
    return getattr(module, class_name)()


def main():
    parser = argparse.ArgumentParser(description="Zenith AI ve donanim servisi")
    parser.add_argument(
        "--service",
        type=str,
        required=True,
        choices=sorted(SERVICES),
        help="Baslatilacak mikroservis",
    )
    args = parser.parse_args()
    name = args.service.upper()

    setup_logging()
    log.info("ZENITH %s SERVISI BASLATILIYOR", name)

    stop_event = Event()
    conn = ConnectionManager()
    service = None
    exit_code = 0

    def _request_shutdown(signum, _frame):
        log.info("Kapatilma sinyali alindi: %s", signal.Signals(signum).name)
        stop_event.set()

    signal.signal(signal.SIGINT, _request_shutdown)
    signal.signal(signal.SIGTERM, _request_shutdown)

    try:
        # Isleyiciler (conn.on) servis olusturulurken kaydedilir; baglantidan
        # once hazir olmalari backend'in ilk olaylarini kacirmamalarini saglar.
        service = build_service(args.service)
        conn.connect(wait_for_backend=True, service=args.service)
        service.start()

        log.info("%s servisi aktif.", name)
        while not stop_event.wait(1):
            pass
    except Exception:
        log.critical("%s servisi baslatilamadi veya coktu", name, exc_info=True)
        exit_code = 1
    finally:
        log.info("%s servisi guvenli sekilde kapatiliyor...", name)
        if service is not None:
            try:
                service.stop()
            except Exception:
                log.exception("Durdurulurken hata olustu")
        conn.disconnect()
        log.info("Cikis yapildi.")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
