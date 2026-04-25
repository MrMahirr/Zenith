import argparse
import sys
import time

from connection_manager import ConnectionManager


def _build_service(service_name):
    if service_name == "camera":
        from posture_analyzer import PostureAnalyzer

        return PostureAnalyzer()
    if service_name == "sensor":
        from sensor_manager import SensorManager

        return SensorManager()
    if service_name == "led":
        from led_controller import LEDController

        return LEDController()
    if service_name == "nfc":
        from nfc_manager import NFCManager

        return NFCManager()

    raise ValueError(f"Desteklenmeyen servis: {service_name}")


def main():
    parser = argparse.ArgumentParser(description="Zenith AI ve donanim servisi")
    parser.add_argument(
        "--service",
        type=str,
        required=True,
        choices=["camera", "sensor", "led", "nfc"],
        help="Baslatilacak mikroservis",
    )
    args = parser.parse_args()

    print("==============================================")
    print(f"   ZENITH {args.service.upper()} SERVISI BASLATILIYOR")
    print("==============================================\n")

    conn = ConnectionManager()
    service = None

    try:
        conn.connect(wait_for_backend=True)
        service = _build_service(args.service)
        service.start()

        print(f"\n[{args.service.upper()}] Servis aktif. Cikmak icin Ctrl+C.\n")

        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Sistem] Kapatilma istegi alindi...")
    finally:
        print(f"[Sistem] {args.service.upper()} servisi guvenli sekilde kapatiliyor...")
        if service:
            try:
                service.stop()
            except Exception as exc:
                print(f"[Hata] Durdurulurken hata olustu: {exc}")
        conn.disconnect()
        print("[Sistem] Cikis yapildi.")
        sys.exit(0)


if __name__ == "__main__":
    main()
