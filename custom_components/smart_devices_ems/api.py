"""Ophalen van /api/apparaat/status."""

from __future__ import annotations

import asyncio
from typing import Any

import aiohttp

from .const import STATUS_PAD


class SleutelOngeldig(Exception):
    """De portal weigert de sleutel (ingetrokken of fout)."""


class NietBereikbaar(Exception):
    """De portal antwoordt niet of met een fout."""


async def haal_status(sessie: aiohttp.ClientSession, adres: str, sleutel: str) -> dict[str, Any]:
    url = adres.rstrip("/") + STATUS_PAD
    try:
        async with asyncio.timeout(20):
            async with sessie.get(url, headers={"Authorization": f"Bearer {sleutel}"}) as r:
                if r.status in (401, 403):
                    raise SleutelOngeldig
                if r.status != 200:
                    raise NietBereikbaar(f"HTTP {r.status}")
                return await r.json()
    except (aiohttp.ClientError, TimeoutError) as e:
        raise NietBereikbaar(str(e)) from e
