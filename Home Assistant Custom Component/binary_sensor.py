"""Binary sensor platform for ESP Mouse connection status."""
from homeassistant.components.binary_sensor import BinarySensorEntity, BinarySensorDeviceClass
from homeassistant.helpers.entity import DeviceInfo
from .const import DOMAIN

async def async_setup_entry(hass, entry, async_add_entities):
    """Set up the binary sensor platform."""
    ws_link = hass.data[DOMAIN]
    async_add_entities([
        ESPMouseBinarySensor(ws_link, entry),
        ESPMousePowerSensor(ws_link, entry)
    ], True)

class ESPMouseBinarySensor(BinarySensorEntity):
    """Representation of the ESP Mouse connection status."""

    def __init__(self, ws_link, entry):
        self._ws_link = ws_link
        self._entry = entry
        self._attr_name = f"{entry.title} Status"
        self._attr_unique_id = f"{entry.entry_id}_status"
        self._attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    @property
    def is_on(self):
        """Return true if the binary sensor is on (connected)."""
        return self._ws_link.connected.is_set()

    @property
    def device_info(self) -> DeviceInfo:
        """Return device information to link this entity to the device."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.unique_id or self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="Vinc",
            model="ESP32-S3 Super Mini",
            sw_version="1.0.0",
        )

    async def async_added_to_hass(self):
        """Register callbacks when entity is added."""
        self._ws_link.add_listener(self.async_write_ha_state)

class ESPMousePowerSensor(BinarySensorEntity):
    """Representation of the ESP Mouse power saving state."""

    def __init__(self, ws_link, entry):
        self._ws_link = ws_link
        self._entry = entry
        self._attr_name = f"{entry.title} Power Saving"
        self._attr_unique_id = f"{entry.entry_id}_power_save"
        self._attr_device_class = BinarySensorDeviceClass.POWER

    @property
    def is_on(self):
        """Return true if power saving is active."""
        return self._ws_link.power_saving

    @property
    def device_info(self) -> DeviceInfo:
        """Return device information."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.unique_id or self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="Vinc",
            model="ESP32-S3 Super Mini",
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