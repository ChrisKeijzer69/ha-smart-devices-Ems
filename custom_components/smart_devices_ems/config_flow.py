"""Instellen: sleutel (en adres) invullen, met een proefverzoek."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import NietBereikbaar, SleutelOngeldig, haal_status
from .const import CONF_ADRES, CONF_SLEUTEL, DOMAIN, STANDAARD_ADRES


class EmsConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def _probeer(self, adres: str, sleutel: str) -> tuple[dict | None, str | None]:
        try:
            return await haal_status(async_get_clientsession(self.hass), adres, sleutel), None
        except SleutelOngeldig:
            return None, "sleutel_ongeldig"
        except NietBereikbaar:
            return None, "niet_bereikbaar"

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        fouten: dict[str, str] = {}
        if user_input is not None:
            sleutel = user_input[CONF_SLEUTEL].strip()
            adres = user_input[CONF_ADRES].strip().rstrip("/")
            status, fout = await self._probeer(adres, sleutel)
            if fout:
                fouten["base"] = fout
            else:
                await self.async_set_unique_id(status.get("klant_id") or status.get("naam"))
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=status.get("naam") or "Smart Devices EMS",
                    data={CONF_SLEUTEL: sleutel, CONF_ADRES: adres},
                )
        schema = vol.Schema({
            vol.Required(CONF_SLEUTEL): str,
            vol.Required(CONF_ADRES, default=STANDAARD_ADRES): str,
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=fouten)

    async def async_step_reauth(self, entry_data: Mapping[str, Any]) -> ConfigFlowResult:
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Sleutel ingetrokken: een nieuwe uit de portal invullen."""
        fouten: dict[str, str] = {}
        entry = self._get_reauth_entry()
        if user_input is not None:
            sleutel = user_input[CONF_SLEUTEL].strip()
            status, fout = await self._probeer(entry.data[CONF_ADRES], sleutel)
            if fout:
                fouten["base"] = fout
            else:
                await self.async_set_unique_id(status.get("klant_id") or status.get("naam"))
                self._abort_if_unique_id_mismatch(reason="andere_installatie")
                return self.async_update_reload_and_abort(entry, data_updates={CONF_SLEUTEL: sleutel})
        return self.async_show_form(
            step_id="reauth_confirm", data_schema=vol.Schema({vol.Required(CONF_SLEUTEL): str}), errors=fouten)
