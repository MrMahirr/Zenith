"""LED komutlarindaki renk ve parlaklik degerlerini dogrulayan saf yardimcilar."""

import re

_HEX_COLOR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

BLACK = (0, 0, 0)


def parse_hex_color(value):
    """'#RRGGBB' veya '#RGB' bicimindeki rengi (r, g, b) olarak dondurur.

    Gecersiz girdide None doner; cagiran taraf ne yapacagina karar verir.
    """
    if not isinstance(value, str) or not _HEX_COLOR.match(value.strip()):
        return None

    digits = value.strip()[1:]
    if len(digits) == 3:
        digits = "".join(ch * 2 for ch in digits)

    return tuple(int(digits[i : i + 2], 16) for i in (0, 2, 4))


def clamp_brightness(value):
    """Parlakligi 0-255 araligina sikistirir. Sayiya cevrilemezse None doner."""
    if isinstance(value, bool):
        return None

    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return None

    return max(0, min(255, number))


def parse_duration_seconds(value):
    """Milisaniye cinsinden sureyi saniyeye cevirir. Gecersiz/negatif ise 0.0 doner."""
    if isinstance(value, bool):
        return 0.0

    try:
        milliseconds = float(value)
    except (TypeError, ValueError):
        return 0.0

    return milliseconds / 1000.0 if milliseconds > 0 else 0.0
