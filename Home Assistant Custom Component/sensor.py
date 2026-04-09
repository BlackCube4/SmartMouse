"""Sensor platform for ESP Mouse telemetry."""
from homeassistant.components.sensor import SensorEntity, SensorDeviceClass, SensorStateClass
from homeassistant.const import UnitOfTemperature, SIGNAL_STRENGTH_DECIBELS_MILLIWATT
from homeassistant.helpers.entity import DeviceInfo
from .const import DOMAIN

async def async_setup_entry(hass, entry, async_add_entities):
    """Set up the sensor platform."""
    ws_link = hass.data[DOMAIN]
    async_add_entities([
        ESPMouseSensor(ws_link, entry, "Temperature", "temp"),
        ESPMouseSensor(ws_link, entry, "WiFi Signal", "rssi")
    ], True)

class ESPMouseSensor(SensorEntity):
    """Representation of ESP Mouse Telemetry sensors."""

    def __init__(self, ws_link, entry, name_suffix, sensor_type):
        self._ws_link = ws_link
        self._entry = entry
        self._type = sensor_type
        self._attr_name = f"{entry.title} {name_suffix}"
        self._attr_unique_id = f"{entry.entry_id}_{sensor_type}"
        
        if sensor_type == "temp":
            self._attr_device_class = SensorDeviceClass.TEMPERATURE
            self._attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
            self._attr_state_class = SensorStateClass.MEASUREMENT
        else:
            self._attr_device_class = SensorDeviceClass.SIGNAL_STRENGTH
            self._attr_native_unit_of_measurement = SIGNAL_STRENGTH_DECIBELS_MILLIWATT
            self._attr_state_class = SensorStateClass.MEASUREMENT

    @property
    def native_value(self):
        """Return the state of the sensor."""
        if self._type == "temp":
            return self._ws_link.temperature
        return self._ws_link.rssi

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
        """Register callbacks."""
        self._ws_link.add_listener(self.async_write_ha_state)