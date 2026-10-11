"""Constanten voor Smart Devices EMS."""

from datetime import timedelta

DOMAIN = "smart_devices_ems"

CONF_SLEUTEL = "sleutel"
CONF_ADRES = "adres"

STANDAARD_ADRES = "https://portal.ems.smart-devices.online"
STATUS_PAD = "/api/apparaat/status"

# De portal ververst per halve minuut; vaker vragen heeft geen zin.
SCAN_INTERVAL = timedelta(seconds=30)
