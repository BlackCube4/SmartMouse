"""ESP Mouse custom integration – persistent binary WebSocket link to ESP32."""
import asyncio
import struct
import logging
import websockets

DOMAIN = "esp_mouse"
_LOGGER = logging.getLogger(__name__)

# --- OPCODES DEFINITIONS (from S3_KeyMouseTest_4.ino) ---
# Mouse/Pointer
OPCODE_MOUSE_RELATIVE   = 0x01
OPCODE_MOUSE_ABSOLUTE   = 0x02
OPCODE_MOUSE_PRESS      = 0x21
OPCODE_MOUSE_RELEASE    = 0x22
OPCODE_MOUSE_CLICK      = 0x23

# Keyboard
OPCODE_KEY_PRESS        = 0x11
OPCODE_KEY_RELEASE      = 0x12
OPCODE_KEY_SEND         = 0x13
OPCODE_TEXT_SEND        = 0x41

# Media/Consumer Control
OPCODE_MEDIA_PRESS      = 0x31
OPCODE_MEDIA_RELEASE    = 0x32
OPCODE_MEDIA_SEND       = 0x33

# Scroll/Touchpad
OPCODE_SCROLL_WHEEL     = 0x51 # Low-res scroll (mouse wheel)
OPCODE_SCROLL_TOUCHPAD  = 0x52 # High-res scroll (touchpad)
OPCODE_SCROLL_END       = 0x53 # Touchpad scroll end

# Mouse button codes (from USBHIDMouse.h)
MOUSE_LEFT_BUTTON       = 0x01
MOUSE_RIGHT_BUTTON      = 0x02
MOUSE_MIDDLE_BUTTON     = 0x04
# -----------------------------------------------------------


async def async_setup(hass, config):
    """Set up the ESP Mouse integration."""
    host = config.get(DOMAIN, {}).get("host", "192.168.1.50")
    port = config.get(DOMAIN, {}).get("port", 81)

    ws_link = ESPMouseConnection(host, port)
    hass.data[DOMAIN] = ws_link
    hass.loop.create_task(ws_link.run_forever())

    # --- service handlers ---
    
    # 0x01: RELATIVE MOUSE MOVE
    async def handle_move(call):
        """Send relative mouse movement (dx, dy)."""
        dx = int(call.data.get("x", 0))
        dy = int(call.data.get("y", 0))
        
        # Format: 0x01 | int16 dx | int16 dy (5 bytes total, < means little-endian)
        packet = struct.pack("<Bhh", OPCODE_MOUSE_RELATIVE, dx, dy)
        await ws_link.send(packet, binary=True)

    # 0x02: ABSOLUTE MOUSE MOVE
    async def handle_move_absolute(call):
        """Send absolute mouse movement (x, y)."""
        x = int(call.data.get("x", 0))
        y = int(call.data.get("y", 0))
        
        # Format: 0x02 | int16 x | int16 y
        packet = struct.pack("<Bhh", OPCODE_MOUSE_ABSOLUTE, x, y)
        await ws_link.send(packet, binary=True)

    # 0x21, 0x22, 0x23: MOUSE BUTTON
    async def handle_button(call):
        """Send mouse button press, release, or click."""
        btn_name = call.data.get("button", "left").lower()
        mode = call.data.get("mode", "click").lower()
        
        if btn_name == "left":
            button_code = MOUSE_LEFT_BUTTON
        elif btn_name == "right":
            button_code = MOUSE_RIGHT_BUTTON
        elif btn_name == "middle":
            button_code = MOUSE_MIDDLE_BUTTON
        else:
            _LOGGER.warning("Unknown mouse button: %s", btn_name)
            return

        if mode == "click":
            opcode = OPCODE_MOUSE_CLICK
        elif mode == "down":
            opcode = OPCODE_MOUSE_PRESS
        elif mode == "up":
            opcode = OPCODE_MOUSE_RELEASE
        else:
            _LOGGER.warning("Unknown mouse mode: %s", mode)
            return

        # Format: opcode | uint8 button (2 bytes total)
        packet = struct.pack("<BB", opcode, button_code)
        await ws_link.send(packet, binary=True)

    # 0x51: MOUSE WHEEL SCROLL
    async def handle_scroll_wheel(call):
        """Send low-res scroll wheel movement."""
        delta = int(call.data.get("delta", 0))
        
        # Format: 0x51 | int16 value (3 bytes total)
        packet = struct.pack("<Bh", OPCODE_SCROLL_WHEEL, delta) 
        await ws_link.send(packet, binary=True)

    # 0x52, 0x53: TOUCHPAD SCROLL
    async def handle_touchpad_scroll(call):
        """Send high-res touchpad scroll movement (delta > 0) or scroll end (delta=0)."""
        delta = int(call.data.get("delta", 0))
        
        if delta == 0:
            # Opcode 0x53: SCROLL END (1 byte total)
            opcode = OPCODE_SCROLL_END
            packet = struct.pack("<B", opcode)
        else:
            # Opcode 0x52: HIGH-RES SCROLL (3 bytes total)
            opcode = OPCODE_SCROLL_TOUCHPAD
            packet = struct.pack("<Bh", opcode, delta)
            
        await ws_link.send(packet, binary=True)
        
    # 0x11, 0x12, 0x13: KEYBOARD CONTROL
    async def handle_key_control(call):
        """Send key press, release, or send for a single HID keycode."""
        keycode = int(call.data.get("keycode", 0))
        mode = call.data.get("mode", "send").lower()
        
        if mode == "press":
            opcode = OPCODE_KEY_PRESS
        elif mode == "release":
            opcode = OPCODE_KEY_RELEASE
        elif mode == "send":
            opcode = OPCODE_KEY_SEND
        else:
            _LOGGER.warning("Unknown key mode: %s", mode)
            return

        # Format: opcode | uint8 keycode (2 bytes total)
        packet = struct.pack("<BB", opcode, keycode)
        await ws_link.send(packet, binary=True)

    # 0x31, 0x32, 0x33: MEDIA/CONSUMER CONTROL
    async def handle_media_control(call):
        """Send media key press, release, or send."""
        code = int(call.data.get("code", 0))
        mode = call.data.get("mode", "send").lower()

        if mode == "press":
            opcode = OPCODE_MEDIA_PRESS
            # Format: 0x31 | int16 code (3 bytes total, <h is little-endian 16-bit)
            packet = struct.pack("<Bh", opcode, code)
        elif mode == "release":
            opcode = OPCODE_MEDIA_RELEASE
            # Format: 0x32 (1 byte total) - ESP code handles release without code payload
            packet = struct.pack("<B", opcode)
        elif mode == "send":
            opcode = OPCODE_MEDIA_SEND
            # Format: 0x33 | int16 code (3 bytes total)
            packet = struct.pack("<Bh", opcode, code)
        else:
            _LOGGER.warning("Unknown media mode: %s", mode)
            return

        await ws_link.send(packet, binary=True)

    # 0x41: TEXT SEND
    async def handle_text_send(call):
        """Send a string of text via the keyboard report."""
        text = call.data.get("text", "")
        if not text:
            return
        
        # Format: 0x41 | raw utf8 text...
        # The payload is the opcode (0x41) + the string encoded as bytes
        packet = struct.pack("<B", OPCODE_TEXT_SEND) + text.encode('utf-8')
        await ws_link.send(packet, binary=True)


    # --- Register ALL Services ---
    hass.services.async_register(DOMAIN, "move", handle_move)
    hass.services.async_register(DOMAIN, "move_absolute", handle_move_absolute)
    hass.services.async_register(DOMAIN, "button", handle_button) 
    hass.services.async_register(DOMAIN, "scroll_wheel", handle_scroll_wheel)
    hass.services.async_register(DOMAIN, "touchpad_scroll", handle_touchpad_scroll)
    
    # NEWLY ADDED/COMPLETED SERVICES
    hass.services.async_register(DOMAIN, "key_control", handle_key_control)
    hass.services.async_register(DOMAIN, "media_control", handle_media_control)
    hass.services.async_register(DOMAIN, "text_send", handle_text_send)

    return True


class ESPMouseConnection:
    """Persistent WebSocket connection to the ESP32 mouse server."""

    def __init__(self, host, port):
        self.uri = f"ws://{host}:{port}"
        self.ws = None
        self.connected = asyncio.Event()

    async def run_forever(self):
        """Maintain a persistent connection and reconnect on failure."""
        while True:
            try:
                _LOGGER.info("Connecting to ESP Mouse at %s", self.uri)
                # Note: ping_interval=None prevents automatic pings, relying on the ESP32 to maintain the connection
                async with websockets.connect(self.uri, ping_interval=None) as ws:
                    self.ws = ws
                    self.connected.set()
                    _LOGGER.info("Connected to ESP Mouse.")
                    async for _ in ws:
                        pass  # keep connection alive
            except Exception as err:
                _LOGGER.warning("ESP Mouse disconnected: %s", err)
                self.connected.clear()
                await asyncio.sleep(2)

    async def send(self, data, binary=False):
        """Send bytes (binary) or text to ESP."""
        if not self.connected.is_set():
            _LOGGER.debug("Not connected, dropping packet")
            return
        try:
            # websockets automatically detects bytes → binary
            await self.ws.send(data)
        except Exception as err:
            _LOGGER.warning("Send failed: %s", err)