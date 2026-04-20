"""Button platform for KeyMouse."""
import struct
from homeassistant.components.button import ButtonEntity, ButtonDeviceClass
from homeassistant.helpers.entity import DeviceInfo
from .const import DOMAIN

async def async_setup_entry(hass, entry, async_add_entities):
    """Set up the button platform."""
    ws_link = hass.data[DOMAIN]
    entities = [KeyMouseResetButton(ws_link, entry)]
    
    # Create PC Power entities if enabled in config or supported by hardware telemetry
    pc_power_enabled = entry.data.get("PC Power Control", False)
    
    if pc_power_enabled or ws_link.pc_power_supported:
        entities.extend([
            KeyMousePCPowerButton(ws_link, entry, "PC Power Toggle", 0x01, "mdi:power"),
            KeyMousePCPowerButton(ws_link, entry, "PC Hard Power Off", 0x02, "mdi:alert-circle-outline"),
            KeyMousePCPowerButton(ws_link, entry, "PC Power On", 0x03, "mdi:power-on"),
            KeyMousePCPowerButton(ws_link, entry, "PC Power Off", 0x04, "mdi:power-off"),
        ])
    async_add_entities(entities, True)

class KeyMouseResetButton(ButtonEntity):
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
            manufacturer="BlackCube",
            model="KeyMouse",
        )
        
    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return self._ws_link.connected.is_set()

    async def async_added_to_hass(self):
        """Register callbacks when entity is added."""
        self._ws_link.add_listener(self.async_write_ha_state)

    async def async_press(self) -> None:
        """Handle the button press."""
        # Send Opcode 0xFE (as we discussed for the firmware side)
        packet = struct.pack("<B", 0xFE)
        await self._ws_link.send(packet, binary=True)

class KeyMousePCPowerButton(ButtonEntity):
    """Button to control PC power states."""

    def __init__(self, ws_link, entry, name, cmd_id, icon):
        self._ws_link = ws_link
        self._entry = entry
        self._cmd_id = cmd_id
        self._attr_name = f"{entry.title} {name}"
        self._attr_unique_id = f"{entry.entry_id}_pc_{cmd_id}"
        self._attr_icon = icon

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.unique_id or self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="BlackCube",
            model="KeyMouse",
        )

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return self._ws_link.connected.is_set()

    async def async_added_to_hass(self):
        """Register callbacks when entity is added."""
        self._ws_link.add_listener(self.async_write_ha_state)

    async def async_press(self) -> None:
        """Handle the button press."""
        # Send Opcode 0xA0 (OPCODE_PC_CONTROL)
        packet = struct.pack("<BB", 0xA0, self._cmd_id)
        await self._ws_link.send(packet, binary=True)