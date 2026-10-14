"""Raspberry Pi guc/sicaklik sagligi (`vcgencmd get_throttled`).

Dusuk gerilim, bu projede gercekten yasanan bir sorundur: LED serit, dokunmatik
ekran ve Pi ayni besleme uzerinden calisinca Pi CPU'sunu kisar ve olcumleri
bozabilir. Bu modul durumu okur ve yorumlar; bildirim backend/arayuz tarafindadir.
"""

import re
import shutil
import subprocess

from hardware_report import ERROR, OK, UNKNOWN, WARN, device

# `vcgencmd get_throttled` bit konumlari (resmi dokumantasyon).
_FLAGS = {
    0: "under_voltage",
    1: "freq_capped",
    2: "throttled",
    3: "soft_temp_limit",
    16: "under_voltage_occurred",
    17: "freq_capped_occurred",
    18: "throttled_occurred",
    19: "soft_temp_limit_occurred",
}

HIGH_TEMPERATURE_C = 80.0
_THROTTLED_PATTERN = re.compile(r"throttled=(0x[0-9a-fA-F]+)")
_TEMP_PATTERN = re.compile(r"temp=([0-9.]+)")


def parse_throttled(output):
    """`throttled=0x50005` ciktisindan bayrak sozlugu uretir; okunamazsa None."""
    match = _THROTTLED_PATTERN.search(output or "")
    if not match:
        return None

    value = int(match.group(1), 16)
    return {name: bool(value & (1 << bit)) for bit, name in _FLAGS.items()}


def parse_temperature(output):
    match = _TEMP_PATTERN.search(output or "")
    return float(match.group(1)) if match else None


def describe_power(flags):
    """Guc bayraklarini kullaniciya donuk bir cihaz satirina cevirir."""
    if flags is None:
        return device("power", "Guc kaynagi", UNKNOWN, "vcgencmd okunamadi")

    if flags["under_voltage"]:
        return device(
            "power", "Guc kaynagi", ERROR,
            "Su an dusuk gerilim algilaniyor; Pi kisiliyor. En az 5V/3A bir "
            "adaptor kullanin; LED serit ve ekran icin ayri besleme dusunun.",
        )
    if flags["throttled"] or flags["freq_capped"]:
        return device("power", "Guc kaynagi", WARN, "Islemci hizi su an sinirlaniyor (gerilim/sicaklik).")
    if flags["under_voltage_occurred"]:
        return device(
            "power", "Guc kaynagi", WARN,
            "Acilistan beri en az bir kez dusuk gerilim yasandi; besleme sinirda.",
        )
    return device("power", "Guc kaynagi", OK, "Dusuk gerilim yok")


def describe_temperature(celsius, flags):
    if celsius is None:
        return device("cpu_temp", "Islemci sicakligi", UNKNOWN, "Okunamadi")

    soft_limit = bool(flags and flags["soft_temp_limit"])
    if celsius >= HIGH_TEMPERATURE_C or soft_limit:
        return device("cpu_temp", "Islemci sicakligi", WARN, f"{celsius:.0f} C - soguma onerilir")
    return device("cpu_temp", "Islemci sicakligi", OK, f"{celsius:.0f} C")


def read_system_devices(runner=None):
    """Guc ve sicaklik cihaz satirlarini dondurur. `runner(args) -> str` test icin verilir."""
    run = runner or _run_vcgencmd
    flags = parse_throttled(run(["get_throttled"]))
    celsius = parse_temperature(run(["measure_temp"]))
    return [describe_power(flags), describe_temperature(celsius, flags)]


def _run_vcgencmd(args):
    executable = shutil.which("vcgencmd")
    if executable is None:
        return ""

    try:
        result = subprocess.run(
            [executable, *args], capture_output=True, text=True, timeout=3, check=False
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return result.stdout
