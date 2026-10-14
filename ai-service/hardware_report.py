"""Donanim durumu raporlari: servislerin backend'e bildirdigi cihaz saglik bilgisi.

Her cihaz `{"id", "name", "state", "detail"}` seklindedir. `state` degerleri:
`ok` (calisiyor), `warn` (calisiyor ama dikkat), `error` (calismiyor / sorunlu),
`unknown` (henuz olculemedi).
"""

OK = "ok"
WARN = "warn"
ERROR = "error"
UNKNOWN = "unknown"

_STATES = {OK, WARN, ERROR, UNKNOWN}
_MAX_DETAIL_LENGTH = 200


def device(device_id, name, state, detail=""):
    """Rapor satiri uretir; gecersiz durum `unknown`, uzun ayrinti kirpilir."""
    return {
        "id": device_id,
        "name": name,
        "state": state if state in _STATES else UNKNOWN,
        "detail": str(detail)[:_MAX_DETAIL_LENGTH],
    }


def worst_state(devices):
    """Cihaz listesindeki en agir durum (error > warn > unknown > ok)."""
    order = {ERROR: 3, WARN: 2, UNKNOWN: 1, OK: 0}
    return max((order[d["state"]] for d in devices), default=0)
