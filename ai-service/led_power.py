"""LED seridin guc butcesi (saf mantik).

WS2812B her renk kanali tam parlaklikta ~20 mA ceker (LED basina ~60 mA beyaz).
Seridi Pi'nin 5V hattindan besleyen kurulumlarda yuksek parlaklik, gerilimi
dusurur ve Pi'yi kisar. Burada istenen parlaklik, belirlenen akim butcesini
asmayacak sekilde sinirlanir.
"""

CHANNEL_MA_AT_FULL = 20.0
IDLE_MA_PER_LED = 1.0


def estimate_current_ma(rgb, brightness, led_count):
    """Tum seridin yaklasik akim cekisi (mA)."""
    channels = sum(rgb) / 255.0
    active_per_led = channels * CHANNEL_MA_AT_FULL * (brightness / 255.0)
    return led_count * (active_per_led + IDLE_MA_PER_LED)


def limit_brightness(rgb, brightness, led_count, budget_ma):
    """Butceyi asmayan en yuksek parlakligi dondurur (`budget_ma <= 0` sinir yok)."""
    if budget_ma <= 0:
        return brightness

    available = budget_ma - led_count * IDLE_MA_PER_LED
    full_scale = led_count * (sum(rgb) / 255.0) * CHANNEL_MA_AT_FULL
    if full_scale <= 0:
        return brightness  # sondur: cekilen akim zaten bosta degeri
    if available <= 0:
        return 0

    return max(0, min(brightness, int(255 * available / full_scale)))
