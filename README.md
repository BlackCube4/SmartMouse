# SmartMouse
An ESP32-S3 based virtual HID (Keyboard/Mouse/Touchpad) that allows remote control via Home Assistant using high-speed WebSockets.

## Features
- **Air Mouse:** Use your smartphone's gyroscope to control the PC cursor (relative or absolute), with Steam-style motion smoothing.
- **Precision Touchpad:** Supports Windows multi-finger gestures and high-resolution scrolling.
- **Media & Keyboard Control:** Dedicated services for media keys, HID keycodes, and raw text injection.
- **PC Power Control (optional):** Turn the PC on/off/sleep and read its power state, via the motherboard front-panel headers.
- **Wired or wireless:** WiFi by default, with optional auto-detected W5500 Ethernet for stability.
- **Multi-device:** Run several SmartMice in one house, each with a configurable name.
- **Low Latency:** Optimized for sub-ms response times via `WiFi.setSleep(false)` and 240MHz CPU scaling.
- **Secure:** Simple shared-secret handshake authentication.
- **Telemetry:** Real-time monitoring of ESP32 internal temperature, WiFi signal strength, and connection type.

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
5. Copy `Arduino IDE/SmartMouse/secrets.example.h` to `secrets.h` in the same folder and set `SMARTMOUSE_SECRET` to your own random string of at least 8 characters (e.g. `openssl rand -base64 18`). The secret authenticates Home Assistant, the built-in control page and OTA updates, *and* doubles as the password for the setup hotspot in step 7 below. `secrets.h` is ignored by git, so it never ends up in the repository; the sketch does not compile without it.

### 6. Upload the firmware
Click the **Upload** button (→ arrow icon). If it fails to find the port or upload: hold the **BOOT** button on the board, tap **RESET** (or plug in the USB cable while holding BOOT), release BOOT, then try Upload again — this forces the board into flashing mode. This is a common one-time hiccup on the very first upload.

### 7. First boot: connect it to your WiFi
The board has no network configured yet, so it starts its own WiFi hotspot:
1. On your phone or laptop, connect to the WiFi network **`SmartMouse-Setup`** (password: your `SMARTMOUSE_SECRET` from step 5 — or `SmartMouse123` if it is shorter than 8 characters).
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

> Note: `npm run build` also regenerates `Arduino IDE/SmartMouse/smartmouse_bundle.h` — the firmware's built-in control page (`http://<device>/`) is built from the same TypeScript sources as the cards, so a fix reaches both. That generated file is committed, so you only need to rebuild + reflash if you change the card/handler TypeScript.

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

> **Power note:** the W5500 draws noticeably more current than WiFi-only operation, and small breakout boards (e.g. "Super Mini" style) often carry a weak onboard 3.3V regulator. If a wired device becomes unresponsive under load and only recovers after a power cycle, try powering the W5500 from a separate, adequately-rated 3.3V source (e.g. a small buck converter) rather than the ESP32's own 3.3V pin, before suspecting a firmware/software cause.

## Home Assistant Configuration

### Installation
See [Getting Started From Scratch](#9-install-the-home-assistant-integration) above for the full walkthrough. In short: copy this repo's `Home Assistant custom component/smartmouse` folder into your Home Assistant config's `custom_components` directory, restart Home Assistant, then add the integration via **Settings → Devices & Services**.

### Card Configuration
Each card is configured through Home Assistant's **visual editor** (click the card → Edit) — there's no need to hand-write YAML. Every card has a **Target Device** field; most cards add their own tuning options, e.g.:

- **Touchpad card:** touchpad sensitivity, scroll sensitivity, scroll type (precision vs. mouse-wheel), invert scroll.
- **Gyro card:** mode (relative air-mouse vs. absolute laser-pointer), sensitivity, smoothing, jitter suppression (deg/s), custom button text/icon, hide text/hide icon (button shrinks to fit whichever is left), button height.
- **Input card:** input mode — *Buffered* (type, then press Enter to send), *Live* (sends as you type, reliable but shows a password-style keyboard), or *Predictive* (a normal text field that keeps your phone's autocorrect/word prediction; edits and cursor moves are replayed on the PC, and the field auto-clears after a configurable idle period) — plus a "Debug: Show Raw Text" toggle that displays the field's actual internal buffer below the input (whitespace rendered as visible glyphs, with a marker for the text cursor), for troubleshooting Live/Predictive capture.
- **Debug card:** no options — drop it on a dashboard to see live gyro sample rate, resolution, and a rough quality verdict, useful when tuning gyro sensitivity/smoothing.

Defaults are sensible, so an unconfigured card works out of the box; adjust in the editor to taste.

> **Known limitation (Live input, mobile):** when you press-and-hold Backspace on a phone, the on-screen keyboard's per-keystroke haptic feedback only fires once instead of on every auto-repeat, once the delete reaches the start of the field. This was investigated extensively (varying the field-reset delay, buffering extra characters, comparing against the original single-space design) and appears to be Gboard's own key-repeat/haptic behaviour for a JavaScript-managed field whose value keeps changing underneath it — a web page has no documented way to influence it. Deletion itself keeps working correctly; only the vibration is affected. Recorded here so it isn't re-investigated from scratch.
>
> **Note (Predictive input + third-party password managers):** some Android password-manager apps (e.g. KeePassDX) may offer an autofill/"sign in" bar over the keyboard on the predictive field. This is the password-manager app's own per-field autofill association (stored in its database, and it can persist across restarts), not something the card sets — the field is a plain `type="text"` input, not a password field. If it bothers you, exclude the Home Assistant app/site in your password manager's autofill settings, or delete its saved association for that field.

## Standalone Control Page
Every device also serves its own control page directly at `http://<device>/` (or `http://<name>.local/`) — no Home Assistant required. The browser asks for a login: user name `smartmouse`, password your secret. The WiFi settings page `http://<device>/wifi` is protected the same way; only on the setup hotspot are the pages open. It mirrors the Lovelace cards (touchpad, gyro, keyboard, media keys) and is handy for a quick control from a phone browser, or as a fallback if Home Assistant is down.

- Tapping the device name in the top-left (next to the connection dot) restarts the ESP, after a confirmation prompt.
- Connection dot colors: 🟢 green = connected, 🟡 yellow = connecting/reconnecting, 🔴 red = disconnected.
- On mobile it opens straight into the full control layout — no expand/collapse step.

## Protocol
The binary WebSocket protocol (opcodes, payloads, telemetry format) is documented in **[PROTOCOL.md](PROTOCOL.md)** — a single reference shared by the firmware, the Python integration, and the web bundle. See that file rather than duplicating the table here.

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

## Repository Layout (for contributors)
```
Arduino IDE/SmartMouse/     ESP32-S3 firmware (Arduino sketch)
  SmartMouse.ino              main firmware
  USBHID*.cpp/.h              USB HID mouse/keyboard/touchpad drivers
  index_html.h               the built-in control page (CSS + skeleton; loads /smartmouse.js)
  smartmouse_bundle.h        GENERATED — do not hand-edit (see below)
Home Assistant Card/        Lovelace cards + the standalone-page bundle (one TypeScript project)
  gyro-handler.ts,           shared, transport-agnostic gesture/sensor logic
  touchpad-handler.ts,
  live-input.ts
  service-manager.ts         HA transport (hass.callService)
  ws-service-manager.ts      WebSocket transport (for the standalone page)
  smartmouse-*-card.ts       the Lit cards for Home Assistant
  standalone/                the firmware page's UI (plain DOM), built into the bundle
Home Assistant custom component/smartmouse/   the Python HA integration
scripts/embed-bundle.mjs     writes the built standalone bundle into smartmouse_bundle.h
PROTOCOL.md                  the binary opcode reference (single source of truth)
```

**One source of truth.** The gesture/sensor logic (gyro smoothing, touchpad, live text input) lives once in TypeScript and is shared by both the Home Assistant cards *and* the firmware's built-in web page. `npm run build` in `Home Assistant Card/` produces two bundles — `dist/smartmouse-cards.js` (for HA) and the standalone page's JS, which `scripts/embed-bundle.mjs` writes into `Arduino IDE/SmartMouse/smartmouse_bundle.h` (served by the ESP at `/smartmouse.js`). So a fix to a handler reaches both surfaces; after changing any TypeScript, rebuild and reflash. `smartmouse_bundle.h` is generated — never edit it by hand.

## License

Copyright (C) 2025-2026 BlackCube4

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See [LICENSE](LICENSE) for the full text.
