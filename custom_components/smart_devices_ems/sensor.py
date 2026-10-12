"""Sensoren uit /api/apparaat/status. De veldnamen daar zijn vast (versie 1)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import (
    PERCENTAGE,
    EntityCategory,
    UnitOfEnergy,
    UnitOfPower,
    UnitOfTemperature,
    UnitOfTime,
    UnitOfVolume,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import EmsConfigEntry
from .entity import EmsEntity

PRIJS = "EUR/kWh"
ACTIES = ["zon", "net", "levert", "wacht", "onderhoud"]
AUTO_STATUS = ["kabel_los", "aangesloten", "laadt", "vol", "wacht_op_zon", "wacht"]


def _pad(*sleutels: str) -> Callable[[dict], Any]:
    def lees(d: dict) -> Any:
        for k in sleutels:
            if not isinstance(d, dict):
                return None
            d = d.get(k)
        return d
    return lees


def _tijd(*sleutels: str) -> Callable[[dict], Any]:
    lees = _pad(*sleutels)

    def omzetten(d: dict) -> datetime | None:
        v = lees(d)
        return datetime.fromisoformat(v) if v else None
    return omzetten


@dataclass(frozen=True, kw_only=True)
class EmsSensorDescription(SensorEntityDescription):
    waarde: Callable[[dict], Any]
    # Alleen aanmaken als dit pad in de eerste meting waar is (auto, boiler).
    alleen_als: tuple[str, ...] | None = None


def _vermogen(key: str, veld: str, alleen_als=None) -> EmsSensorDescription:
    return EmsSensorDescription(
        key=key, waarde=_pad("vermogen_w", veld), native_unit_of_measurement=UnitOfPower.WATT,
        device_class=SensorDeviceClass.POWER, state_class=SensorStateClass.MEASUREMENT, alleen_als=alleen_als)


def _energie(key: str, veld: str, alleen_als=None, oplopend=True) -> EmsSensorDescription:
    # Tellers van vandaag: om middernacht terug naar 0, wat HA als nieuwe cyclus leest.
    return EmsSensorDescription(
        key=key, waarde=_pad("vandaag_kwh", veld), native_unit_of_measurement=UnitOfEnergy.KILO_WATT_HOUR,
        device_class=SensorDeviceClass.ENERGY,
        state_class=SensorStateClass.TOTAL_INCREASING if oplopend else None,
        suggested_display_precision=2, alleen_als=alleen_als)


def _prijs(key: str, veld: str) -> EmsSensorDescription:
    return EmsSensorDescription(
        key=key, waarde=_pad("prijs_eur_kwh", veld), native_unit_of_measurement=PRIJS,
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=4)


AUTO = ("auto", "aanwezig")
BOILER = ("boiler", "aanwezig")
GAS = ("gas", "aanwezig")
WATER = ("water", "aanwezig")


def _meter(key: str, groep: str, veld: str, eenheid: str, device_class, alleen_als) -> EmsSensorDescription:
    # Verbruik vandaag (HomeWizard-meters): om middernacht terug naar 0.
    return EmsSensorDescription(
        key=key, waarde=_pad(groep, veld), native_unit_of_measurement=eenheid, device_class=device_class,
        state_class=SensorStateClass.TOTAL_INCREASING, alleen_als=alleen_als)


def _gemiddeld(key: str, groep: str, veld: str, eenheid: str, alleen_als) -> EmsSensorDescription:
    # Gemiddelde dag over vier weken: geen teller, dus geen gas-/water-device_class
    # (die staat in HA alleen bij een teller).
    return EmsSensorDescription(
        key=key, waarde=_pad(groep, veld), native_unit_of_measurement=eenheid,
        state_class=SensorStateClass.MEASUREMENT, alleen_als=alleen_als)

SENSOREN: tuple[EmsSensorDescription, ...] = (
    _vermogen("vermogen_zon", "zon"),
    _vermogen("vermogen_net", "net"),
    _vermogen("vermogen_accu", "accu"),
    _vermogen("vermogen_huis", "huis"),
    _vermogen("vermogen_auto", "auto", AUTO),
    _vermogen("vermogen_boiler", "boiler", BOILER),
    EmsSensorDescription(
        key="accu_stand", waarde=_pad("accu", "stand_pct"), native_unit_of_measurement=PERCENTAGE,
        device_class=SensorDeviceClass.BATTERY, state_class=SensorStateClass.MEASUREMENT),
    EmsSensorDescription(
        key="auto_stand", waarde=_pad("auto", "stand_pct"), native_unit_of_measurement=PERCENTAGE,
        device_class=SensorDeviceClass.BATTERY, state_class=SensorStateClass.MEASUREMENT, alleen_als=AUTO),
    EmsSensorDescription(
        key="auto_status", waarde=_pad("auto", "status"), device_class=SensorDeviceClass.ENUM,
        options=AUTO_STATUS, alleen_als=AUTO),
    EmsSensorDescription(
        key="boiler_temperatuur", waarde=_pad("boiler", "temp_c"),
        native_unit_of_measurement=UnitOfTemperature.CELSIUS, device_class=SensorDeviceClass.TEMPERATURE,
        state_class=SensorStateClass.MEASUREMENT, alleen_als=BOILER),
    _prijs("prijs_nu", "nu"),
    _prijs("prijs_terug_nu", "terug_nu"),
    _prijs("prijs_over_een_uur", "over_een_uur"),
    _prijs("prijs_laagst_vandaag", "laagst_vandaag"),
    _prijs("prijs_hoogst_vandaag", "hoogst_vandaag"),
    EmsSensorDescription(key="prijs_laagst_vandaag_om", waarde=_tijd("prijs_eur_kwh", "laagst_vandaag_om"),
                         device_class=SensorDeviceClass.TIMESTAMP),
    EmsSensorDescription(key="prijs_hoogst_vandaag_om", waarde=_tijd("prijs_eur_kwh", "hoogst_vandaag_om"),
                         device_class=SensorDeviceClass.TIMESTAMP),
    EmsSensorDescription(key="ai_nu", waarde=_pad("ai", "nu", "tekst")),
    EmsSensorDescription(key="ai_nu_actie", waarde=_pad("ai", "nu", "actie"),
                         device_class=SensorDeviceClass.ENUM, options=ACTIES),
    EmsSensorDescription(key="ai_straks", waarde=_pad("ai", "straks", "tekst")),
    EmsSensorDescription(key="ai_straks_om", waarde=_tijd("ai", "straks", "vanaf"),
                         device_class=SensorDeviceClass.TIMESTAMP),
    _energie("vandaag_zon", "zon"),
    _energie("vandaag_net_afname", "net_afname"),
    _energie("vandaag_net_terug", "net_terug"),
    _energie("vandaag_accu_in", "accu_in"),
    _energie("vandaag_accu_uit", "accu_uit"),
    # Huis kan licht teruglopen als de auto- of boilerteller inloopt: geen oplopende teller.
    _energie("vandaag_huis", "huis", oplopend=False),
    _energie("vandaag_auto", "auto", AUTO),
    _energie("vandaag_boiler", "boiler", BOILER),
    EmsSensorDescription(
        key="besparing_vandaag", waarde=_pad("besparing_vandaag_eur"), native_unit_of_measurement="EUR",
        device_class=SensorDeviceClass.MONETARY, suggested_display_precision=2),
    _meter("gas_vandaag", "gas", "vandaag_m3", UnitOfVolume.CUBIC_METERS, SensorDeviceClass.GAS, GAS),
    _gemiddeld("gas_gemiddeld_dag", "gas", "gemiddeld_dag_m3", UnitOfVolume.CUBIC_METERS, GAS),
    _meter("water_vandaag", "water", "vandaag_l", UnitOfVolume.LITERS, SensorDeviceClass.WATER, WATER),
    _gemiddeld("water_gemiddeld_dag", "water", "gemiddeld_dag_l", UnitOfVolume.LITERS, WATER),
    EmsSensorDescription(
        key="data_leeftijd", waarde=_pad("data_leeftijd_s"), native_unit_of_measurement=UnitOfTime.SECONDS,
        device_class=SensorDeviceClass.DURATION, entity_category=EntityCategory.DIAGNOSTIC),
)


async def async_setup_entry(hass: HomeAssistant, entry: EmsConfigEntry,
                            async_add_entities: AddEntitiesCallback) -> None:
    coordinator = entry.runtime_data
    data = coordinator.data or {}
    async_add_entities(
        EmsSensor(coordinator, d) for d in SENSOREN
        if d.alleen_als is None or _pad(*d.alleen_als)(data)
    )


class EmsSensor(EmsEntity, SensorEntity):
    entity_description: EmsSensorDescription

    def __init__(self, coordinator, description: EmsSensorDescription) -> None:
        super().__init__(coordinator, description.key)
        self.entity_description = description

    @property
    def native_value(self) -> Any:
        return self.entity_description.waarde(self.coordinator.data or {})
