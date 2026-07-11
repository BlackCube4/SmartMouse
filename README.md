# SmartMouse
An ESP32-S3 based virtual HID (Keyboard/Mouse/Touchpad) that allows remote control via Home Assistant using high-speed WebSockets.

## Features
- **Air Mouse:** Use your smartphone's gyroscope to control the PC cursor.
- **Precision Touchpad:** Supports Windows multi-finger gestures and high-resolution scrolling.
- **Media & Keyboard Control:** Dedicated services for media keys, HID keycodes, and raw text injection.
- **Low Latency:** Optimized for sub-ms response times via `WiFi.setSleep(false)` and 240MHz CPU scaling.
- **Secure:** Simple shared-secret handshake authentication.
- **Telemetry:** Real-time monitoring of ESP32 internal temperature and WiFi signal strength.

## Getting Started From Scratch

This walks through the whole process assuming you've never programmed a microcontroller before. It looks long, but each step is small.

### What you need
- An **ESP32-S3** development board with native USB support (needs to appear as its own USB device, not just a USB-to-serial adapter — most "ESP32-S3-DevKitC-1" style boards work).
- A USB cable that carries data (not a charge-only cable) to connect it to your computer.
- A computer (Windows/Mac/Linux) to program the board.
- A running Home Assistant instance.
- *Optional:* a W5500 Ethernet module, if you want a wired connection instead of WiFi for a specific device (see [Wiring: Ethernet](#optional-wiring-w5500-ethernet) below).
- *Optional:* basic soldering/electronics know-how, only if you want remote PC power control (see [Wiring: PC Power Control](#optional-wiring-pc-power-control) below).

### 1. Install Arduino IDE
Download and install the [Arduino IDE](https://www.arduino.cc/en/software) (version 2.x).

### 2. Add ESP32 board support
1. Open Arduino IDE → **File → Preferences** → paste this URL into "Additional Board Manager URLs": `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
2. **Tools → Board → Boards Manager**, search for `esp32`, install the package by **Espressif Systems**.

### 3. Install the required libraries
**Tools → Manage Libraries**, search for and install both of these:
- `WebSockets` (by Markus Sattler)
- `Adafruit NeoPixel` (by Adafruit)

Everything else this project needs (WiFi, WebServer, Preferences, mDNS, NetBIOS, ArduinoOTA, Ethernet, USB HID) is already built into the ESP32 board package from step 2 — no other libraries to install.

### 4. Download this project
Click the green **Code** button on the GitHub page → **Download ZIP** → extract it. The firmware lives in `Arduino IDE/SmartMouse` — Arduino IDE requires the sketch folder name to match the main file name, and `SmartMouse/SmartMouse.ino` already satisfies that, so no renaming needed.

### 5. Open the sketch and configure the board
1. In Arduino IDE: **File → Open** → select `Arduino IDE/SmartMouse/SmartMouse.ino`.
2. **Tools → Board → esp32 →** select your exact board (e.g. "ESP32S3 Dev Module").
3. Still under **Tools**, set:
   - **USB Mode: "USB-OTG (TinyUSB)"** — required, this is what lets the board act as a real keyboard/mouse.
   - **USB CDC On Boot: "Enabled"** — optional, but lets you see debug output over USB in the Serial Monitor.
4. **Tools → Port** → select the port that appears when the board is plugged in.
5. *(Optional but recommended)* Open `Arduino IDE/SmartMouse/SmartMouse.ino` and change `DEFAULT_SECRET` (near the top) to your own random string of at least 8 characters — this authenticates WebSocket clients and OTA updates, *and* doubles as the password for the setup hotspot in step 7 below, so don't ship it with the default value.

### 6. Upload the firmware
Click the **Upload** button (→ arrow icon). If it fails to find the port or upload: hold the **BOOT** button on the board, tap **RESET** (or plug in the USB cable while holding BOOT), release BOOT, then try Upload again — this forces the board into flashing mode. This is a common one-time hiccup on the very first upload.

### 7. First boot: connect it to your WiFi
The board has no network configured yet, so it starts its own WiFi hotspot:
1. On your phone or laptop, connect to the WiFi network **`SmartMouse-Setup`** (password: whatever you set `DEFAULT_SECRET` to in step 5 — or `SmartMouse123` if you left it at the default, or if your custom secret was under 8 characters).
2. A setup page should open automatically (captive portal); if not, open a browser and go to `http://192.168.4.1/wifi`.
3. Pick your home WiFi network, enter its password, optionally set a "Device Name" (useful once you have more than one SmartMouse — this becomes its hostname, e.g. `<name>.local`), and (if you wired it up) check "Enable PC Power Control".
4. Click **Save** — the board restarts and joins your home WiFi.

### 8. Find the device on your network
Look it up in your router's connected-devices list, or try `http://smartmouse.local` in a browser. Note its IP address — you'll need it for the Home Assistant integration.

### 9. Install the Home Assistant integration
1. Copy the `Home Assistant custom component/smartmouse` folder from this repo into your Home Assistant config's `custom_components` directory (create that directory first if it doesn't exist yet) — no renaming needed, it's already named correctly.
2. Restart Home Assistant.
3. **Settings → Devices & Services → Add Integration** → search for "SmartMouse" → enter the device's IP address, port `81`, and the secret key you set in step 5.

### 10. Build and install the dashboard cards
The Lovelace cards need to be compiled once:
1. Install [Node.js](https://nodejs.org) (LTS version) if you don't have it.
2. Open a terminal in the `Home Assistant Card` folder and run:
   ```
   npm install
   npm run build
   ```
3. Copy the resulting `Home Assistant Card/dist/smartmouse-cards.js` into your Home Assistant config's `www` folder (e.g. `config/www/smartmouse-cards.js`).
4. In Home Assistant: **Settings → Dashboards → ⋮ (top right) → Resources → Add Resource**, URL `/local/smartmouse-cards.js`, type **JavaScript Module**.

### 11. Add cards to your dashboard
Edit your dashboard, **Add Card**, search for "SmartMouse" — you'll see the Touchpad, Gyro, Desktop, Input, Modifier, and Container cards. Add the ones you want and set each card's "Target Device" to your SmartMouse device.

That's the whole setup for a WiFi-only device with basic mouse/keyboard/touchpad control. The two sections below are optional hardware add-ons.

### (Optional) Wiring: PC Power Control
This lets Home Assistant turn your PC on/off/sleep by simulating presses of its physical power button, and read its power state back. It requires basic electronics knowledge — you're wiring into your motherboard's front-panel headers, so double-check polarity and voltages against your motherboard's manual before connecting anything.

- **GPIO 7** (`PIN_POWER_SW`): through a small relay or transistor switch (don't wire a GPIO directly across the header), connect to your motherboard's front-panel **power switch** header (usually labeled `PWR_SW`, 2 pins). The board pulses this briefly to simulate a button press.
- **GPIO 8** (`PIN_POWER_STAT`): through an optocoupler, connect to your motherboard's front-panel **power LED** header (`PWR_LED`). The board reads the LED's on/off/blink pattern to determine whether the PC is on, off, or asleep.

If you don't need remote power control, skip this entirely and leave "Enable PC Power Control" unchecked in the setup page.

### (Optional) Wiring: W5500 Ethernet
For a device sitting near a LAN port, wiring up a W5500 module gets you a wired connection automatically — no setup page changes needed. On boot, the firmware briefly checks for a W5500 module; if it finds one with a live cable, it uses Ethernet, otherwise it falls back to WiFi exactly as described above. Wire it to these pins (see `PIN_ETH_*` near the top of `SmartMouse.ino`):

| W5500 pin | ESP32-S3 GPIO |
| :--- | :--- |
| RST  | 1 |
| MISO | 2 |
| SCK  | 4 |
| CS   | 5 |
| INT  | 6 |
| MOSI | 12 |
| VCC  | 3.3V |
| GND  | GND |

Leave it unwired on devices that should stay on WiFi — the boot-time probe fails fast and harmlessly if nothing responds.

## Home Assistant Configuration

### Installation
See [Getting Started From Scratch](#9-install-the-home-assistant-integration) above for the full walkthrough. In short: copy this repo's `Home Assistant custom component/smartmouse` folder into your Home Assistant config's `custom_components` directory, restart Home Assistant, then add the integration via **Settings → Devices & Services**.

### Gyro / UI Configuration
When using the custom card, you can tune the following parameters in the card's YAML:

```yaml
type: custom:smartmouse-card
device_id: <your_device_id>     # The ID of your device
mouseSensitivity: 1.8           # Multiplier for touchpad cursor speed
scrollSensitivity: 3            # Multiplier for touchpad scroll speed
gyroSensitivity: 8              # Multiplier for Air Mouse movement
smoothing: 0.15                 # Low-pass filter (0.0-1.0). Higher = smoother, more lag
suppressionOffset: 20           # Ms to ignore gyro after a click (prevents jitter)
doubleClickTime: 250            # Max ms between taps for double-click
holdTime: 400                   # Ms to hold before triggering Right Click
movementDeadzone: 3             # Deadzone in px before a tap becomes a move/drag
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
| `0xA0` | PC Power Control | `uint8 0x01=Toggle, 0x02=Hard Off, 0x03=Power On, 0x04=Power Off` |
| `0xF0` | Telemetry | `float temp, int8 rssi, uint8 power_save` |
| `0xFE` | System Reset | (None) - Triggers Hardware Restart |
| `0xFF` | Auth Handshake| `string password` |

### Custom Multi-Finger (0x44) Detail
The payload for `0x44` expects exactly 21 bytes following the opcode. 
1. `uint8` : Active mask. Bit 0 for Finger 1, Bit 1 for Finger 2, etc. (1=active, 0=inactive).
2. `5x [uint16 x, uint16 y]`: 5 blocks of X and Y positions (0-4095), Little-Endian.

## Home Assistant Services
The `smartmouse` domain provides services for automation:
- `smartmouse.move`: Relative movement (`x`, `y`).
- `smartmouse.button`: Mouse clicks (`button`: left/right/middle, `mode`: click/down/up).
- `smartmouse.key_control`: Keyboard keys (`keycode`, `mode`: send/press/release).
- `smartmouse.text_send`: Raw string injection (`text`).

## Power & Thermal Management
The device operates in two states:
1. **High Performance:** 240MHz CPU, WiFi Sleep Disabled (~200mA). Triggered by activity.
2. **Power Saving:** 80MHz CPU, WiFi Modem Sleep Enabled (~80mA). Triggered after 1 minute of inactivity.

**Thermal Throttle:** If the internal die temperature exceeds 80°C, the device will force itself into Power Saving mode until it cools below 60°C.