"""Smart Devices EMS: sensoren uit de EMS-portal (alleen lezen)."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .coordinator import EmsCoordinator

PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR]

type EmsConfigEntry = ConfigEntry[EmsCoordinator]


async def async_setup_entry(hass: HomeAssistant, entry: EmsConfigEntry) -> bool:
    coordinator = EmsCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: EmsConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
