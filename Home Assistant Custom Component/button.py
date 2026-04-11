"""Button platform for ESP Mouse."""
import struct
from homeassistant.components.button import ButtonEntity, ButtonDeviceClass
from homeassistant.helpers.entity import DeviceInfo
from .const import DOMAIN

async def async_setup_entry(hass, entry, async_add_entities):
    """Set up the button platform."""
    ws_link = hass.data[DOMAIN]
    async_add_entities([ESPMouseResetButton(ws_link, entry)], True)

class ESPMouseResetButton(ButtonEntity):
    """Button to reset the ESP32 device."""

    def __init__(self, ws_link, entry):
        self._ws_link = ws_link
        self._entry = entry
        
        # Use a standard name that fits your naming convention
        self._attr_name = f"{entry.title} Restart"
        self._attr_unique_id = f"{entry.entry_id}_restart"
        
        # This tells HA it's a restart button (changes the icon automatically)
        self._attr_device_class = ButtonDeviceClass.RESTART

    @property
    def device_info(self) -> DeviceInfo:
        """Return device information - MUST match sensor.py exactly."""
        return DeviceInfo(
            # This line is the 'glue' that puts it on the same device page
            identifiers={(DOMAIN, self._entry.unique_id or self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="Vinc",
            model="ESP32-S3 Super Mini",
        )

    async def async_press(self) -> None:
        """Handle the button press."""
        # Send Opcode 0xFE (as we discussed for the firmware side)
        packet = struct.pack("<B", 0xFE)
        await self._ws_link.send(packet, binary=True)