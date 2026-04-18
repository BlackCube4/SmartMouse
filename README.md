# KeyMouse
An ESP32-S3 based virtual HID (Keyboard/Mouse/Touchpad) that allows remote control via Home Assistant using high-speed WebSockets.

## Features
- **Air Mouse:** Use your smartphone's gyroscope to control the PC cursor.
- **Precision Touchpad:** Supports Windows multi-finger gestures and high-resolution scrolling.
- **Media & Keyboard Control:** Dedicated services for media keys, HID keycodes, and raw text injection.
- **Low Latency:** Optimized for sub-ms response times via `WiFi.setSleep(false)` and 240MHz CPU scaling.
- **Secure:** Simple shared-secret handshake authentication.
- **Telemetry:** Real-time monitoring of ESP32 internal temperature and WiFi signal strength.

## Home Assistant Configuration

### Installation
1. Copy the `Home Assistant Custom Component` folder to your `custom_components` directory and rename it to `esp_mouse`.
2. Restart Home Assistant.
3. Add the integration via the UI (**Settings > Devices & Services**).

### Gyro / UI Configuration
When using the custom card, you can tune the following parameters in the card's YAML:

```yaml
type: custom:keymouse-card
device_id: <your_device_id>     # The ID of your device
padSensitivity: 4               # Multiplier for touchpad cursor speed
scrollSensitivity: 3            # Multiplier for touchpad scroll speed
gyroSensitivity: 8              # Multiplier for Air Mouse movement
smoothing: 0.15                 # Low-pass filter (0.0-1.0). Higher = smoother, more lag
suppression_offset: 30          # Ms to ignore gyro after a click (prevents jitter)
click_time: 200                 # Max ms for a tap to count as a click
double_click_time: 300          # Max ms between taps for double-click
hold_time: 500                  # Ms to hold for Right-Click/Drag-Lock
debug: true                     # Shows real-time sensor data and frequency
```

## Protocol Opcodes (Binary WebSocket)
| Opcode | Function | Payload |
| :--- | :--- | :--- |
| `0x01` | Relative Mouse | `int16 dx, int16 dy` |
| `0x02` | Absolute Mouse | `int16 x, int16 y` |
| `0x03` | Mouse Button Down | `uint8 button_mask` |
| `0x04` | Mouse Button Up | `uint8 button_mask` |
| `0x05` | Mouse Click | `uint8 button_mask` |
| `0x11` | Keyboard Key Down | `uint8 keycode` |
| `0x12` | Keyboard Key Up | `uint8 keycode` |
| `0x13` | Keyboard Key Send | `uint8 keycode` |
| `0x21` | Media Key Down | `int16 usage_code` |
| `0x22` | Media Key Up | (None) |
| `0x23` | Media Key Send | `int16 usage_code` |
| `0x31` | Text Injection | `string (utf8)` |
| `0x41` | Mouse Scroll | `int8 steps` |
| `0x42` | Touchpad Scroll | `int16 dx, int16 dy` |
| `0x43` | Touchpad Zoom | `int16 delta` |
| `0x44` | Custom Multi-Finger | `uint8 mask, 5x [uint16 x, uint16 y]` |
| `0x4F` | Lift Fingers | (None) - Releases all touchpad contacts |
| `0xF0` | Telemetry | `float temp, int8 rssi, uint8 power_save` |
| `0xFE` | System Reset | (None) - Triggers Hardware Restart |
| `0xFF` | Auth Handshake| `string password` |

### Custom Multi-Finger (0x44) Detail
The payload for `0x44` expects exactly 21 bytes following the opcode. 
1. `uint8` : Active mask. Bit 0 for Finger 1, Bit 1 for Finger 2, etc. (1=active, 0=inactive).
2. `5x [uint16 x, uint16 y]`: 5 blocks of X and Y positions (0-4095), Little-Endian.

## Home Assistant Services
The `esp_mouse` domain provides services for automation:
- `esp_mouse.move`: Relative movement (`x`, `y`).
- `esp_mouse.button`: Mouse clicks (`button`: left/right/middle, `mode`: click/down/up).
- `esp_mouse.key_control`: Keyboard keys (`keycode`, `mode`: send/press/release).
- `esp_mouse.text_send`: Raw string injection (`text`).

## Power & Thermal Management
The device operates in two states:
1. **High Performance:** 240MHz CPU, WiFi Sleep Disabled (~200mA). Triggered by activity.
2. **Power Saving:** 80MHz CPU, WiFi Modem Sleep Enabled (~80mA). Triggered after 20 minutes of inactivity.

**Thermal Throttle:** If the internal die temperature exceeds 80°C, the device will force itself into Power Saving mode until it cools below 60°C.