import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


SDR_TOOLS = {
    "rtl_test": "sudo apt install rtl-sdr",
    "rtl_fm": "sudo apt install rtl-sdr",
    "dump1090": "sudo apt install dump1090-mutability",
    "readsb": "Install readsb from its project packages, or run dump1090 instead.",
}

AIRCRAFT_JSON_PATHS = [
    Path("/run/readsb/aircraft.json"),
    Path("/run/dump1090-fa/aircraft.json"),
    Path("/var/run/dump1090-fa/aircraft.json"),
    Path("/run/dump1090-mutability/aircraft.json"),
    Path("/var/run/dump1090-mutability/aircraft.json"),
]

FM_PRESETS = [
    {"frequency": "88.70", "name": "Preset 1", "favorite": False},
    {"frequency": "92.00", "name": "Preset 2", "favorite": False},
    {"frequency": "96.70", "name": "Preset 3", "favorite": True},
    {"frequency": "104.80", "name": "Preset 4", "favorite": False},
]


def _tool(name: str) -> dict[str, Any]:
    return {
        "name": name,
        "available": shutil.which(name) is not None,
        "install": SDR_TOOLS.get(name, "Install the required package."),
    }


def dependency_status() -> list[dict[str, Any]]:
    return [_tool(name) for name in SDR_TOOLS]


def _run(args: list[str], timeout: int = 5) -> dict[str, Any]:
    try:
        completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
    except FileNotFoundError:
        return {"ok": False, "error": f"{args[0]} is missing.", "stdout": "", "stderr": ""}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"{args[0]} timed out.", "stdout": "", "stderr": ""}
    return {
        "ok": completed.returncode == 0,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
        "returncode": completed.returncode,
    }


def detect_sdr() -> dict[str, Any]:
    dependencies = dependency_status()
    rtl_test = next((item for item in dependencies if item["name"] == "rtl_test"), None)
    if not rtl_test or not rtl_test["available"]:
        return {
            "connected": False,
            "label": "RTL-SDR Blog V4 / compatible SDR",
            "health": "Tool missing",
            "message": "rtl_test is missing. Install rtl-sdr to detect RTL-SDR hardware.",
            "dependencies": dependencies,
        }

    result = _run(["rtl_test", "-t"], timeout=6)
    output = f"{result.get('stdout', '')}\n{result.get('stderr', '')}".lower()
    connected = "found" in output and "no supported devices found" not in output
    return {
        "connected": connected,
        "label": "RTL-SDR Blog V4 / compatible SDR",
        "health": "Ready" if connected else "Disconnected",
        "message": "RTL-SDR receiver detected." if connected else "No supported RTL-SDR device found.",
        "raw": (result.get("stderr") or result.get("stdout") or "")[:500],
        "dependencies": dependencies,
    }


def radio_status(sdr: dict[str, Any] | None = None) -> dict[str, Any]:
    sdr = sdr or detect_sdr()
    rtl_fm_available = shutil.which("rtl_fm") is not None
    available = bool(sdr.get("connected")) and rtl_fm_available
    return {
        "available": available,
        "receiver": "RTL-SDR Blog V4",
        "frequency": "96.70",
        "station": "FM preset",
        "signal_strength": 42 if available else 0,
        "favorites": [preset for preset in FM_PRESETS if preset["favorite"]],
        "presets": FM_PRESETS,
        "message": "FM radio controls are ready." if available else "Connect RTL-SDR hardware and install rtl_fm to enable FM radio.",
    }


def _read_aircraft_json() -> tuple[str | None, dict[str, Any] | None]:
    for path in AIRCRAFT_JSON_PATHS:
        if not path.exists():
            continue
        try:
            return str(path), json.loads(path.read_text(encoding="utf-8", errors="ignore"))
        except (OSError, json.JSONDecodeError):
            return str(path), None
    return None, None


def aircraft_status(sdr: dict[str, Any] | None = None) -> dict[str, Any]:
    sdr = sdr or detect_sdr()
    source_path, payload = _read_aircraft_json()
    aircraft = []
    if payload and isinstance(payload.get("aircraft"), list):
        for item in payload["aircraft"][:40]:
            aircraft.append({
                "hex": item.get("hex"),
                "flight": str(item.get("flight") or "").strip(),
                "altitude": item.get("alt_baro") or item.get("alt_geom"),
                "speed": item.get("gs"),
                "distance": item.get("r_dst"),
                "direction": item.get("track"),
                "route": item.get("route"),
                "lat": item.get("lat"),
                "lon": item.get("lon"),
            })

    has_decoder = shutil.which("dump1090") is not None or shutil.which("readsb") is not None
    available = bool(aircraft)
    return {
        "available": available,
        "source": source_path or ("dump1090/readsb installed" if has_decoder else "No local ADS-B decoder"),
        "receiver_connected": bool(sdr.get("connected")),
        "aircraft": aircraft,
        "stats": {
            "count": len(aircraft),
            "decoder_available": has_decoder,
            "signal_quality": "active" if available else "waiting",
        },
        "message": "Reading local ADS-B aircraft feed." if available else "No local ADS-B aircraft feed found. Run dump1090 or readsb.",
    }


def signal_status() -> dict[str, Any]:
    sdr = detect_sdr()
    return {
        "ok": True,
        "sdr": sdr,
        "radio": radio_status(sdr),
        "aircraft": aircraft_status(sdr),
    }
