"""Sensor platform for SmartMouse."""
from homeassistant.components.sensor import SensorEntity, SensorDeviceClass, SensorStateClass
from homeassistant.const import UnitOfTemperature, SIGNAL_STRENGTH_DECIBELS_MILLIWATT
from homeassistant.helpers.entity import DeviceInfo
from .const import DOMAIN

async def async_setup_entry(hass, entry, async_add_entities):
    """Set up the sensor platform."""
    ws_link = hass.data[DOMAIN][entry.entry_id]
    entities = [
        SmartMouseTempSensor(ws_link, entry),
        SmartMouseRSSISensor(ws_link, entry),
        SmartMouseConnectionTypeSensor(ws_link, entry)
    ]
    
    pc_power_enabled = entry.data.get("PC Power Control", False)
    if pc_power_enabled or ws_link.pc_power_supported:
        entities.append(SmartMousePCPowerStateSensor(ws_link, entry))
        
    async_add_entities(entities, True)

class SmartMouseBaseSensor(SensorEntity):
    """Base sensor class for shared device info."""
    def __init__(self, ws_link, entry):
        self._ws_link = ws_link
        self._entry = entry

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.unique_id or self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="BlackCube",
            model="SmartMouse",
        )

    @property
    def available(self) -> bool:
        """Return True if entity is available (connected)."""
        return self._ws_link.connected.is_set()

    async def async_added_to_hass(self):
        self._ws_link.add_listener(self.async_write_ha_state)

class SmartMouseTempSensor(SmartMouseBaseSensor):
    """Internal temperature of the ESP32."""
    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, ws_link, entry):
        super().__init__(ws_link, entry)
        self._attr_name = f"{entry.title} Internal Temperature"
        self._attr_unique_id = f"{entry.entry_id}_temp"

    @property
    def native_value(self):
        return self._ws_link.temperature

class SmartMouseRSSISensor(SmartMouseBaseSensor):
    """WiFi Signal Strength."""
    _attr_device_class = SensorDeviceClass.SIGNAL_STRENGTH
    _attr_native_unit_of_measurement = SIGNAL_STRENGTH_DECIBELS_MILLIWATT
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, ws_link, entry):
        super().__init__(ws_link, entry)
        self._attr_name = f"{entry.title} WiFi RSSI"
        self._attr_unique_id = f"{entry.entry_id}_rssi"

    @property
    def native_value(self):
        return self._ws_link.rssi

class SmartMouseConnectionTypeSensor(SmartMouseBaseSensor):
    """Whether the device is currently reachable via WiFi or Ethernet."""
    _attr_icon = "mdi:lan-connect"

    def __init__(self, ws_link, entry):
        super().__init__(ws_link, entry)
        self._attr_name = f"{entry.title} Connection Type"
        self._attr_unique_id = f"{entry.entry_id}_connection_type"

    @property
    def native_value(self):
        return "Ethernet" if self._ws_link.using_ethernet else "WiFi"

class SmartMousePCPowerStateSensor(SmartMouseBaseSensor):
    """Power state derived from duty cycle."""

    def __init__(self, ws_link, entry):
        super().__init__(ws_link, entry)
        self._attr_name = f"{entry.title} PC Power State"
        self._attr_unique_id = f"{entry.entry_id}_pc_state"

    @property
    def native_value(self):
        state_raw = self._ws_link.pc_status_raw
        if state_raw == 0:
            return "Off"
        elif state_raw == 1:
            return "On"
        elif state_raw == 2:
            return "Energy Saving"
        return "Unknown"

    @property
    def icon(self):
        state = self.native_value
        if state == "On":
            return "mdi:power-on"
        elif state == "Off":
            return "mdi:power-off"
        elif state == "Energy Saving":
            return "mdi:power-sleep"
        return "mdi:power-plug-outline"