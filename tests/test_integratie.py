"""Instelscherm, sensoren en een ingetrokken sleutel. De testomgeving draait in het Engels,
dus de entity-id's hieronder zijn de Engelse namen."""

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smart_devices_ems.const import DOMAIN, STANDAARD_ADRES

URL = STANDAARD_ADRES + "/api/apparaat/status"
STATUS = {
    "versie": 1, "klant_id": "Fam_Test", "naam": "Fam Test", "tijd": "2026-10-11T15:34:12+02:00",
    "data_leeftijd_s": 46, "verouderd": False, "sturing_aan": True,
    "vermogen_w": {"zon": 2310, "net": -9, "accu": 1748, "huis": 270, "auto": 0, "boiler": None},
    "accu": {"stand_pct": 98.0},
    "auto": {"aanwezig": True, "status": "vol", "stand_pct": 89.6, "geschat": False},
    "boiler": {"aanwezig": False, "temp_c": None},
    "prijs_eur_kwh": {"nu": 0.2194, "terug_nu": 0.1886, "over_een_uur": 0.2728, "laagst_vandaag": 0.144,
                      "laagst_vandaag_om": "2026-10-11T13:30+02:00", "hoogst_vandaag": 0.4213,
                      "hoogst_vandaag_om": "2026-10-11T19:45+02:00"},
    "ai": {"nu": {"code": "laad_zon", "actie": "zon", "tekst": "Accu laadt met zonnestroom",
                  "vanaf": "2026-10-11T15:30+02:00"},
           "straks": {"code": "wacht_vol", "actie": "wacht", "tekst": "Accu is vol",
                      "vanaf": "2026-10-11T16:15+02:00"}},
    "vandaag_kwh": {"zon": 10.11, "net_afname": 37.64, "net_terug": 0.91, "accu_in": 38.0, "accu_uit": 1.73,
                    "huis": 10.57, "auto": 0.0, "boiler": None},
    "besparing_vandaag_eur": 2.36,
}


async def test_instellen_gelukt(hass, aioclient_mock):
    aioclient_mock.get(URL, json=STATUS)
    r = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert r["type"] is FlowResultType.FORM
    r = await hass.config_entries.flow.async_configure(r["flow_id"], {"sleutel": " ems_abc ", "adres": STANDAARD_ADRES + "/"})
    assert r["type"] is FlowResultType.CREATE_ENTRY
    assert r["title"] == "Fam Test"
    assert r["data"] == {"sleutel": "ems_abc", "adres": STANDAARD_ADRES}
    assert aioclient_mock.mock_calls[0][3]["Authorization"] == "Bearer ems_abc"
    await hass.async_block_till_done()

    s = hass.states
    assert s.get("sensor.fam_test_solar_power").state == "2310"
    assert s.get("sensor.fam_test_battery").state == "98.0"
    assert s.get("sensor.fam_test_electricity_price").state == "0.2194"
    assert s.get("sensor.fam_test_ai_now").state == "Accu laadt met zonnestroom"
    assert s.get("sensor.fam_test_ai_action").state == "zon"
    assert s.get("sensor.fam_test_charger").state == "vol"
    assert s.get("sensor.fam_test_grid_import_today").attributes["state_class"] == "total_increasing"
    assert s.get("sensor.fam_test_ai_next_at").state.startswith("2026-10-11T14:15")
    assert s.get("binary_sensor.fam_test_smart_control").state == "on"
    # Geen boiler: geen boilersensoren.
    assert s.get("sensor.fam_test_boiler_temperature") is None

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()


async def test_foute_sleutel_en_onbereikbaar(hass, aioclient_mock):
    aioclient_mock.get(URL, status=401)
    r = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    r = await hass.config_entries.flow.async_configure(r["flow_id"], {"sleutel": "ems_x", "adres": STANDAARD_ADRES})
    assert r["errors"] == {"base": "sleutel_ongeldig"}
    aioclient_mock.clear_requests()
    aioclient_mock.get(URL, status=502)
    r = await hass.config_entries.flow.async_configure(r["flow_id"], {"sleutel": "ems_x", "adres": STANDAARD_ADRES})
    assert r["errors"] == {"base": "niet_bereikbaar"}


async def test_dubbel_koppelen_geweigerd(hass, aioclient_mock):
    MockConfigEntry(domain=DOMAIN, unique_id="Fam_Test", data={"sleutel": "a", "adres": STANDAARD_ADRES}).add_to_hass(hass)
    aioclient_mock.get(URL, json=STATUS)
    r = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    r = await hass.config_entries.flow.async_configure(r["flow_id"], {"sleutel": "ems_b", "adres": STANDAARD_ADRES})
    assert r["type"] is FlowResultType.ABORT and r["reason"] == "already_configured"


async def test_ingetrokken_sleutel_vraagt_nieuwe(hass, aioclient_mock):
    entry = MockConfigEntry(domain=DOMAIN, unique_id="Fam_Test", data={"sleutel": "ems_oud", "adres": STANDAARD_ADRES})
    entry.add_to_hass(hass)
    aioclient_mock.get(URL, status=401)
    assert not await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    flows = hass.config_entries.flow.async_progress()
    assert len(flows) == 1 and flows[0]["context"]["source"] == "reauth"

    aioclient_mock.clear_requests()
    aioclient_mock.get(URL, json=STATUS)
    r = await hass.config_entries.flow.async_configure(flows[0]["flow_id"], {"sleutel": "ems_nieuw"})
    assert r["type"] is FlowResultType.ABORT and r["reason"] == "reauth_successful"
    assert entry.data["sleutel"] == "ems_nieuw"
    await hass.async_block_till_done()
    assert await hass.config_entries.async_unload(entry.entry_id)
