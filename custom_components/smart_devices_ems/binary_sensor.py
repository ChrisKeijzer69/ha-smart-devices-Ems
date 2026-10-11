"""Aan/uit-sensoren: verouderde gegevens en sturing."""

from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import EmsConfigEntry
from .entity import EmsEntity


async def async_setup_entry(hass: HomeAssistant, entry: EmsConfigEntry,
                            async_add_entities: AddEntitiesCallback) -> None:
    c = entry.runtime_data
    async_add_entities([Verouderd(c), SturingAan(c)])


class Verouderd(EmsEntity, BinarySensorEntity):
    """Aan = de installatie heeft al meer dan een kwartier niets doorgegeven."""

    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, c) -> None:
        super().__init__(c, "verouderd")

    @property
    def is_on(self) -> bool | None:
        return (self.coordinator.data or {}).get("verouderd")


class SturingAan(EmsEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.RUNNING

    def __init__(self, c) -> None:
        super().__init__(c, "sturing_aan")

    @property
    def is_on(self) -> bool | None:
        return (self.coordinator.data or {}).get("sturing_aan")
