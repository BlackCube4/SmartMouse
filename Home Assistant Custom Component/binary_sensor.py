"""Binary sensor platform for SmartMouse connection status."""
from homeassistant.components.binary_sensor import BinarySensorEntity, BinarySensorDeviceClass
from homeassistant.helpers.entity import DeviceInfo
from .const import DOMAIN

async def async_setup_entry(hass, entry, async_add_entities):
    """Set up the binary sensor platform."""
    ws_link = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        SmartMousePowerSensor(ws_link, entry)
    ], True)

class SmartMousePowerSensor(BinarySensorEntity):
    """Representation of the SmartMouse high power state."""

    def __init__(self, ws_link, entry):
        self._ws_link = ws_link
        self._entry = entry
        self._attr_name = f"{entry.title} High Power"
        self._attr_unique_id = f"{entry.entry_id}_high_power"

    @property
    def available(self) -> bool:
        """Return True if entity is available (connected)."""
        return self._ws_link.connected.is_set()

    @property
    def is_on(self):
        """Return true if high power mode is active."""
        return self._ws_link.power_saving is False

    @property
    def icon(self):
        """Return the icon to use in the frontend."""
        return "mdi:flash" if self.is_on else "mdi:leaf"

    @property
    def device_info(self) -> DeviceInfo:
        """Return device information."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.unique_id or self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="BlackCube",
            model="SmartMouse",
        )

    async def async_added_to_hass(self):
        """Register callbacks when entity is added."""
        self._ws_link.add_listener(self.async_write_ha_state)

    async def async_will_remove_from_hass(self):
        """Unregister callbacks (optional but good practice)."""
        # Since we use a simple list, we'd need a remove_listener method 
        # if we wanted to be perfectly clean, but for a single entity 
        # tied to the lifecycle of the integration, this is generally fine.
        pass