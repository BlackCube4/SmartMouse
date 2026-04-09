# KeyMouse
An ESP32-S3 based virtual HID (Keyboard/Mouse/Touchpad) that allows remote control via Home Assistant using high-speed WebSockets.

## Features
- **Air Mouse:** Use your smartphone's gyroscope to control the PC cursor.
- **Precision Touchpad:** Supports Windows multi-finger gestures and high-resolution scrolling.
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
type: custom:esp-mouse-card
device_id: <your_device_id>
gyroSensitivity: 1.2
smoothing: 0.15
suppression_offset: 30
debug: true
```

## Protocol Opcodes
| Opcode | Function | Payload |
| :--- | :--- | :--- |
| `0x01` | Relative Mouse | `int16 dx, int16 dy` |
| `0x02` | Absolute Mouse | `int16 x, int16 y` |
| `0x13` | Key Send | `uint8 keycode` |
| `0x41` | Text Send | `string (null terminated)` |
| `0xF0` | Telemetry | `float temp, int8 rssi` |
| `0xFF` | Auth Handshake| `string password` |

## Power & Thermal Management
The device operates in two states:
1. **High Performance:** 240MHz CPU, WiFi Sleep Disabled (~200mA). Triggered by activity.
2. **Power Saving:** 80MHz CPU, WiFi Modem Sleep Enabled (~80mA). Triggered after 20 minutes of inactivity.

**Thermal Throttle:** If the internal die temperature exceeds 80°C, the device will force itself into Power Saving mode until it cools below 60°C.