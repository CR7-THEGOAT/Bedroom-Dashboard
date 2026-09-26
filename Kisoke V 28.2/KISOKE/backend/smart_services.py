from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from datetime import date
from ipaddress import ip_address
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, Request
from pydantic import BaseModel


router = APIRouter()
CONFIG_PATH = Path(__file__).resolve().parent / "smart_home.json"
CONFIG_LOCK = threading.RLock()
COMMUNICATION_EVENTS: deque[dict[str, Any]] = deque(maxlen=100)
COMMUNICATION_LOCK = threading.RLock()
PRINTER_STATUS_CACHE: dict[str, Any] = {"checked": 0.0, "base_url": "", "result": None}

DEFAULT_CONFIG: dict[str, Any] = {
    "home_assistant": {
        "enabled": False,
        "base_url": "http://homeassistant.local:8123",
        "token": "",
    },
    "printer": {
        "enabled": True,
        "base_url": "http://192.168.4.74",
        "api_key": "",
        "poll_seconds": 15,
    },
    "devices": [],
    "routine_schedules": [],
}

DEVICE_TYPES = {"light", "switch", "plug", "climate", "tv", "camera", "lock", "media_player"}


class ConfigRequest(BaseModel):
    home_assistant: dict[str, Any] | None = None
    printer: dict[str, Any] | None = None
    devices: list[dict[str, Any]] | None = None
    routine_schedules: list[dict[str, Any]] | None = None


class ActionRequest(BaseModel):
    device_id: str | None = None
    entity_id: str | None = None
    domain: str | None = None
    service: str | None = None
    value: float | None = None
    data: dict[str, Any] | None = None


class RoutineRequest(BaseModel):
    routine: str


class CommunicationRequest(BaseModel):
    message: str
    kind: str | None = "announcement"
    sender: str | None = "KISOKE"


def _read_config() -> dict[str, Any]:
    with CONFIG_LOCK:
        if not CONFIG_PATH.exists():
            return json.loads(json.dumps(DEFAULT_CONFIG))
        try:
            loaded = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except Exception:
            loaded = {}
        return {
            **DEFAULT_CONFIG,
            **loaded,
            "home_assistant": {**DEFAULT_CONFIG["home_assistant"], **(loaded.get("home_assistant") or {})},
            "printer": {**DEFAULT_CONFIG["printer"], **(loaded.get("printer") or {})},
            "devices": loaded.get("devices") if isinstance(loaded.get("devices"), list) else [],
            "routine_schedules": loaded.get("routine_schedules") if isinstance(loaded.get("routine_schedules"), list) else [],
        }


def _write_config(config: dict[str, Any]) -> None:
    with CONFIG_LOCK:
        CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def _private_host(host: str) -> bool:
    clean = str(host or "").strip().lower()
    if clean in {"localhost", "homeassistant.local"} or clean.endswith(".local"):
        return True
    try:
        address = ip_address(clean)
        return address.is_private or address.is_loopback or address.is_link_local
    except ValueError:
        return False


def _private_request(request: Request) -> bool:
    return bool(request.client and _private_host(request.client.host))


def _normalize_private_url(value: Any, fallback: str) -> tuple[str, str | None]:
    raw = str(value or fallback).strip().rstrip("/")
    if not raw.startswith(("http://", "https://")):
        raw = f"http://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or not _private_host(parsed.hostname):
        return fallback.rstrip("/"), "Only loopback, private-LAN, link-local, and .local addresses are allowed."
    return raw, None


def _public_config(config: dict[str, Any]) -> dict[str, Any]:
    result = json.loads(json.dumps(config))
    ha = result.get("home_assistant", {})
    printer = result.get("printer", {})
    ha["token_set"] = bool(ha.pop("token", ""))
    printer["api_key_set"] = bool(printer.pop("api_key", ""))
    return result


def _clean_device(item: dict[str, Any], index: int) -> dict[str, Any] | None:
    entity_id = str(item.get("entity_id") or "").strip().lower()
    domain = entity_id.split(".", 1)[0] if "." in entity_id else str(item.get("type") or "switch").lower()
    kind = str(item.get("type") or domain).lower()
    if kind == "plug":
        domain = "switch"
    if kind == "tv":
        domain = "media_player"
    if kind not in DEVICE_TYPES or domain not in {"light", "switch", "climate", "media_player", "camera", "lock"}:
        return None
    if not entity_id or "." not in entity_id:
        return None
    return {
        "id": str(item.get("id") or f"device-{index + 1}")[:60],
        "name": str(item.get("name") or entity_id)[:80],
        "type": kind,
        "entity_id": entity_id[:160],
        "room": str(item.get("room") or "Room")[:60],
    }


def _ha_headers(config: dict[str, Any]) -> dict[str, str]:
    token = str(config.get("home_assistant", {}).get("token") or "").strip()
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _ha_request(config: dict[str, Any], method: str, path: str, payload: dict[str, Any] | None = None, timeout: float = 3.0) -> dict[str, Any]:
    ha = config.get("home_assistant", {})
    if not ha.get("enabled"):
        return {"ok": False, "error": "Home Assistant bridge is disabled."}
    if not ha.get("token"):
        return {"ok": False, "error": "Add a Home Assistant long-lived access token first."}
    base_url, error = _normalize_private_url(ha.get("base_url"), DEFAULT_CONFIG["home_assistant"]["base_url"])
    if error:
        return {"ok": False, "error": error}
    try:
        response = requests.request(method, f"{base_url}{path}", headers=_ha_headers(config), json=payload, timeout=timeout)
        if not 200 <= response.status_code < 300:
            return {"ok": False, "error": f"Home Assistant returned HTTP {response.status_code}.", "status": response.status_code}
        try:
            data = response.json()
        except ValueError:
            data = None
        return {"ok": True, "status": response.status_code, "data": data}
    except requests.RequestException as error_value:
        return {"ok": False, "error": str(error_value)}


def _printer_state_from_payload(payload: Any) -> tuple[str | None, float | None, str | None]:
    if not isinstance(payload, dict):
        return None, None, None
    result = payload.get("result") if isinstance(payload.get("result"), dict) else payload
    print_stats = result.get("status", {}).get("print_stats") if isinstance(result.get("status"), dict) else None
    if isinstance(print_stats, dict):
        state = str(print_stats.get("state") or "").lower()
        filename = print_stats.get("filename")
        duration = float(print_stats.get("print_duration") or 0)
        total = float(print_stats.get("total_duration") or 0)
        progress = min(100.0, (duration / total * 100)) if total > 0 else None
        return state, progress, filename
    state_value = payload.get("state")
    if isinstance(state_value, dict):
        state = str(state_value.get("text") or state_value.get("flags") or "").lower()
    else:
        state = str(state_value or payload.get("status") or payload.get("printer", {}).get("state") or "").lower()
    progress_payload = payload.get("progress") if isinstance(payload.get("progress"), dict) else {}
    completion = progress_payload.get("completion", payload.get("progress"))
    try:
        progress = float(completion) if completion is not None else None
    except (TypeError, ValueError):
        progress = None
    filename = payload.get("job", {}).get("file", {}).get("name") if isinstance(payload.get("job"), dict) else payload.get("filename")
    return state or None, progress, filename


def printer_status(config: dict[str, Any] | None = None) -> dict[str, Any]:
    config = config or _read_config()
    printer = config.get("printer", {})
    base_url, error = _normalize_private_url(printer.get("base_url"), DEFAULT_CONFIG["printer"]["base_url"])
    if error:
        return {"ok": False, "online": False, "base_url": base_url, "error": error}
    if not printer.get("enabled", True):
        return {"ok": True, "online": False, "enabled": False, "base_url": base_url, "state": "disabled"}
    now = time.monotonic()
    cached = PRINTER_STATUS_CACHE.get("result")
    if cached and PRINTER_STATUS_CACHE.get("base_url") == base_url and now - float(PRINTER_STATUS_CACHE.get("checked") or 0) < 10:
        return {**cached, "cached": True}

    def finish(result: dict[str, Any]) -> dict[str, Any]:
        PRINTER_STATUS_CACHE.update({"checked": time.monotonic(), "base_url": base_url, "result": result})
        return result

    api_key = str(printer.get("api_key") or "").strip()
    headers = {"X-Api-Key": api_key} if api_key else {}
    probes = [
        ("moonraker", "/printer/objects/query?print_stats&virtual_sdcard"),
        ("octoprint", "/api/job"),
        ("prusaprinters", "/api/v1/status"),
        ("generic", "/api/status"),
        ("generic", "/status"),
    ]
    errors: list[str] = []
    for provider, path in probes:
        try:
            response = requests.get(f"{base_url}{path}", headers=headers, timeout=0.5)
            if not 200 <= response.status_code < 300:
                errors.append(f"{provider}: HTTP {response.status_code}")
                continue
            payload = response.json()
            state, progress, filename = _printer_state_from_payload(payload)
            normalized = state or "online"
            complete = any(word in normalized for word in ("complete", "completed", "finished", "standby", "operational")) and progress in (None, 100, 100.0)
            printing = any(word in normalized for word in ("print", "printing", "paused")) and not complete
            return finish({
                "ok": True,
                "online": True,
                "base_url": base_url,
                "ip": urlparse(base_url).hostname,
                "provider": provider,
                "state": normalized,
                "progress": progress,
                "filename": filename,
                "printing": printing,
                "complete": complete,
                "checked_at": int(time.time() * 1000),
            })
        except (requests.RequestException, ValueError) as error_value:
            errors.append(f"{provider}: {error_value}")
    return finish({
        "ok": False,
        "online": False,
        "base_url": base_url,
        "ip": urlparse(base_url).hostname,
        "state": "offline",
        "error": "Printer did not answer a supported local status API.",
        "attempts": errors,
        "checked_at": int(time.time() * 1000),
    })


@router.get("/api/smart-home/config")
def api_smart_home_config(request: Request) -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Smart-home configuration is private-network only."}
    return {"ok": True, "config": _public_config(_read_config()), "supported_types": sorted(DEVICE_TYPES)}


@router.post("/api/smart-home/config")
def api_smart_home_config_update(payload: ConfigRequest, request: Request) -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Smart-home configuration is private-network only."}
    current = _read_config()
    if payload.home_assistant is not None:
        patch = payload.home_assistant
        base_url, error = _normalize_private_url(patch.get("base_url"), current["home_assistant"]["base_url"])
        if error:
            return {"ok": False, "error": error}
        token = str(patch.get("token") or "").strip()
        current["home_assistant"] = {
            **current["home_assistant"],
            "enabled": bool(patch.get("enabled", current["home_assistant"].get("enabled"))),
            "base_url": base_url,
            "token": token or current["home_assistant"].get("token", ""),
        }
    if payload.printer is not None:
        patch = payload.printer
        base_url, error = _normalize_private_url(patch.get("base_url"), current["printer"]["base_url"])
        if error:
            return {"ok": False, "error": error}
        api_key = str(patch.get("api_key") or "").strip()
        current["printer"] = {
            **current["printer"],
            "enabled": bool(patch.get("enabled", current["printer"].get("enabled", True))),
            "base_url": base_url,
            "api_key": api_key or current["printer"].get("api_key", ""),
            "poll_seconds": max(10, min(300, int(patch.get("poll_seconds") or current["printer"].get("poll_seconds", 15)))),
        }
    if payload.devices is not None:
        devices = [_clean_device(item, index) for index, item in enumerate(payload.devices[:32]) if isinstance(item, dict)]
        current["devices"] = [item for item in devices if item]
    if payload.routine_schedules is not None:
        current["routine_schedules"] = payload.routine_schedules[:24]
    _write_config(current)
    return {"ok": True, "config": _public_config(current), "message": "Local smart-home configuration saved."}


@router.get("/api/smart-home/status")
def api_smart_home_status(request: Request) -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Smart-home status is private-network only."}
    config = _read_config()
    ha = _ha_request(config, "GET", "/api/", timeout=1.2)
    device_states: list[dict[str, Any]] = []
    if ha.get("ok"):
        for device in config.get("devices", []):
            result = _ha_request(config, "GET", f"/api/states/{device['entity_id']}", timeout=1.2)
            state_data = result.get("data") if result.get("ok") and isinstance(result.get("data"), dict) else {}
            device_states.append({**device, "online": bool(result.get("ok")), "state": state_data.get("state", "unavailable"), "attributes": state_data.get("attributes", {})})
    else:
        device_states = [{**device, "online": False, "state": "bridge offline"} for device in config.get("devices", [])]
    return {"ok": True, "home_assistant": ha, "devices": device_states, "printer": printer_status(config)}


@router.post("/api/smart-home/action")
def api_smart_home_action(payload: ActionRequest, request: Request) -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Smart-home actions are private-network only."}
    config = _read_config()
    device = next((item for item in config.get("devices", []) if item.get("id") == payload.device_id), None)
    entity_id = str(payload.entity_id or (device or {}).get("entity_id") or "").strip().lower()
    domain = str(payload.domain or (entity_id.split(".", 1)[0] if "." in entity_id else "")).strip().lower()
    service = str(payload.service or "").strip().lower()
    allowed_services = {
        "light": {"turn_on", "turn_off", "toggle"},
        "switch": {"turn_on", "turn_off", "toggle"},
        "climate": {"turn_on", "turn_off", "set_temperature"},
        "media_player": {"turn_on", "turn_off", "media_play", "media_pause", "volume_set"},
        "camera": {"turn_on", "turn_off", "enable_motion_detection", "disable_motion_detection"},
        "lock": {"lock", "unlock"},
    }
    if domain not in allowed_services or service not in allowed_services[domain] or not entity_id.startswith(f"{domain}."):
        return {"ok": False, "error": "That device action is not in the local allow-list."}
    data = {"entity_id": entity_id, **(payload.data or {})}
    if payload.value is not None:
        if service == "set_temperature":
            data["temperature"] = max(10, min(35, payload.value))
        elif service == "volume_set":
            data["volume_level"] = max(0, min(1, payload.value))
    result = _ha_request(config, "POST", f"/api/services/{domain}/{service}", data)
    return {**result, "device": device or {"entity_id": entity_id}, "service": service}


@router.post("/api/smart-home/routine")
def api_smart_home_routine(payload: RoutineRequest, request: Request) -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Smart-home routines are private-network only."}
    routine = payload.routine.strip().lower().replace("_", "-")
    config = _read_config()
    actions: list[tuple[str, str, str]] = []
    for device in config.get("devices", []):
        domain = device["entity_id"].split(".", 1)[0]
        if routine in {"away", "empty-room", "good-night"}:
            service = "lock" if domain == "lock" else "media_pause" if domain == "media_player" else "turn_off"
            if service in {"lock", "media_pause"} or domain in {"light", "switch", "climate", "camera"}:
                actions.append((domain, service, device["entity_id"]))
        elif routine == "good-morning" and domain in {"light", "switch"}:
            actions.append((domain, "turn_on", device["entity_id"]))
        elif routine == "movie" and domain == "light":
            actions.append((domain, "turn_off", device["entity_id"]))
    results = [_ha_request(config, "POST", f"/api/services/{domain}/{service}", {"entity_id": entity}) for domain, service, entity in actions]
    ok_count = sum(1 for item in results if item.get("ok"))
    return {"ok": bool(actions) and ok_count == len(actions), "routine": routine, "actions": len(actions), "completed": ok_count, "results": results, "message": f"{routine.replace('-', ' ').title()} routine ran {ok_count} of {len(actions)} local actions."}


@router.get("/api/printer/status")
def api_printer_status(request: Request) -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Printer status is private-network only."}
    return printer_status()


@router.post("/api/communications/announcement")
def api_communications_announcement(payload: CommunicationRequest, request: Request) -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Local announcements are private-network only."}
    message = str(payload.message or "").strip()[:500]
    if not message:
        return {"ok": False, "error": "Announcement text is empty."}
    event = {
        "id": int(time.time() * 1000),
        "kind": payload.kind if payload.kind in {"announcement", "message"} else "announcement",
        "sender": str(payload.sender or "KISOKE")[:80],
        "message": message,
        "created_at": int(time.time() * 1000),
    }
    with COMMUNICATION_LOCK:
        COMMUNICATION_EVENTS.append(event)
    return {"ok": True, "event": event}


@router.get("/api/communications/events")
def api_communications_events(request: Request, since: int = 0) -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Local messages are private-network only.", "events": []}
    with COMMUNICATION_LOCK:
        events = [item for item in COMMUNICATION_EVENTS if int(item.get("id", 0)) > since]
    return {"ok": True, "events": events}


@router.get("/api/sports/scores")
def api_sports_scores(request: Request, sport: str = "Soccer") -> dict[str, Any]:
    if not _private_request(request):
        return {"ok": False, "error": "Sports score proxy is private-network only."}
    api_key = os.environ.get("SPORTSDB_API_KEY", "3").strip() or "3"
    clean_sport = str(sport or "Soccer").strip()[:40]
    try:
        response = requests.get(
            f"https://www.thesportsdb.com/api/v1/json/{api_key}/eventsday.php",
            params={"d": date.today().isoformat(), "s": clean_sport},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()
        events = []
        for event in (data.get("events") or [])[:24]:
            events.append({
                "id": event.get("idEvent"),
                "league": event.get("strLeague"),
                "home": event.get("strHomeTeam"),
                "away": event.get("strAwayTeam"),
                "home_score": event.get("intHomeScore"),
                "away_score": event.get("intAwayScore"),
                "status": event.get("strStatus") or event.get("strProgress") or event.get("strTime"),
                "date": event.get("dateEvent"),
                "time": event.get("strTime"),
            })
        return {"ok": True, "sport": clean_sport, "date": date.today().isoformat(), "events": events, "source": "TheSportsDB"}
    except (requests.RequestException, ValueError) as error_value:
        return {"ok": False, "sport": clean_sport, "events": [], "error": str(error_value), "source": "TheSportsDB"}
