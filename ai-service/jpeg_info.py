"""JPEG verisini cozmeden boyut okuyan saf yardimci."""

# SOF isaretleri (0xC4=DHT, 0xC8=JPG, 0xCC=DAC kare boyutu tasimaz).
_SOF_MARKERS = frozenset(range(0xC0, 0xD0)) - {0xC4, 0xC8, 0xCC}
_STANDALONE_MARKERS = frozenset({0x01, 0xD8, *range(0xD0, 0xD8)})


def jpeg_size(data):
    """JPEG basliginden (genislik, yukseklik) dondurur; okunamazsa None."""
    if len(data) < 4 or data[0] != 0xFF or data[1] != 0xD8:
        return None

    position = 2
    length = len(data)

    while position + 4 <= length:
        if data[position] != 0xFF:
            return None

        marker = data[position + 1]
        if marker == 0xFF:  # dolgu baytlari
            position += 1
            continue
        if marker in _STANDALONE_MARKERS:
            position += 2
            continue

        if marker in _SOF_MARKERS:
            if position + 9 > length:
                return None
            height = (data[position + 5] << 8) | data[position + 6]
            width = (data[position + 7] << 8) | data[position + 8]
            return width, height

        segment_length = (data[position + 2] << 8) | data[position + 3]
        position += 2 + segment_length

    return None
