# SmartMouse Binary WebSocket Protocol

This binary protocol is implemented independently in three places. There is no
code generation tying them together, so **when adding or changing an opcode,
update all three, then update this table**:

1. Firmware (receiver/authority): `SmartMouse.ino` — `handleMouseCmd`,
   `handleKeyboardCmd`, `handleMediaCmd`, `handleTouchpadCmd`,
   `handlePCPowerCmd`, plus the `0xFF` auth and `0xF0` telemetry handling in
   `onWebSocketEvent`.
2. Python integration (sender, via Home Assistant services):
   `Home Assistant custom component/smartmouse/__init__.py` — the `OPCODE_*` constants
   near the top of the file.
3. Standalone control page (sender, independent WebSocket client):
   `index_html.h` — the `OP` object inside `class ServiceManager`.

All packets are sent as raw binary WebSocket frames. Multi-byte integers are
little-endian.

| Opcode | Name | Direction | Payload | Firmware | Python | index_html.h |
|---|---|---|---|:---:|:---:|:---:|
| `0x01` | MOUSE_RELATIVE | client → device | `int16 dx, int16 dy` | ✅ | ✅ | ✅ |
| `0x02` | MOUSE_ABSOLUTE | client → device | `int16 x, int16 y` | ✅ | ✅ | ✅ |
| `0x03` | MOUSE_PRESS | client → device | `uint8 button_mask` | ✅ | ✅ | ✅ |
| `0x04` | MOUSE_RELEASE | client → device | `uint8 button_mask` | ✅ | ✅ | ✅ |
| `0x05` | MOUSE_CLICK | client → device | `uint8 button_mask` | ✅ | ✅ | ✅ |
| `0x11` | KEY_PRESS | client → device | `uint8 keycode` | ✅ | ✅ | ✅ |
| `0x12` | KEY_RELEASE | client → device | `uint8 keycode` | ✅ | ✅ | ✅ |
| `0x13` | KEY_SEND | client → device | `uint8 keycode` | ✅ | ✅ | ✅ |
| `0x21` | MEDIA_PRESS | client → device | `int16 consumer_code` | ✅ | ✅ | ✅ |
| `0x22` | MEDIA_RELEASE | client → device | *(none)* | ✅ | ✅ | ✅ |
| `0x23` | MEDIA_SEND | client → device | `int16 consumer_code` | ✅ | ✅ | ❌ (not exposed in the standalone page's UI, press/release only) |
| `0x31` | TEXT_SEND | client → device | `utf8 text, \0` | ✅ | ✅ | ✅ |
| `0x41` | SCROLL_WHEEL | client → device | `int8 steps` | ✅ | ✅ | ✅ |
| `0x42` | SCROLL_TOUCHPAD | client → device | `int16 dx, int16 dy` | ✅ | ✅ | ✅ |
| `0x44` | TOUCHPAD_GESTURE | client → device | `uint8 mask, [int16 x, int16 y] * 5` | ✅ | ❌ | ❌ (5-finger gesture, only used by the TS touchpad card) |
| `0x4F` | SCROLL_END | client → device | *(none)* | ✅ | ✅ | ✅ |
| `0xA0` | PC_CONTROL | client → device | `uint8 sub_cmd` (`0x01` toggle, `0x02` hard-off, `0x03` on, `0x04` off) | ✅ | ✅ | ✅ |
| `0xFE` | SYSTEM_RESET | client → device | *(none)* | ✅ | ✅ | ✅ |
| `0xFF` | AUTH | client → device | `utf8 secret, \0` | ✅ | n/a (handled by firmware only) | ✅ |
| `0xF0` | TELEMETRY | device → client | `float temp, int8 rssi, uint8 sleeping, uint8 pc_state, uint8 caps` (`caps` bit 0 = PC power supported, bit 1 = connected via Ethernet) | ✅ | n/a | ✅ |

Not protocol opcodes, but byte values that live in the same packets and are
easy to confuse with opcodes:
- `0xE0`-`0xE7`: HID keycodes for the 8 standard modifier keys, sent as the
  payload of `KEY_RELEASE` (`0x12`) when resetting state — not opcodes
  themselves.
- Mouse button mask: `1` = left, `2` = right, `4` = middle.
