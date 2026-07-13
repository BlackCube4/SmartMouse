"""SmartMouse custom integration – persistent binary WebSocket link to ESP32."""
import asyncio
import struct
import logging
import websockets
import voluptuous as vol
import homeassistant.helpers.config_validation as cv
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers import device_registry as dr

from .const import DOMAIN, CONF_PASSWORD

PLATFORMS = ["binary_sensor", "sensor", "button"]

_LOGGER = logging.getLogger(__name__)

# PRE-COMPILE STRUCTS for maximum speed. 
# This avoids parsing the format string on every single mouse move.
MOVE_PACKER = struct.Struct("<Bhh")

# --- OPCODES DEFINITIONS (from S3_SmartMouseTest_4.ino) ---
# Mouse/Pointer
OPCODE_MOUSE_RELATIVE   = 0x01
OPCODE_MOUSE_ABSOLUTE   = 0x02
OPCODE_MOUSE_PRESS      = 0x03
OPCODE_MOUSE_RELEASE    = 0x04
OPCODE_MOUSE_CLICK      = 0x05

# Keyboard
OPCODE_KEY_PRESS        = 0x11
OPCODE_KEY_RELEASE      = 0x12
OPCODE_KEY_SEND         = 0x13
OPCODE_TEXT_SEND        = 0x31

# Media/Consumer Control
OPCODE_MEDIA_PRESS      = 0x21
OPCODE_MEDIA_RELEASE    = 0x22
OPCODE_MEDIA_SEND       = 0x23

# Scroll/Touchpad
OPCODE_SCROLL_WHEEL     = 0x41 # Low-res scroll (mouse wheel)
OPCODE_SCROLL_TOUCHPAD  = 0x42 # High-res scroll (touchpad)
OPCODE_SCROLL_END       = 0x4F # Touchpad scroll end (Lift Fingers)

# Mouse button codes (from USBHIDMouse.h)
MOUSE_LEFT_BUTTON       = 0x01
MOUSE_RIGHT_BUTTON      = 0x02
MOUSE_MIDDLE_BUTTON     = 0x04

OPCODE_SYSTEM_RESET     = 0xFE

# PC Power Control
OPCODE_PC_CONTROL       = 0xA0
PC_CMD_TOGGLE           = 0x01
PC_CMD_HARD_OFF         = 0x02
PC_CMD_ON               = 0x03
PC_CMD_OFF              = 0x04
# -----------------------------------------------------------

# --- SERVICE SCHEMAS ---
SERVICE_MOVE_SCHEMA = vol.Schema({
    vol.Required("x"): vol.Coerce(int),
    vol.Required("y"): vol.Coerce(int),
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_MOVE_ABS_SCHEMA = vol.Schema({
    vol.Required("x"): vol.All(vol.Coerce(int), vol.Range(min=0, max=32767)),
    vol.Required("y"): vol.All(vol.Coerce(int), vol.Range(min=0, max=32767)),
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_BUTTON_SCHEMA = vol.Schema({
    vol.Optional("button", default="left"): vol.In(["left", "right", "middle"]),
    vol.Optional("mode", default="click"): vol.In(["click", "down", "up"]),
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_WHEEL_SCROLL_SCHEMA = vol.Schema({
    vol.Required("delta"): vol.Coerce(int),
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_TOUCHPAD_SCROLL_SCHEMA = vol.Schema({
    vol.Optional("x", default=0): vol.Coerce(int),
    vol.Optional("y", default=0): vol.Coerce(int),
    vol.Optional("end", default=False): cv.boolean,
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_KEY_SCHEMA = vol.Schema({
    vol.Required("keycode"): vol.All(vol.Coerce(int), vol.Range(min=0, max=255)),
    vol.Optional("mode", default="send"): vol.In(["press", "release", "send"]),
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_MEDIA_SCHEMA = vol.Schema({
    vol.Required("code"): vol.All(vol.Coerce(int), vol.Range(min=0, max=0xFFFF)),
    vol.Optional("mode", default="send"): vol.In(["press", "release", "send"]),
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_TEXT_SCHEMA = vol.Schema({
    vol.Required("text"): cv.string,
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_RESET_SCHEMA = vol.Schema({
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_PC_POWER_SCHEMA = vol.Schema({
    vol.Optional("device_id"): vol.Any(cv.string, list),
})

SERVICE_MAP = {
    "move": (OPCODE_MOUSE_RELATIVE, "<Bhh", ["x", "y"]),
    "move_absolute": (OPCODE_MOUSE_ABSOLUTE, "<Bhh", ["x", "y"]),
    "scroll_wheel": (OPCODE_SCROLL_WHEEL, "<Bb", ["delta"]),
    "touchpad_scroll": (OPCODE_SCROLL_TOUCHPAD, "<Bhh", ["x", "y"]),
}
# -----------------------


async def async_setup(hass, config):
    """Set up the SmartMouse component from configuration.yaml (not used but required)."""
    return True


async def async_setup_entry(hass, entry: ConfigEntry):
    """Set up the SmartMouse integration."""
    host = entry.data[CONF_HOST]
    port = entry.data[CONF_PORT]
    password = entry.data.get(CONF_PASSWORD, "")

    ws_link = SmartMouseConnection(host, port, password, entry)
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {}
    hass.data[DOMAIN][entry.entry_id] = ws_link
    hass.async_create_task(ws_link.run_forever())

    # Forward setup to platforms (like binary_sensor)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Only register services once globally
    if hass.data.get(f"{DOMAIN}_services_registered"):
        return True
    hass.data[f"{DOMAIN}_services_registered"] = True

    def get_ws_link(call):
        device_ids = call.data.get("device_id")
        if not device_ids:
            if hass.data.get(DOMAIN):
                return next(iter(hass.data[DOMAIN].values()))
            return None
            
        if isinstance(device_ids, str):
            device_ids = [device_ids]
            
        registry = dr.async_get(hass)
        for device_id in device_ids:
            device = registry.async_get(device_id)
            if device:
                for entry_id in device.config_entries:
                    if link := hass.data.get(DOMAIN, {}).get(entry_id):
                        return link
        
        _LOGGER.warning("SmartMouse device_id %s not found or inactive.", device_ids)
        return None

    # --- service handlers ---
    
    # 0x01: RELATIVE MOUSE MOVE
    async def handle_move(call):
        """Send relative mouse movement (dx, dy)."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        dx = int(call.data.get("x", 0))
        dy = int(call.data.get("y", 0))
        
        # Format: 0x01 | int16 dx | int16 dy (5 bytes total, < means little-endian)
        packet = MOVE_PACKER.pack(OPCODE_MOUSE_RELATIVE, dx, dy)
        await ws_link.send(packet, binary=True)

    # 0x02: ABSOLUTE MOUSE MOVE
    async def handle_move_absolute(call):
        """Send absolute mouse movement (x, y)."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        x = int(call.data.get("x", 0))
        y = int(call.data.get("y", 0))
        
        # Format: 0x02 | int16 x | int16 y
        packet = struct.pack("<Bhh", OPCODE_MOUSE_ABSOLUTE, x, y)
        await ws_link.send(packet, binary=True)

    # 0x21, 0x22, 0x23: MOUSE BUTTON
    async def handle_button(call):
        """Send mouse button press, release, or click."""
        ws_link = get_ws_link(call)
        if not ws_link: return
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

    # 0x41: MOUSE WHEEL SCROLL
    async def handle_scroll_wheel(call):
        """Send low-res scroll wheel movement."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        delta = int(call.data.get("delta", 0))

        # Format: 0x41 | int8 value (2 bytes total) to match README/WebUI
        packet = struct.pack("<Bb", OPCODE_SCROLL_WHEEL, delta)
        await ws_link.send(packet, binary=True)

    # 0x42, 0x4F: TOUCHPAD SCROLL
    async def handle_touchpad_scroll(call):
        """Move the two scroll fingers (x, y) or lift them (end: true).

        (0, 0) is a keepalive that holds the fingers in place, so lifting must
        be requested explicitly via end=true - otherwise a paused scroll would
        end and Windows would misread the resume as a cursor move.
        """
        ws_link = get_ws_link(call)
        if not ws_link: return

        if call.data.get("end"):
            # Opcode 0x4F: SCROLL END (1 byte total)
            packet = struct.pack("<B", OPCODE_SCROLL_END)
        else:
            # Opcode 0x42: HIGH-RES SCROLL (5 bytes total)
            x = int(call.data.get("x", 0))
            y = int(call.data.get("y", 0))
            packet = struct.pack("<Bhh", OPCODE_SCROLL_TOUCHPAD, x, y)

        await ws_link.send(packet, binary=True)
        
    # 0x11, 0x12, 0x13: KEYBOARD CONTROL
    async def handle_key_control(call):
        """Send key press, release, or send for a single HID keycode."""
        ws_link = get_ws_link(call)
        if not ws_link: return
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

    # 0x21, 0x22, 0x23: MEDIA/CONSUMER CONTROL
    async def handle_media_control(call):
        """Send media key press, release, or send."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        code = int(call.data.get("code", 0))
        mode = call.data.get("mode", "send").lower()

        if mode == "press":
            opcode = OPCODE_MEDIA_PRESS
            # Format: 0x21 | int16 code (3 bytes total, <h is little-endian 16-bit)
            packet = struct.pack("<Bh", opcode, code)
        elif mode == "release":
            opcode = OPCODE_MEDIA_RELEASE
            # Format: 0x22 (1 byte total) - ESP code handles release without code payload
            packet = struct.pack("<B", opcode)
        elif mode == "send":
            opcode = OPCODE_MEDIA_SEND
            # Format: 0x23 | int16 code (3 bytes total)
            packet = struct.pack("<Bh", opcode, code)
        else:
            _LOGGER.warning("Unknown media mode: %s", mode)
            return

        await ws_link.send(packet, binary=True)

    # 0x31: TEXT SEND
    async def handle_text_send(call):
        """Send a string of text via the keyboard report."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        text = call.data.get("text", "")
        if not text:
            return
        
        # CRITICAL FIX: Add null terminator \x00 for ESP32's C-string expectations
        # Format: 0x31 | raw utf8 text | \x00
        packet = struct.pack("<B", OPCODE_TEXT_SEND) + text.encode('utf-8') + b'\x00'
        await ws_link.send(packet, binary=True)

    # 0xFE: SYSTEM RESET
    async def handle_reset(call):
        """Release all modifiers and trigger ESP hardware reset."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        # 1. Release all 8 HID modifier keys (0xE0 to 0xE7 / 224 to 231)
        for code in range(0xE0, 0xE8):
            packet = struct.pack("<BB", OPCODE_KEY_RELEASE, code)
            await ws_link.send(packet, binary=True)
        
        # 2. Trigger Hardware Restart on ESP
        packet = struct.pack("<B", OPCODE_SYSTEM_RESET)
        await ws_link.send(packet, binary=True)

    async def handle_pc_toggle(call):
        """Pulse the PC power button."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        packet = struct.pack("<BB", OPCODE_PC_CONTROL, PC_CMD_TOGGLE)
        await ws_link.send(packet, binary=True)

    async def handle_pc_hard_off(call):
        """Hold the PC power button for a hard shutdown."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        packet = struct.pack("<BB", OPCODE_PC_CONTROL, PC_CMD_HARD_OFF)
        await ws_link.send(packet, binary=True)

    async def handle_pc_on(call):
        """Turn the PC on if it's currently off."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        packet = struct.pack("<BB", OPCODE_PC_CONTROL, PC_CMD_ON)
        await ws_link.send(packet, binary=True)

    async def handle_pc_off(call):
        """Turn the PC off if it's currently on."""
        ws_link = get_ws_link(call)
        if not ws_link: return
        packet = struct.pack("<BB", OPCODE_PC_CONTROL, PC_CMD_OFF)
        await ws_link.send(packet, binary=True)

    # Register PC Power Services
    hass.services.async_register(DOMAIN, "pc_power_toggle", handle_pc_toggle, schema=SERVICE_PC_POWER_SCHEMA)
    hass.services.async_register(DOMAIN, "pc_hard_power_off", handle_pc_hard_off, schema=SERVICE_PC_POWER_SCHEMA)
    hass.services.async_register(DOMAIN, "pc_power_on", handle_pc_on, schema=SERVICE_PC_POWER_SCHEMA)
    hass.services.async_register(DOMAIN, "pc_power_off", handle_pc_off, schema=SERVICE_PC_POWER_SCHEMA)

    # --- Register ALL Services ---
    # Using schemas makes these services safer and visible in HA's UI
    hass.services.async_register(DOMAIN, "move", handle_move, schema=SERVICE_MOVE_SCHEMA)
    hass.services.async_register(DOMAIN, "move_absolute", handle_move_absolute, schema=SERVICE_MOVE_ABS_SCHEMA)
    hass.services.async_register(DOMAIN, "button", handle_button, schema=SERVICE_BUTTON_SCHEMA) 
    hass.services.async_register(DOMAIN, "scroll_wheel", handle_scroll_wheel, schema=SERVICE_WHEEL_SCROLL_SCHEMA)
    hass.services.async_register(DOMAIN, "touchpad_scroll", handle_touchpad_scroll, schema=SERVICE_TOUCHPAD_SCROLL_SCHEMA)
    
    hass.services.async_register(DOMAIN, "key_control", handle_key_control, schema=SERVICE_KEY_SCHEMA)
    hass.services.async_register(DOMAIN, "media_control", handle_media_control, schema=SERVICE_MEDIA_SCHEMA)
    hass.services.async_register(DOMAIN, "text_send", handle_text_send, schema=SERVICE_TEXT_SCHEMA)
    hass.services.async_register(DOMAIN, "reset", handle_reset, schema=SERVICE_RESET_SCHEMA)

    return True


async def async_unload_entry(hass, entry: ConfigEntry):
    """Unload a config entry."""
    ws_link = hass.data[DOMAIN].pop(entry.entry_id)
    await ws_link.stop_forever()
    return True


class SmartMouseConnection:
    """Persistent WebSocket connection to the ESP32 mouse server."""

    def __init__(self, host, port, password="", entry=None):
        self.uri = f"ws://{host}:{port}"
        self.ws = None
        self.connected = asyncio.Event()
        self.password = password
        self.temperature = None
        self.rssi = None
        self.power_saving = None
        self.pc_status_raw = None
        self.pc_power_supported = False
        self.using_ethernet = False
        self.entry = entry
        self._listeners = []
        self._run_task = None # To hold the asyncio task for run_forever

    async def run_forever(self):
        """Maintain a persistent connection and reconnect on failure."""
        while True:
            try:
                _LOGGER.info("Connecting to SmartMouse at %s", self.uri)
                # Enable pings so abrupt disconnects (e.g. power loss) are detected quickly
                async with websockets.connect(self.uri, ping_interval=15, ping_timeout=15) as ws:
                    self.ws = ws
                    self.connected.set()
                    self._notify_listeners()
                    self._run_task = asyncio.current_task() # Store the current task
                    
                    # Auth Handshake: Always send password as the first message.
                    pwd_to_send = self.password or ""
                    auth_packet = struct.pack("<B", 0xFF) + pwd_to_send.encode('utf-8') + b'\x00'
                    await ws.send(auth_packet)
                    
                    _LOGGER.info("Connected to SmartMouse.")
                    async for message in ws:
                        if isinstance(message, bytes) and len(message) == 9 and message[0] == 0xF0:
                            # Skip Opcode (x) | Float (f) | Int8 (b) | PowerSave (b) | PC Stat (b) | Cap (b)
                            temp, rssi, pwr_save, pc_stat, cap = struct.unpack("<xfbbbb", message)
                            self.temperature = round(temp, 1)
                            self.rssi = rssi
                            self.power_saving = bool(pwr_save)
                            self.pc_status_raw = pc_stat
                            self.pc_power_supported = bool(cap & 0x01)
                            self.using_ethernet = bool(cap & 0x02)
                            self._notify_listeners()
                        
            except Exception as err:
                self.connected.clear()
                self._notify_listeners()
                _LOGGER.warning("SmartMouse disconnected: %s", err)
                if self._run_task and self._run_task.done(): # Check if the task was cancelled
                    break # Exit loop if the task was intentionally cancelled (e.g., during unload)
                await asyncio.sleep(5) # Increased delay for reconnection attempts

    async def stop_forever(self):
        """Stop the persistent connection task."""
        if self._run_task:
            self._run_task.cancel() # Request the task to cancel
            await asyncio.gather(self._run_task, return_exceptions=True) # Wait for it to finish cancelling
        if self.ws: # Ensure WebSocket is closed if it's still open
            await self.ws.close()

    async def send(self, data, binary=False):
        """Send bytes (binary) or text to ESP."""
        if not self.connected.is_set():
            _LOGGER.warning("SmartMouse not connected; packet dropped.")
            return
        try:
            # websockets automatically detects bytes → binary
            await asyncio.wait_for(self.ws.send(data), timeout=5.0)
        except Exception as err:
            _LOGGER.warning("Send failed: %s", err)

    def add_listener(self, callback):
        """Add a callback to be notified of connection state changes."""
        self._listeners.append(callback)

    def _notify_listeners(self):
        for callback in self._listeners:
            callback()