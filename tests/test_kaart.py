"""De dashboardkaart: aangemeld als dashboardbron, met terugval op een extra module."""

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.components.lovelace.resources import ResourceStorageCollection

from custom_components.smart_devices_ems import _registreer_kaart
from custom_components.smart_devices_ems.const import KAART_URL, VERSIE

ROOT = Path(__file__).resolve().parents[1]
URL = f"{KAART_URL}?v={VERSIE}"


async def _bronnen(hass, items=()):
    ll_config = MagicMock(async_load=AsyncMock(return_value={}))
    res = ResourceStorageCollection(hass, ll_config)
    await res.async_get_info()
    for url in items:
        await res.async_create_item({"res_type": "module", "url": url})
    return res


def _http(hass):
    hass.http = MagicMock(async_register_static_paths=AsyncMock())


@pytest.mark.echte_kaart
@pytest.mark.parametrize("vorm", ["dict", "dataclass"])     # tot HA 2025.x een dict, daarna een dataclass
async def test_nieuwe_bron(hass, vorm):
    _http(hass)
    res = await _bronnen(hass)
    hass.data["lovelace"] = {"resources": res} if vorm == "dict" else SimpleNamespace(resources=res)
    with patch("custom_components.smart_devices_ems.add_extra_js_url") as js:
        await _registreer_kaart(hass)
        await _registreer_kaart(hass)
    js.assert_not_called()
    assert [(b["type"], b["url"]) for b in res.async_items()] == [("module", URL)]
    (cfg,), = hass.http.async_register_static_paths.call_args.args
    assert cfg.url_path == KAART_URL and Path(cfg.path).is_file()


@pytest.mark.echte_kaart
async def test_handmatige_bron_overgenomen_en_dubbel_opgeruimd(hass):
    _http(hass)
    res = await _bronnen(hass, ["/andere/kaart.js", KAART_URL, KAART_URL + "?v=0.1"])
    hass.data["lovelace"] = {"resources": res}
    with patch("custom_components.smart_devices_ems.add_extra_js_url"):
        await _registreer_kaart(hass)
    assert sorted(b["url"] for b in res.async_items()) == ["/andere/kaart.js", URL]


@pytest.mark.echte_kaart
async def test_zonder_bronnenlijst_extra_module(hass):
    _http(hass)                                   # geen lovelace of YAML-modus
    hass.data["lovelace"] = {"resources": SimpleNamespace(async_items=lambda: [])}
    with patch("custom_components.smart_devices_ems.add_extra_js_url") as js:
        await _registreer_kaart(hass)
    js.assert_called_once_with(hass, URL)


def test_versie_gelijk_aan_manifest():
    m = json.loads((ROOT / "custom_components/smart_devices_ems/manifest.json").read_text())
    assert m["version"] == VERSIE


def test_kaart_is_ascii():
    # HA levert het bestand zonder charset; met niet-ASCII-tekens kan een browser
    # het als Latin-1 lezen (gezien op een iPad, 11 okt 2026).
    (ROOT / "custom_components/smart_devices_ems/www/smart-devices-ems-huis.js").read_bytes().decode("ascii")
