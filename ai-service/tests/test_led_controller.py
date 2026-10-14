import sys
import time
import unittest
from unittest import mock

# socketio yalnizca ConnectionManager icin gerekli; testler agsiz calissin.
with mock.patch.dict(sys.modules, {"socketio": mock.MagicMock()}):
    import led_controller

from led_color import BLACK


class LEDControllerTests(unittest.TestCase):
    def setUp(self):
        # Gercek serit surulmesin: kutuphane yokmus gibi davran.
        patcher = mock.patch.object(led_controller, "LIBRARY_AVAILABLE", False)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.led = led_controller.LEDController()
        self.led.conn = mock.MagicMock()
        self.addCleanup(self.led.stop)

    def test_command_sets_color_and_brightness(self):
        self.led._handle_command({"color": "#EF4444", "brightness": 200, "duration": 0})

        self.assertEqual(self.led._color, (239, 68, 68))
        self.assertEqual(self.led._brightness, 200)
        self.assertEqual(self.led._expires_at, 0.0)

    def test_invalid_commands_are_ignored(self):
        self.led._handle_command({"color": "#10B981"})
        before = (self.led._color, self.led._brightness)

        for payload in (None, "x", 42, {"color": "kirmizi"}, {}):
            with self.subTest(payload=payload):
                self.led._handle_command(payload)
                self.assertEqual((self.led._color, self.led._brightness), before)

    def test_timed_command_turns_off_when_expired(self):
        self.led.start()
        self.led._handle_command({"color": "#10B981", "duration": 50})
        self.assertNotEqual(self.led._color, BLACK)

        deadline = time.monotonic() + 2.0
        while time.monotonic() < deadline and self.led._color != BLACK:
            time.sleep(0.02)

        self.assertEqual(self.led._color, BLACK)

    def test_brightness_only_sync_keeps_color_in_auto_mode(self):
        self.led._handle_command({"color": "#3B82F6", "duration": 0})
        self.led._handle_state_sync(
            {"mode": "auto", "isOn": False, "color": "#000000", "brightness": 40}
        )

        self.assertEqual(self.led._color, (59, 130, 246))
        self.assertEqual(self.led._brightness, 40)

    def test_manual_sync_restores_color_and_off_state(self):
        self.led._handle_state_sync(
            {"mode": "manual", "isOn": True, "color": "#F59E0B", "brightness": 90}
        )
        self.assertEqual(self.led._color, (245, 158, 11))

        self.led._handle_state_sync({"mode": "manual", "isOn": False})
        self.assertEqual(self.led._color, BLACK)

    def test_manual_command_becomes_base_color(self):
        self.led.start()
        self.led._handle_command({"type": "MANUAL", "color": "#00FF00", "duration": 5000})

        # Manuel renk kalicidir: sure siniri uygulanmaz ve taban olur.
        self.assertEqual(self.led._base_color, (0, 255, 0))
        self.assertEqual(self.led._expires_at, 0.0)

    def test_timed_overlay_returns_to_ambient_color(self):
        self.led.start()
        self.led._handle_state_sync(
            {"mode": "auto", "isOn": False, "color": "#000000", "brightness": 128,
             "ambientColor": "#10B981"}
        )
        self.assertEqual(self.led._color, (16, 185, 129))

        self.led._handle_command({"type": "POSTURE", "color": "#FF0000", "duration": 60})
        self.assertEqual(self.led._color, (255, 0, 0))

        deadline = time.monotonic() + 2.0
        while time.monotonic() < deadline and self.led._color != (16, 185, 129):
            time.sleep(0.02)

        self.assertEqual(self.led._color, (16, 185, 129))

    def test_disabling_ambient_returns_base_to_black(self):
        self.led._handle_state_sync(
            {"mode": "auto", "isOn": False, "brightness": 128, "ambientColor": "#3B82F6"}
        )
        self.assertEqual(self.led._color, (59, 130, 246))

        self.led._handle_state_sync(
            {"mode": "auto", "isOn": False, "brightness": 128, "ambientColor": None}
        )
        self.assertEqual(self.led._color, BLACK)

    def test_sync_does_not_clear_active_posture_alert(self):
        self.led._handle_state_sync(
            {"mode": "auto", "isOn": False, "brightness": 128, "ambientColor": "#10B981"}
        )
        self.led._handle_command({"type": "POSTURE", "color": "#EF4444", "duration": 0})

        # Parlaklik degisimi gibi bir sync gelse de uyari rengi kalir.
        self.led._handle_state_sync(
            {"mode": "auto", "isOn": False, "brightness": 90, "ambientColor": "#10B981"}
        )

        self.assertEqual(self.led._color, (239, 68, 68))
        self.assertEqual(self.led._brightness, 90)

    def test_requests_state_on_connect(self):
        self.led._request_state()
        self.led.conn.emit.assert_called_once_with("led_get_state")


if __name__ == "__main__":
    unittest.main()
