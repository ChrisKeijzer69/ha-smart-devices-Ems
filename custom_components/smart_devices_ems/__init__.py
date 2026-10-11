"""Smart Devices EMS: sensoren uit de EMS-portal (alleen lezen), plus de kaart "Nu in huis"."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import DOMAIN, KAART_BESTAND, KAART_URL, VERSIE
from .coordinator import EmsCoordinator

PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR]

type EmsConfigEntry = ConfigEntry[EmsCoordinator]


async def _registreer_kaart(hass: HomeAssistant) -> None:
    """Zet de dashboardkaart klaar, één keer per HA-start. Met ?v= zodat een nieuwe
    versie niet uit de browsercache blijft komen."""
    if hass.data.get(f"{DOMAIN}_kaart"):
        return
    hass.data[f"{DOMAIN}_kaart"] = True
    pad = Path(__file__).parent / "www" / KAART_BESTAND
    await hass.http.async_register_static_paths([StaticPathConfig(KAART_URL, str(pad), True)])
    add_extra_js_url(hass, f"{KAART_URL}?v={VERSIE}")


async def async_setup_entry(hass: HomeAssistant, entry: EmsConfigEntry) -> bool:
    await _registreer_kaart(hass)
    coordinator = EmsCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: EmsConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
