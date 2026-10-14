"""MQ135 gaz sensoru: sinyal sagligi ve goreli hava kalitesi indeksi (saf mantik).

MQ135 bir direnc sensorudur: kirli havada direnci (Rs) duser. Modulun cikis
gerilimi (Vout) ile Rs, yuk direnci RL uzerinden iliskilidir:

    Rs = RL * (Vcc - Vout) / Vout

Temiz havadaki gerilimi (Vclean) olcersek `Rs/R0` orani RL'den bagimsizdir:

    Rs/R0 = [(Vcc - Vout) / Vout] / [(Vcc - Vclean) / Vclean]

Bu oran 1.0'a yakinsa hava kalibrasyon aniyla ayni, kuculdukce kirlidir. Indeks
mutlak bir ppm DEGILDIR; kalibrasyon anina gore goreli bir olcektir (0 = temiz).
"""

from hardware_report import ERROR, OK, WARN, device

# Bu orandan (Rs/R0) daha dusuk degerler indeksi 100'e dayar (agir kirlilik).
RATIO_AT_FULL_SCALE = 0.3

VCC_VOLTS = 5.0
DEAD_SIGNAL_VOLTS = 0.01

# ADS1115 giris gerilimi VDD + 0.3 V'u gecmemeli (yonetim siniri).
ADS_INPUT_MARGIN_VOLTS = 0.3
# ADS1115 +-4.096 V tam olcekte doyar.
ADS_FULL_SCALE_VOLTS = 4.096


def legacy_index(voltage, vcc=VCC_VOLTS):
    """Kalibrasyon yokken kullanilan eski dogrusal olcek (0-100)."""
    return round(max(0.0, min(100.0, (voltage / vcc) * 100)), 1)


def resistance_ratio(voltage, clean_voltage, vcc=VCC_VOLTS):
    """Rs/R0; olculemezse None (gerilim sifira ya da besleme gerilimine esitse)."""
    if not (0 < voltage < vcc) or not (0 < clean_voltage < vcc):
        return None

    rs = (vcc - voltage) / voltage
    r0 = (vcc - clean_voltage) / clean_voltage
    return rs / r0


def calibrated_index(voltage, clean_voltage, vcc=VCC_VOLTS):
    """Temiz havaya gore goreli kirlilik indeksi (0 = temiz, 100 = agir kirli)."""
    ratio = resistance_ratio(voltage, clean_voltage, vcc)
    if ratio is None:
        return None

    scaled = (1.0 - ratio) / (1.0 - RATIO_AT_FULL_SCALE)
    return round(max(0.0, min(100.0, scaled * 100)), 1)


def air_quality(voltage, clean_voltage=None, vcc=VCC_VOLTS):
    """Kalibrasyon varsa goreli indeksi, yoksa eski olcegi dondurur."""
    if clean_voltage is not None:
        index = calibrated_index(voltage, clean_voltage, vcc)
        if index is not None:
            return index
    return legacy_index(voltage, vcc)


def describe_signal(voltage, supply_volts=3.3, calibrated=False):
    """MQ135 sinyalinin sagligini cihaz satirina cevirir."""
    if voltage <= DEAD_SIGNAL_VOLTS:
        return device(
            "mq135", "MQ135 gaz sensoru", ERROR,
            "Sinyal yok (~0 V). VCC (5V), GND ve AO kablolarini kontrol edin.",
        )
    if voltage >= ADS_FULL_SCALE_VOLTS - 0.05:
        return device(
            "mq135", "MQ135 gaz sensoru", ERROR,
            "ADS1115 tam olcekte doydu; AO girisine gerilim bolucu gerekebilir.",
        )
    if voltage > supply_volts + ADS_INPUT_MARGIN_VOLTS:
        return device(
            "mq135", "MQ135 gaz sensoru", ERROR,
            f"{voltage:.2f} V, ADS1115 beslemesinin ({supply_volts:.1f} V) uzerinde: "
            "cip zarar gorebilir. AO'ya 10k/20k gerilim bolucu ekleyin ya da ADS1115'i 5V'tan besleyin.",
        )

    note = "Kalibre" if calibrated else "Kalibre degil (goreli indeks icin temiz havada kalibre edin)"
    state = OK if calibrated else WARN
    return device("mq135", "MQ135 gaz sensoru", state, f"{voltage:.2f} V - {note}")
