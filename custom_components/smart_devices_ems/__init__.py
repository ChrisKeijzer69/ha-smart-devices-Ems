"""Smart Devices EMS: sensoren uit de EMS-portal (alleen lezen), plus de kaart "Nu in huis"."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import DOMAIN, KAART_BESTAND, KAART_URL, VERSIE
from .coordinator import EmsCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR]

type EmsConfigEntry = ConfigEntry[EmsCoordinator]


async def _registreer_kaart(hass: HomeAssistant) -> None:
    """Zet de dashboardkaart klaar, één keer per HA-start.

    Als dashboardbron (Instellingen → Dashboards → Bronnen) en bewust niet alleen via
    add_extra_js_url: die zet de kaart in index.html, maar de service worker van de
    HA-frontend serveert die pagina stale-while-revalidate, dus na een installatie of
    update laadt de eerste keer de oude pagina zonder kaart ("Custom element doesn't
    exist", gezien op HA 2026.10.1, 11 okt 2026). Een bron laadt het dashboard zelf.
    Alleen bij dashboards in YAML-modus valt hij terug op add_extra_js_url.
    """
    if hass.data.get(f"{DOMAIN}_kaart"):
        return
    hass.data[f"{DOMAIN}_kaart"] = True
    pad = Path(__file__).parent / "www" / KAART_BESTAND
    await hass.http.async_register_static_paths([StaticPathConfig(KAART_URL, str(pad), True)])
    url = f"{KAART_URL}?v={VERSIE}"
    try:
        if await _als_dashboardbron(hass, url):
            return
    except Exception:  # noqa: BLE001 — de bron is een gemak, de sensoren moeten altijd werken
        _LOGGER.exception("Kaart niet als dashboardbron toegevoegd; terugval op extra module")
    add_extra_js_url(hass, url)


def _bronnen(hass: HomeAssistant):
    """De bronnenlijst van de dashboards, of None in YAML-modus. Tot HA 2025.x een
    dict onder hass.data["lovelace"], daarna een dataclass."""
    ll = hass.data.get("lovelace")
    if ll is None:
        return None
    res = ll.get("resources") if isinstance(ll, dict) else getattr(ll, "resources", None)
    return res if hasattr(res, "async_create_item") else None


async def _als_dashboardbron(hass: HomeAssistant, url: str) -> bool:
    """Voegt de kaart toe als bron, of zet een bestaande (ook een met de hand
    toegevoegde) op de huidige versie. False als dat niet kan (YAML-modus)."""
    res = _bronnen(hass)
    if res is None:
        return False
    await res.async_get_info()                 # laadt de lijst als dat nog niet gebeurd is
    eigen = [b for b in res.async_items() if str(b.get("url", "")).split("?")[0] == KAART_URL]
    if not eigen:
        await res.async_create_item({"res_type": "module", "url": url})
        _LOGGER.info("Kaart toegevoegd als dashboardbron: %s", url)
        return True
    for b in eigen[1:]:                         # dubbel, bv. met de hand én automatisch
        await res.async_delete_item(b["id"])
    if eigen[0].get("url") != url or eigen[0].get("type") != "module":
        await res.async_update_item(eigen[0]["id"], {"res_type": "module", "url": url})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: EmsConfigEntry) -> bool:
    await _registreer_kaart(hass)
    coordinator = EmsCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: EmsConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
