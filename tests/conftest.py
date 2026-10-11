from unittest.mock import patch

import pytest

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.fixture(autouse=True)
def zonder_dashboard(request, hass):
    """Het HA-dashboard (hass_frontend) zit niet in de testomgeving: frontend en http
    gelden als opgestart en het aanmelden van de kaart wordt apart getest."""
    hass.config.components.update({"frontend", "http"})
    if request.node.get_closest_marker("echte_kaart"):
        yield
        return
    with patch("custom_components.smart_devices_ems._registreer_kaart"):
        yield
