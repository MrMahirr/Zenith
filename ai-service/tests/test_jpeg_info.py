import unittest

from jpeg_info import jpeg_size


def _segment(marker, payload):
    length = len(payload) + 2
    return bytes([0xFF, marker, length >> 8, length & 0xFF]) + payload


def _jpeg(width, height, sof_marker=0xC0, with_exif=False):
    data = b"\xff\xd8"
    data += _segment(0xE0, b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00")
    if with_exif:
        data += _segment(0xE1, b"Exif\x00\x00" + b"\x00" * 40)
    data += _segment(0xDB, b"\x00" + b"\x10" * 64)
    sof = bytes([8, height >> 8, height & 0xFF, width >> 8, width & 0xFF, 3])
    data += _segment(sof_marker, sof + b"\x01\x22\x00\x02\x11\x01\x03\x11\x01")
    return data + b"\xff\xd9"


class JpegSizeTests(unittest.TestCase):
    def test_baseline_jpeg(self):
        self.assertEqual(jpeg_size(_jpeg(640, 480)), (640, 480))

    def test_progressive_jpeg(self):
        self.assertEqual(jpeg_size(_jpeg(1920, 1080, sof_marker=0xC2)), (1920, 1080))

    def test_skips_exif_and_other_segments(self):
        self.assertEqual(jpeg_size(_jpeg(1280, 720, with_exif=True)), (1280, 720))

    def test_invalid_data_returns_none(self):
        for data in (b"", b"\x00\x01\x02\x03", b"\xff\xd8", b"\xff\xd8\xff\xe0\x00"):
            with self.subTest(data=data):
                self.assertIsNone(jpeg_size(data))

    def test_truncated_before_frame_header_returns_none(self):
        self.assertIsNone(jpeg_size(_jpeg(640, 480)[:20]))


if __name__ == "__main__":
    unittest.main()
