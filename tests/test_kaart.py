"""De dashboardkaart wordt één keer aangemeld, met versie in de URL."""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.smart_devices_ems import _registreer_kaart
from custom_components.smart_devices_ems.const import KAART_URL, VERSIE

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.echte_kaart
async def test_kaart_een_keer_aangemeld(hass):
    hass.http = MagicMock(async_register_static_paths=AsyncMock())
    with patch("custom_components.smart_devices_ems.add_extra_js_url") as js:
        await _registreer_kaart(hass)
        await _registreer_kaart(hass)
    js.assert_called_once_with(hass, f"{KAART_URL}?v={VERSIE}")
    (cfg,), = hass.http.async_register_static_paths.call_args.args
    assert cfg.url_path == KAART_URL and Path(cfg.path).is_file()


def test_versie_gelijk_aan_manifest():
    import json
    m = json.loads((ROOT / "custom_components/smart_devices_ems/manifest.json").read_text())
    assert m["version"] == VERSIE


def test_kaart_is_ascii():
    # HA levert het bestand zonder charset; met niet-ASCII-tekens kan een browser
    # het als Latin-1 lezen (gezien op een iPad, 11 okt 2026).
    (ROOT / "custom_components/smart_devices_ems/www/smart-devices-ems-huis.js").read_bytes().decode("ascii")
