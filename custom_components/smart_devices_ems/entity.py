"""Gemeenschappelijke basis: één apparaat per installatie."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import EmsCoordinator


class EmsEntity(CoordinatorEntity[EmsCoordinator]):
    _attr_has_entity_name = True

    def __init__(self, coordinator: EmsCoordinator, key: str) -> None:
        super().__init__(coordinator)
        basis = coordinator.config_entry.unique_id or coordinator.config_entry.entry_id
        self._attr_unique_id = f"{basis}_{key}"
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, basis)},
            name=(coordinator.data or {}).get("naam") or "Smart Devices EMS",
            manufacturer="Smart Devices",
            model="EMS",
            configuration_url="https://portal.ems.smart-devices.online",
        )
