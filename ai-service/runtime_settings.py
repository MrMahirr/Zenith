"""Backend'den canli gelen kullanici tercihlerinin dogrulanmasi (saf mantik)."""

# Backend (`preferences.service.ts`) ile ayni sinirlar.
POSTURE_THRESHOLD_RANGE = (0.05, 0.5)
SENSOR_INTERVAL_RANGE = (5.0, 300.0)
MQ135_CLEAN_VOLTAGE_RANGE = (0.05, 4.0)


def coerce_number(value, default, bounds):
    """`value` sinirlar icinde bir sayiysa onu, aksi halde `default`'u dondurur.

    `None` (tercih yok) ve bozuk/aralik disi degerler varsayilana doner; boylece
    hatali bir mesaj servisi kotu bir degere itemez.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return default

    minimum, maximum = bounds
    return float(value) if minimum <= value <= maximum else default
