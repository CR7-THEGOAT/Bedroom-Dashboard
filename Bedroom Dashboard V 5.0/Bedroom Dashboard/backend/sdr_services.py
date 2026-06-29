from __future__ import annotations

import json
import shutil
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any


DEPENDENCIES = [
    {
        "name": "rtl_test",
        "command": "rtl_test",
        "install": "sudo apt install -y rtl-sdr",
        "purpose": "RTL-SDR hardware detection",
    },
    {
        "name": "rtl_fm",
        "command": "rtl_fm",
        "install": "sudo apt install -y rtl-sdr",
        "purpose": "FM radio reception",
    },
    {
        "name": "dump1090",
        "command": "dump1090",
        "install": "sudo apt install -y dump1090-mutability",
        "purpose": "ADS-B aircraft feed",
    },
    {
        "name": "readsb",
        "command": "readsb",
        "install": "Install readsb or use dump1090-mutability.",
        "purpose": "ADS-B aircraft feed",
    },
]


def _dependency_status() -> list[dict[str, Any]]:
    return [
        {
            "name": item["name"],
            "available": shutil.which(item["command"]) is not None,
            "install": item["install"],
            "purpose": item["purpose"],
        }
        for item in DEPENDENCIES
    ]


def _fetch_json(url: str, timeout: float = 1.5) -> dict[str, Any] | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            payload = response.read(512_000)
        data = json.loads(payload.decode("utf-8", errors="replace"))
        return data if isinstance(data, dict) else None
    except (OSError, urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return None


def _load_aircraft_feed() -> tuple[list[dict[str, Any]], str | None]:
    candidates = [
        ("dump1090", "http://127.0.0.1:8080/data/aircraft.json"),
        ("readsb", "http://127.0.0.1:8080/readsb/data/aircraft.json"),
        ("tar1090", "http://127.0.0.1/tar1090/data/aircraft.json"),
    ]
    for source, url in candidates:
        data = _fetch_json(url)
        aircraft = data.get("aircraft") if data else None
        if isinstance(aircraft, list):
            return aircraft[:32], source
    return [], None


def aircraft_status() -> dict[str, Any]:
    aircraft, source = _load_aircraft_feed()
    return {
        "available": bool(source),
        "source": source or "Local dump1090/readsb",
        "aircraft": aircraft,
        "count": len(aircraft),
        "message": "Reading local ADS-B feed." if source else "Install/run dump1090 or readsb for live aircraft.",
    }


def radio_status() -> dict[str, Any]:
    rtl_fm_available = shutil.which("rtl_fm") is not None
    return {
        "available": rtl_fm_available,
        "frequency": "96.70",
        "station": "Manual FM tuning",
        "signal_strength": 0,
        "presets": [
            {"frequency": "90.2", "name": "Preset 1"},
            {"frequency": "92.0", "name": "Preset 2"},
            {"frequency": "96.7", "name": "Preset 3"},
            {"frequency": "104.8", "name": "Preset 4"},
        ],
        "message": "rtl_fm is installed. Connect RTL-SDR hardware to tune FM." if rtl_fm_available else "Install rtl-sdr for FM radio reception.",
    }


def signal_status() -> dict[str, Any]:
    dependencies = _dependency_status()
    rtl_tools_ready = any(item["name"] == "rtl_test" and item["available"] for item in dependencies)
    radio = radio_status()
    aircraft = aircraft_status()
    connected = False

    return {
        "ok": True,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
        "sdr": {
            "connected": connected,
            "label": "RTL-SDR Blog V4 / compatible SDR",
            "health": "Tools installed" if rtl_tools_ready else "Missing tools",
            "signal_quality": 0,
            "dependencies": dependencies,
            "message": "Connect RTL-SDR hardware to enable live radio and ADS-B." if rtl_tools_ready else "Install rtl-sdr tools first.",
        },
        "radio": radio,
        "aircraft": aircraft,
    }
