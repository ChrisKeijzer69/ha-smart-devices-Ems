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
    entiteiten = [Verouderd(c), SturingAan(c)]
    # Boiler (16 okt 2026): alleen als er een boiler is, zoals de boilersensoren.
    if ((c.data or {}).get("boiler") or {}).get("aanwezig"):
        entiteiten += [BoilerInHuis(c), BoilerUitMaarAan(c)]
    async_add_entities(entiteiten)


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


class BoilerInHuis(EmsEntity, BinarySensorEntity):
    """Aan = de boiler hoort in het huisje: hij wordt gestuurd, of trekt toch stroom.
    Uit bij stand "uit" (zelfde regel als de portal en de schermen)."""

    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, c) -> None:
        super().__init__(c, "boiler_in_huis")

    @property
    def is_on(self) -> bool | None:
        b = (self.coordinator.data or {}).get("boiler") or {}
        return b.get("in_huis", b.get("aanwezig"))


class BoilerUitMaarAan(EmsEntity, BinarySensorEntity):
    """Aan = de boiler staat op "uit" maar gebruikt toch stroom (met de hand aangezet?)."""

    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, c) -> None:
        super().__init__(c, "boiler_uit_maar_aan")

    @property
    def is_on(self) -> bool | None:
        return ((self.coordinator.data or {}).get("boiler") or {}).get("uit_maar_aan")
