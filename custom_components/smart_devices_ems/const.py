"""Constanten voor Smart Devices EMS."""

from datetime import timedelta

DOMAIN = "smart_devices_ems"

CONF_SLEUTEL = "sleutel"
CONF_ADRES = "adres"

STANDAARD_ADRES = "https://portal.ems.smart-devices.online"
STATUS_PAD = "/api/apparaat/status"

# De portal ververst per halve minuut; vaker vragen heeft geen zin.
SCAN_INTERVAL = timedelta(seconds=30)

VERSIE = "0.3.2"          # gelijk houden met manifest.json
# De dashboardkaarten in www/: het huis, en het scherm voor een Google Nest Hub
# (dat de huiskaart gebruikt voor zijn weergave "huis").
KAART_BESTANDEN = ("smart-devices-ems-huis.js", "smart-devices-ems-hub.js")
KAART_URLS = tuple(f"/{DOMAIN}/{b}" for b in KAART_BESTANDEN)
