"""Kamera adreslerinin dogrulanmasi ve secimi (OpenCV gerektirmeyen saf mantik)."""

from urllib.parse import urlsplit

_ALLOWED_SCHEMES = {"http", "https"}


def sanitize_camera_url(value):
    """Gecerli bir http(s) adresini dondurur; aksi halde None.

    Backend de dogrular, ancak AI servisi disaridan gelen veriye guvenmez.
    """
    if not isinstance(value, str):
        return None

    candidate = value.strip()
    try:
        parts = urlsplit(candidate)
        hostname = parts.hostname
    except ValueError:
        return None

    if parts.scheme.lower() not in _ALLOWED_SCHEMES or not hostname:
        return None

    return candidate


def resolve_camera_urls(runtime_url, default_urls):
    """Calisma zamaninda ayarlanmis adres varsa yalnizca onu, yoksa varsayilanlari dondurur.

    Ayarli adres varken varsayilanlara dusulmez: aksi halde yanlis girilen bir
    adres sessizce eski kameraya baglanmis gibi gorunurdu.
    """
    url = sanitize_camera_url(runtime_url)
    return (url,) if url else tuple(default_urls)
