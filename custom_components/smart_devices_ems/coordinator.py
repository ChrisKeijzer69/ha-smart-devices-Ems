"""Eén verzoek per 30 s, gedeeld door alle sensoren."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import NietBereikbaar, SleutelOngeldig, haal_status
from .const import CONF_ADRES, CONF_SLEUTEL, DOMAIN, SCAN_INTERVAL

_LOGGER = logging.getLogger(__name__)


class EmsCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN, update_interval=SCAN_INTERVAL, config_entry=entry)
        self._sessie = async_get_clientsession(hass)
        self._adres = entry.data[CONF_ADRES]
        self._sleutel = entry.data[CONF_SLEUTEL]

    async def _async_update_data(self) -> dict[str, Any]:
        try:
            return await haal_status(self._sessie, self._adres, self._sleutel)
        except SleutelOngeldig as e:
            raise ConfigEntryAuthFailed("Sleutel ingetrokken of ongeldig") from e
        except NietBereikbaar as e:
            raise UpdateFailed(f"Portal niet bereikbaar: {e}") from e
