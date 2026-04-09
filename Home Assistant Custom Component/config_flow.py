"""Config flow for ESP Mouse integration."""
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.helpers import selector

from .const import DOMAIN


class ESP32MouseConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for ESP Mouse."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}
        if user_input is not None:
            # Validate user input
            try:
                # Ensure port is handled as an integer regardless of UI type
                user_input[CONF_PORT] = int(user_input[CONF_PORT])
            except (ValueError, TypeError):
                errors[CONF_PORT] = "invalid_port"

            if not errors:
                host = user_input[CONF_HOST]
                # Check if already configured to prevent duplicate entries
                await self.async_set_unique_id(host)
                self._abort_if_unique_id_configured()

                return self.async_create_entry(title=host, data=user_input)

        # Show form to the user
        # Using self.add_suggested_values_to_schema ensures that if there is an error,
        # the values the user typed are kept in the fields instead of resetting.
        data_schema = self.add_suggested_values_to_schema(
            vol.Schema({
                vol.Required(CONF_HOST): selector.TextSelector(
                    selector.TextSelectorConfig(type=selector.TextSelectorType.TEXT)
                ),
                vol.Required(CONF_PORT): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=1, max=65535, mode=selector.NumberSelectorMode.BOX)
                ),
            }),
            user_input or {CONF_HOST: "192.168.1.100", CONF_PORT: 81}
        )

        return self.async_show_form(
            step_id="user", data_schema=data_schema, errors=errors
        )

    async def async_step_reconfigure(self, user_input=None):
        """Handle reconfiguration of an existing entry."""
        # This step allows users to change host/port after initial setup
        # For simplicity, it reuses the user step logic.
        return await self.async_step_user(user_input)