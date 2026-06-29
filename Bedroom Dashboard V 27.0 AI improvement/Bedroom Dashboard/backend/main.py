import json
import html as html_lib
import mimetypes
import os
import platform
import re
import shutil
import subprocess
import threading
import hashlib
import secrets
import time
import base64
from datetime import datetime
from ipaddress import ip_address, ip_network
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from fastapi import FastAPI, Request
from fastapi.responses import Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from .sdr_services import aircraft_status, radio_status, signal_status
    from .camera_sensor import DEFAULT_CAMERA_CONTROLS, get_camera_sensor_manager
    from .offline_voice import get_offline_voice_service
except ImportError:
    from sdr_services import aircraft_status, radio_status, signal_status
    from camera_sensor import DEFAULT_CAMERA_CONTROLS, get_camera_sensor_manager
    from offline_voice import get_offline_voice_service


def _env_truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def load_local_env() -> None:
    env_paths = [
        Path(__file__).with_name(".env"),
        Path(__file__).resolve().parent.parent / ".env.local",
    ]
    for env_path in env_paths:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            clean_value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key.strip(), clean_value)

    if not os.environ.get("ALLOW_DEVICE_CONTROL"):
        frontend_allow = os.environ.get("VITE_ALLOW_DEVICE_CONTROL") or os.environ.get("VITE_DEVICE_CONTROL_ENABLED")
        if _env_truthy(frontend_allow):
            os.environ["ALLOW_DEVICE_CONTROL"] = "true"


load_local_env()


APP_NAME = "Bedroom Dashboard Local Backend"
SETTINGS_PATH = Path(__file__).with_name("settings.json")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OLLAMA_MODEL_DIR = Path(os.environ.get("OLLAMA_MODELS", PROJECT_ROOT / "ollama"))
BEDROOM_DASHBOARD_AI_MODELS = [
    "gemma2:2b",
    "phi3.5",
    "llama3.2",
    "qwen2.5:3b",
    "llama3.2:1b",
    "qwen3:4b",
]
ASSISTANT_ACTIONS = {
    "reply",
    "chat",
    "open_settings",
    "open_dashboard",
    "open_clock",
    "open_signal",
    "open_radar",
    "open_bedroom",
    "bedroom_status",
    "open_music",
    "open_ollama",
    "open_projects",
    "open_camera",
    "open_alarm",
    "open_countdown",
    "open_stopwatch",
    "open_world_clock",
    "open_prayer_focus",
    "theme_red_night",
    "theme_dark",
    "theme_light",
    "theme_auto",
    "study_mode",
    "sleep_mode",
    "show_weather",
    "show_prayer",
    "start_timer",
    "start_countdown",
    "pause_countdown",
    "reset_countdown",
    "start_stopwatch",
    "stop_stopwatch",
    "reset_stopwatch",
    "set_volume",
    "mute_volume",
    "set_brightness",
    "brighter",
    "dim_screen",
    "night_light_on",
    "night_light_off",
    "play_music",
    "pause_music",
    "next_music",
    "shuffle_music",
    "switch_camera",
    "health_summary",
    "health_repair",
    "download_ai_models",
    "set_model_easy",
    "set_model_hard",
    "set_model_auto",
    "turn_on_athan",
    "turn_off_athan",
}
BEDROOM_ESP32_URL = os.environ.get("BEDROOM_ESP32_URL", "http://192.168.4.51/")
BEDROOM_WIFI_NAME = os.environ.get("BEDROOM_WIFI_NAME", "SALIM1-5G")
BEDROOM_ESP32_TIMEOUT = float(os.environ.get("BEDROOM_ESP32_TIMEOUT", "2.5"))
SETTINGS_LOCK = threading.RLock()
TAILSCALE_CGNAT = ip_network("100.64.0.0/10")
STARTED_AT = datetime.now()
REMOTE_CAMERA_SESSIONS: dict[str, dict[str, Any]] = {}
REMOTE_CAMERA_FAILED_ATTEMPTS: dict[str, int] = {}
REMOTE_CAMERA_SNAPSHOT_DIR = Path(__file__).with_name("security_snapshots")
CAMERA_LOCK = threading.RLock()
REMOTE_CAMERA_CAPTURE: Any | None = None
REMOTE_CAMERA_CAPTURE_DEVICE: int | None = None
REMOTE_CAMERA_ACTIVE_STREAMS = 0
REMOTE_CAMERA_LAST_FRAME: bytes | None = None
REMOTE_CAMERA_LAST_FRAME_AT = 0.0
REMOTE_CAMERA_DEVICE_CACHE: dict[str, Any] = {"at": 0.0, "data": None}
OLLAMA_STATUS_CACHE: dict[str, Any] = {"at": 0.0, "data": None}
CAMERA_PAGE_CLIENTS: dict[str, dict[str, Any]] = {}
CAMERA_PAGE_LOCK = threading.RLock()
CAMERA_PAGE_TTL_SECONDS = 12.0
CAMERA_IDLE_WATCHDOG_STARTED = False
CAMERA_IDLE_WATCHDOG_LOCK = threading.Lock()
BEDROOM_CACHE_LOCK = threading.RLock()
BEDROOM_LAST_GOOD: dict[str, Any] = {"at": 0.0, "data": None}
BEDROOM_DISCOVERY: dict[str, Any] = {"at": 0.0, "url": ""}
BEDROOM_CACHE_PATH = Path(__file__).with_name("bedroom_esp32_cache.json")
BEDROOM_CACHE_MAX_AGE = int(os.environ.get("BEDROOM_CACHE_MAX_AGE", "86400"))
MUSIC_DIR = Path(os.environ.get("BEDROOM_DASHBOARD_MUSIC_DIR", PROJECT_ROOT / "music"))
ALARM_SOUND_DIRS = [
    Path(os.environ.get("BEDROOM_DASHBOARD_ALARM_SOUNDS_DIR", PROJECT_ROOT / "Custome Alarm Sounds")),
    PROJECT_ROOT / "Custom Alarm Sounds",
]
VIDEO_INTRO_DIRS = [
    Path(os.environ.get("BEDROOM_DASHBOARD_VIDEO_INTROS_DIR", PROJECT_ROOT / "Custome Video Intro")),
    PROJECT_ROOT / "Custom Video Intro",
]
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".opus", ".webm"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"}


def media_title(file_name: str) -> str:
    return re.sub(r"\s+", " ", Path(file_name).stem.replace("_", " ").replace("-", " ")).strip().title() or Path(file_name).name


def ensure_media_root(root: Path) -> Path:
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_child_path(root: Path, relative: str) -> Path | None:
    root = ensure_media_root(root)
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def pick_existing_root(candidates: list[Path]) -> Path:
    for candidate in candidates:
        if candidate.exists():
            return ensure_media_root(candidate)
    return ensure_media_root(candidates[0])


def scan_audio_tree(root: Path, recursive: bool = True, media_prefix: str = "/media/music") -> list[dict[str, Any]]:
    root = ensure_media_root(root)
    tracks: list[dict[str, Any]] = []
    iterator = root.rglob("*") if recursive else root.glob("*")
    for file_path in iterator:
        if not file_path.is_file() or file_path.suffix.lower() not in AUDIO_EXTENSIONS:
            continue
        try:
            stat = file_path.stat()
        except OSError:
            continue
        if stat.st_size <= 0:
            continue
        relative = file_path.relative_to(root).as_posix()
        folder = Path(relative).parent.as_posix()
        if folder == ".":
            folder = "Root"
        playlist = "Root" if folder == "Root" else folder.split("/", 1)[0]
        tracks.append({
            "file": relative,
            "title": media_title(file_path.name),
            "folder": folder,
            "playlist": playlist,
            "url": f"{media_prefix}/{quote(relative)}",
            "size": stat.st_size,
            "modifiedAt": int(stat.st_mtime * 1000),
        })
    return sorted(tracks, key=lambda item: (str(item.get("folder", "")), str(item.get("title", ""))))


def summarize_playlists(tracks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for track in tracks:
        name = str(track.get("playlist") or track.get("folder") or "Root")
        counts[name] = counts.get(name, 0) + 1
    return [{"name": name, "count": counts[name]} for name in sorted(counts)]


def scan_video_tree(root: Path, media_prefix: str = "/media/video-intros") -> list[dict[str, Any]]:
    root = ensure_media_root(root)
    videos: list[dict[str, Any]] = []
    for file_path in root.glob("*"):
        if not file_path.is_file() or file_path.suffix.lower() not in VIDEO_EXTENSIONS:
            continue
        try:
            stat = file_path.stat()
        except OSError:
            continue
        if stat.st_size <= 0:
            continue
        relative = file_path.relative_to(root).as_posix()
        videos.append({
            "file": relative,
            "title": media_title(file_path.name),
            "url": f"{media_prefix}/{quote(relative)}",
            "size": stat.st_size,
            "modifiedAt": int(stat.st_mtime * 1000),
        })
    return sorted(videos, key=lambda item: int(item.get("modifiedAt", 0)), reverse=True)


def media_response(root: Path, relative: str, request: Request, allowed_extensions: set[str]) -> Response:
    file_path = safe_child_path(root, relative)
    if not file_path or file_path.suffix.lower() not in allowed_extensions:
        return Response("Not found", status_code=404)

    stat = file_path.stat()
    mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        "Content-Type": mime_type,
    }
    range_header = request.headers.get("range")
    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else stat.st_size - 1
            end = min(end, stat.st_size - 1)
            if start >= stat.st_size or start > end:
                return Response(status_code=416, headers={"Content-Range": f"bytes */{stat.st_size}"})
            headers["Content-Range"] = f"bytes {start}-{end}/{stat.st_size}"
            headers["Content-Length"] = str(end - start + 1)
            with file_path.open("rb") as handle:
                handle.seek(start)
                return Response(handle.read(end - start + 1), status_code=206, headers=headers, media_type=mime_type)

    headers["Content-Length"] = str(stat.st_size)
    return Response(file_path.read_bytes(), headers=headers, media_type=mime_type)


def _first_number(pattern: str, text: str) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    try:
        return float(match.group(1))
    except (TypeError, ValueError):
        return None


def _first_text_after(label: str, text: str, stop_labels: list[str] | None = None) -> str:
    stop_labels = stop_labels or []
    pattern = rf"{re.escape(label)}\s*[:\-]?\s*([^\n\r<]+)"
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return ""
    value = re.sub(r"\s+", " ", match.group(1)).strip()
    for stop in stop_labels:
        value = value.split(stop, 1)[0].strip()
    return value


def parse_bedroom_esp32_html(html: str) -> dict[str, Any]:
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html_lib.unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()
    wifi_dbm = _first_number(r"WiFi(?:\s+RSSI)?\s*[\n\r ]*(-?\d+(?:\.\d+)?)\s*dBm", text)
    wifi_quality_match = (
        re.search(r"WiFi\s*[\n\r ]*-?\d+(?:\.\d+)?\s*dBm\s*[\n\r ]*([A-Za-z][A-Za-z ]{1,32})", text, re.IGNORECASE)
        or re.search(r"WiFi\s+Quality\s*[\n\r ]*([A-Za-z][A-Za-z ]{1,32})", text, re.IGNORECASE)
    )
    uptime_match = (
        re.search(r"ESP32\s+Uptime\s*[\n\r ]*(\d+)h\s*(\d+)m\s*(\d+)s", text, re.IGNORECASE)
        or re.search(r"\bUptime\s*[\n\r ]*(\d+)h\s*(\d+)m\s*(\d+)s", text, re.IGNORECASE)
    )
    uptime = ""
    uptime_seconds = None
    if uptime_match:
        hours, minutes, seconds = [int(value) for value in uptime_match.groups()]
        uptime_seconds = hours * 3600 + minutes * 60 + seconds
        uptime = f"{hours}h {minutes}m {seconds}s"

    return {
        "title": "ESP32 Smart Hub" if "ESP32 Smart Hub" in text else "ESP32 Sensor Hub" if "ESP32 Sensor Hub" in text else "Bedroom ESP32",
        "temperature_c": _first_number(r"Temperature\s*[\n\r ]*(-?\d+(?:\.\d+)?)\s*°?\s*C", text),
        "humidity_percent": _first_number(r"Humidity\s*[\n\r ]*(\d+(?:\.\d+)?)\s*%", text),
        "wifi_dbm": wifi_dbm,
        "wifi_quality": re.sub(r"\s+", " ", wifi_quality_match.group(1)).strip() if wifi_quality_match else "",
        "uptime": uptime,
        "uptime_seconds": uptime_seconds,
        "free_ram_kb": _first_number(r"Free\s+RAM\s*:\s*(\d+(?:\.\d+)?)\s*KB", text),
        "has_24h_graph_data": "NO DATA FOR LAST 24 HOURS" not in text.upper(),
        "matrix_editor": "8x8 Matrix Editor" in text or "8x8 Matrix" in text,
        "screen_upload": "Upload Picture to ST7789" in text or "Image Upload" in text or "Upload Picture" in text,
        "controls": {
            "buzzer": "Test Buzzer" in text or "Beep" in text,
            "ir_ac1": "Send IR AC1" in text,
            "matrix": "Send to Matrix" in text or "8x8 Matrix" in text,
        },
        "raw_text_sample": text[:900],
    }


def bedroom_join_url(base: str, path: str = "") -> str:
    clean_base = str(base or BEDROOM_ESP32_URL).rstrip("/")
    suffix = str(path or "").strip()
    if not suffix:
        return f"{clean_base}/"
    return f"{clean_base}/{suffix.lstrip('/')}"


def bedroom_base_url() -> str:
    with BEDROOM_CACHE_LOCK:
        discovered_at = float(BEDROOM_DISCOVERY.get("at") or 0.0)
        discovered_url = str(BEDROOM_DISCOVERY.get("url") or "").strip()
    if discovered_url and time.time() - discovered_at < 300:
        return discovered_url
    return BEDROOM_ESP32_URL


def bedroom_json(path: str, timeout: float | None = None, base: str | None = None) -> dict[str, Any]:
    response = requests.get(
        bedroom_join_url(base or bedroom_base_url(), path),
        timeout=timeout if timeout is not None else BEDROOM_ESP32_TIMEOUT,
        headers={"Connection": "close", "Accept": "application/json"},
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError(f"{path} did not return a JSON object.")
    return payload


def bedroom_json_retry(path: str, attempts: int = 3, timeout: float | None = None, base: str | None = None) -> dict[str, Any]:
    last_error: Exception | None = None
    for index in range(max(1, attempts)):
        try:
            return bedroom_json(path, timeout=timeout, base=base)
        except Exception as error:
            last_error = error
            if index < attempts - 1:
                time.sleep(0.22 * (index + 1))
    raise last_error or RuntimeError(f"{path} did not return JSON.")


def remember_bedroom_good(parsed: dict[str, Any]) -> None:
    clean = json.loads(json.dumps(parsed))
    with BEDROOM_CACHE_LOCK:
        BEDROOM_LAST_GOOD["at"] = time.time()
        BEDROOM_LAST_GOOD["data"] = clean
    try:
        cache_payload = {"at": time.time(), "data": clean}
        tmp_path = BEDROOM_CACHE_PATH.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(cache_payload, ensure_ascii=False), encoding="utf-8")
        tmp_path.replace(BEDROOM_CACHE_PATH)
    except Exception:
        # Cache is best-effort; live ESP32 reads should never fail because disk cache failed.
        pass


def read_bedroom_cached(max_age: int = BEDROOM_CACHE_MAX_AGE) -> tuple[float, dict[str, Any] | None, str]:
    now = time.time()
    with BEDROOM_CACHE_LOCK:
        cached_at = float(BEDROOM_LAST_GOOD.get("at") or 0.0)
        cached_data = BEDROOM_LAST_GOOD.get("data")
    if isinstance(cached_data, dict) and cached_at and now - cached_at < max_age:
        return cached_at, json.loads(json.dumps(cached_data)), "memory"

    try:
        if not BEDROOM_CACHE_PATH.exists():
            return 0.0, None, ""
        payload = json.loads(BEDROOM_CACHE_PATH.read_text(encoding="utf-8"))
        disk_at = float(payload.get("at") or 0.0)
        disk_data = payload.get("data")
        if isinstance(disk_data, dict) and disk_at and now - disk_at < max_age:
            with BEDROOM_CACHE_LOCK:
                BEDROOM_LAST_GOOD["at"] = disk_at
                BEDROOM_LAST_GOOD["data"] = json.loads(json.dumps(disk_data))
            return disk_at, json.loads(json.dumps(disk_data)), "disk"
    except Exception:
        return 0.0, None, ""
    return 0.0, None, ""


def short_bedroom_error(error: Any) -> str:
    text = str(error or "").strip()
    if not text:
        return "ESP32 did not answer."
    if "ConnectTimeout" in text or "timed out" in text:
        return f"ESP32 did not answer at {bedroom_base_url()} within {BEDROOM_ESP32_TIMEOUT:g}s."
    if "Connection refused" in text:
        return f"ESP32 refused the connection at {bedroom_base_url()}."
    if "No route to host" in text or "Network is unreachable" in text:
        return f"This laptop is not on the ESP32 network. Connect to {BEDROOM_WIFI_NAME}."
    if len(text) > 180:
        return f"{text[:177]}..."
    return text


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _safe_int(value: Any) -> int | None:
    number = _safe_float(value)
    return int(round(number)) if number is not None else None


def parse_bedroom_esp32_status(status: dict[str, Any], screen_config: dict[str, Any] | None = None) -> dict[str, Any]:
    wifi_quality = str(status.get("wifi_quality") or "").strip()
    wifi_pct = _safe_int(status.get("wifi_quality_pct"))
    if wifi_quality and wifi_pct is not None:
        wifi_quality = f"{wifi_quality} ({wifi_pct}%)"

    screen_mode = str(status.get("screen_mode") or "Dashboard").strip() or "Dashboard"
    photo1 = bool(status.get("photo1_available"))
    photo2 = bool(status.get("photo2_available"))
    photo3 = bool(status.get("photo3_available"))
    controls = {
        "buzzer": True,
        "ir_ac1": True,
        "matrix": True,
        "led": "led_on" in status or "led_color" in status,
        "screen": True,
        "photos": True,
    }

    return {
        "title": "ESP32 Smart Hub",
        "temperature_c": _safe_float(status.get("temperature")),
        "humidity_percent": _safe_float(status.get("humidity")),
        "wifi_dbm": _safe_float(status.get("wifi_rssi")),
        "wifi_quality": wifi_quality,
        "wifi_quality_pct": wifi_pct,
        "uptime": str(status.get("uptime") or ""),
        "uptime_seconds": None,
        "free_ram_kb": _safe_float(status.get("free_heap_kb")),
        "ip": str(status.get("ip") or ""),
        "screen_mode": screen_mode,
        "image_available": bool(status.get("image_available")),
        "photo1_available": photo1,
        "photo2_available": photo2,
        "photo3_available": photo3,
        "photo_slot": _safe_int(status.get("photo_slot")) or 1,
        "photo_summary": f"1 {'ready' if photo1 else 'empty'} | 2 {'ready' if photo2 else 'empty'} | 3 {'ready' if photo3 else 'empty'}",
        "game_mode": bool(status.get("game_mode")),
        "led_on": bool(status.get("led_on")),
        "led_brightness": _safe_int(status.get("led_brightness")),
        "led_color": str(status.get("led_color") or "#00FF88"),
        "has_24h_graph_data": False,
        "matrix_editor": True,
        "screen_upload": True,
        "screen_config": screen_config or {},
        "controls": controls,
        "raw_status": status,
        "raw_text_sample": json.dumps(status, ensure_ascii=False)[:900],
    }


def looks_like_bedroom_status(payload: dict[str, Any]) -> bool:
    return (
        "temperature" in payload
        and "humidity" in payload
        and ("wifi_rssi" in payload or "screen_mode" in payload or "free_heap_kb" in payload)
    )


def discover_bedroom_esp32() -> str | None:
    import concurrent.futures
    import socket
    from urllib.parse import urlparse

    with BEDROOM_CACHE_LOCK:
        discovered_at = float(BEDROOM_DISCOVERY.get("at") or 0.0)
        discovered_url = str(BEDROOM_DISCOVERY.get("url") or "").strip()
    if discovered_url and time.time() - discovered_at < 30:
        return discovered_url

    parsed = urlparse(BEDROOM_ESP32_URL)
    host = parsed.hostname or ""
    parts = host.split(".")
    if len(parts) != 4 or not all(part.isdigit() for part in parts):
        return None
    subnet = ".".join(parts[:3])
    candidates = [f"{subnet}.{index}" for index in range(1, 255)]
    if host in candidates:
        candidates.remove(host)
        candidates.insert(0, host)

    def port_open(ip: str) -> str | None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.18)
        try:
            sock.connect((ip, 80))
            return ip
        except Exception:
            return None
        finally:
            sock.close()

    open_hosts: list[str] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as executor:
        for result in executor.map(port_open, candidates):
            if result:
                open_hosts.append(result)

    for ip in open_hosts:
        base = f"http://{ip}/"
        try:
            payload = bedroom_json("/api/status", timeout=0.9, base=base)
            if looks_like_bedroom_status(payload):
                with BEDROOM_CACHE_LOCK:
                    BEDROOM_DISCOVERY["at"] = time.time()
                    BEDROOM_DISCOVERY["url"] = base
                return base
        except Exception:
            continue
    with BEDROOM_CACHE_LOCK:
        BEDROOM_DISCOVERY["at"] = time.time()
        BEDROOM_DISCOVERY["url"] = ""
    return None


def fetch_bedroom_esp32_data() -> dict[str, Any]:
    active_base = bedroom_base_url()
    try:
        status = bedroom_json_retry("/api/status", attempts=2, timeout=BEDROOM_ESP32_TIMEOUT, base=active_base)
        try:
            screen_config = bedroom_json("/api/screen-config", timeout=1.8, base=active_base)
        except Exception:
            screen_config = {}
        parsed = parse_bedroom_esp32_status(status, screen_config)
        parsed["source_url"] = active_base
        remember_bedroom_good(parsed)
        return parsed
    except Exception as json_error:
        discovered_base = discover_bedroom_esp32()
        if discovered_base and discovered_base.rstrip("/") != active_base.rstrip("/"):
            try:
                status = bedroom_json_retry("/api/status", attempts=1, timeout=BEDROOM_ESP32_TIMEOUT, base=discovered_base)
                try:
                    screen_config = bedroom_json("/api/screen-config", timeout=1.8, base=discovered_base)
                except Exception:
                    screen_config = {}
                parsed = parse_bedroom_esp32_status(status, screen_config)
                parsed["source_url"] = discovered_base
                parsed["discovered"] = True
                remember_bedroom_good(parsed)
                return parsed
            except Exception as discovered_error:
                json_error = discovered_error

        cached_at, cached_data, cache_source = read_bedroom_cached()
        if isinstance(cached_data, dict) and cached_at:
            parsed = cached_data
            parsed["stale"] = True
            parsed["stale_age_seconds"] = round(time.time() - cached_at)
            parsed["stale_source"] = cache_source
            parsed["connection_error"] = str(json_error)
            parsed["connection_error_short"] = short_bedroom_error(json_error)
            return parsed

        if not _env_truthy(os.environ.get("BEDROOM_HTML_FALLBACK")):
            raise json_error

        response = requests.get(
            bedroom_join_url(active_base),
            timeout=max(BEDROOM_ESP32_TIMEOUT, 4.5),
            headers={"Connection": "close"},
        )
        response.raise_for_status()
        parsed = parse_bedroom_esp32_html(response.text)
        try:
            parsed["screen_config"] = bedroom_json("/api/screen-config", timeout=2.5, base=active_base)
        except Exception:
            parsed["screen_config"] = {}
        parsed["source_url"] = active_base
        remember_bedroom_good(parsed)
        return parsed


def bedroom_url(path: str = "") -> str:
    return bedroom_join_url(bedroom_base_url(), path)


def proxy_bedroom_matrix(pixels: list[Any], pattern: str = "") -> dict[str, Any]:
    normalized = [1 if bool(value) else 0 for value in pixels][:64]
    if len(normalized) != 64:
        return {"ok": False, "error": "Matrix needs exactly 64 pixels."}

    attempts: list[dict[str, Any]] = []
    row_bytes: list[int] = []
    for row in range(8):
        value = 0
        for col in range(8):
            if normalized[row * 8 + col]:
                value |= 1 << (7 - col)
        row_bytes.append(value)
    hex_payload = "".join(f"{value:02x}" for value in row_bytes)

    targets = [
        ("GET", f"/matrix?data={hex_payload}", {}),
        ("POST JSON", "/api/matrix", {"json": {"pixels": normalized, "pattern": pattern}}),
        ("POST JSON", "/matrix", {"json": {"pixels": normalized, "pattern": pattern}}),
        ("POST FORM", "/sendMatrix", {"data": {"pixels": ",".join(map(str, normalized)), "pattern": pattern}}),
        ("POST FORM", "/matrix", {"data": {"pixels": ",".join(map(str, normalized)), "pattern": pattern}}),
    ]
    for method, path, kwargs in targets:
        url = bedroom_url(path)
        try:
            if method == "GET":
                response = requests.get(url, timeout=BEDROOM_ESP32_TIMEOUT)
            else:
                response = requests.post(url, timeout=BEDROOM_ESP32_TIMEOUT, **kwargs)
            attempts.append({"method": method, "url": url, "status": response.status_code})
            if 200 <= response.status_code < 300:
                return {"ok": True, "message": "Matrix data sent to ESP32.", "target": url, "attempts": attempts}
        except Exception as error:
            attempts.append({"method": method, "url": url, "error": str(error)})
    return {"ok": False, "error": "ESP32 matrix endpoint did not answer.", "attempts": attempts}


def image_bytes_to_rgb565(raw: bytes) -> bytes:
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception as error:
        raise RuntimeError(f"OpenCV/numpy is required for ST7789 image conversion: {error}") from error

    image_data = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Image could not be decoded. Use PNG, JPG, or another browser-readable image.")

    height, width = frame.shape[:2]
    target_w, target_h = 240, 320
    scale = max(target_w / max(width, 1), target_h / max(height, 1))
    crop_w = max(1, min(width, int(round(target_w / scale))))
    crop_h = max(1, min(height, int(round(target_h / scale))))
    x0 = max(0, (width - crop_w) // 2)
    y0 = max(0, (height - crop_h) // 2)
    cropped = frame[y0:y0 + crop_h, x0:x0 + crop_w]
    resized = cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_AREA)
    b = resized[:, :, 0].astype(np.uint16)
    g = resized[:, :, 1].astype(np.uint16)
    r = resized[:, :, 2].astype(np.uint16)
    rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
    out = np.empty((320, 240, 2), dtype=np.uint8)
    out[:, :, 0] = (rgb565 >> 8).astype(np.uint8)
    out[:, :, 1] = (rgb565 & 0xFF).astype(np.uint8)
    return out.tobytes()


def post_bedroom_image_chunks(payload: bytes, slot: int) -> dict[str, Any]:
    slot = max(1, min(3, int(slot or 1)))
    chunk_size = 8192
    total = len(payload)
    attempts: list[dict[str, Any]] = []
    target = bedroom_url("/image/upload")

    for offset in range(0, total, chunk_size):
        end = min(offset + chunk_size, total)
        headers = {
            "Content-Type": "application/octet-stream",
            "X-Image-Offset": str(offset),
            "X-Image-Total": str(total),
            "X-Image-First": "1" if offset == 0 else "0",
            "X-Image-Final": "1" if end == total else "0",
            "X-Image-Slot": str(slot),
        }
        try:
            response = requests.post(
                target,
                data=payload[offset:end],
                headers=headers,
                timeout=max(BEDROOM_ESP32_TIMEOUT, 8.0),
            )
            attempts.append({"url": target, "offset": offset, "bytes": end - offset, "status": response.status_code})
            if not 200 <= response.status_code < 300:
                return {
                    "ok": False,
                    "error": f"ESP32 image chunk failed at offset {offset}: HTTP {response.status_code}.",
                    "attempts": attempts,
                }
        except Exception as error:
            attempts.append({"url": target, "offset": offset, "bytes": end - offset, "error": str(error)})
            return {"ok": False, "error": str(error), "attempts": attempts}

    return {
        "ok": True,
        "message": f"Image uploaded to ESP32 Photo {slot}.",
        "target": target,
        "slot": slot,
        "bytes": total,
        "attempts": attempts,
    }


def post_raw_octet_stream(url: str, payload: bytes) -> dict[str, Any]:
    import socket
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme != "http":
        return {"ok": False, "error": "ESP32 raw upload only supports http URLs."}

    host = parsed.hostname
    if not host:
        return {"ok": False, "error": "ESP32 upload URL has no host."}
    port = parsed.port or 80
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    request_head = (
        f"POST {path} HTTP/1.0\r\n"
        f"Host: {host}\r\n"
        "Content-Type: application/octet-stream\r\n"
        f"Content-Length: {len(payload)}\r\n"
        "Connection: close\r\n"
        "\r\n"
    ).encode("ascii")

    sent = False
    try:
        with socket.create_connection((host, port), timeout=max(BEDROOM_ESP32_TIMEOUT, 8.0)) as sock:
            sock.settimeout(max(BEDROOM_ESP32_TIMEOUT, 8.0))
            sock.sendall(request_head)
            sock.sendall(payload)
            sent = True
            try:
                response = sock.recv(512)
            except (ConnectionResetError, TimeoutError, socket.timeout):
                response = b""
    except Exception as error:
        if sent:
            return {
                "ok": True,
                "message": "Image bytes were sent; ESP32 closed the response connection.",
                "warning": str(error),
            }
        return {"ok": False, "error": str(error)}

    if not response:
        return {"ok": True, "message": "Image bytes sent to ESP32 screen.", "warning": "ESP32 did not return a response body."}

    first_line = response.splitlines()[0].decode("latin1", errors="ignore") if response.splitlines() else ""
    status_match = re.search(r"HTTP/\d(?:\.\d)?\s+(\d+)", first_line)
    status = int(status_match.group(1)) if status_match else None
    if status is None or 200 <= status < 300:
        return {"ok": True, "message": "Image uploaded to ESP32 screen.", "status": status}
    return {"ok": False, "error": f"ESP32 returned HTTP {status}.", "status": status}


def proxy_bedroom_screen_image(filename: str, content_type: str, data_base64: str, slot: int = 1) -> dict[str, Any]:
    try:
        raw = base64.b64decode(str(data_base64 or ""), validate=True)
    except Exception:
        return {"ok": False, "error": "Image upload data is not valid base64."}
    if not raw:
        return {"ok": False, "error": "Image upload is empty."}
    if len(raw) > 4 * 1024 * 1024:
        return {"ok": False, "error": "Image is too large. Keep it under 4 MB."}

    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", filename or "screen-image")
    content_type = content_type or "application/octet-stream"
    attempts: list[dict[str, Any]] = []

    slot = max(1, min(3, int(_safe_int(slot) or 1)))

    try:
        rgb565 = image_bytes_to_rgb565(raw)
        chunk_result = post_bedroom_image_chunks(rgb565, slot)
        attempts.extend(chunk_result.get("attempts", []))
        if chunk_result.get("ok"):
            return {
                "ok": True,
                "message": chunk_result.get("message") or f"Image uploaded to ESP32 Photo {slot}.",
                "target": chunk_result.get("target"),
                "slot": slot,
                "attempts": attempts,
            }
    except Exception as error:
        attempts.append({"url": bedroom_url("/image/upload"), "mode": "rgb565-chunks", "slot": slot, "error": str(error)})

    targets = ["/upload", "/screen/upload", "/upload-screen", "/st7789/upload", "/api/screen-image"]
    for path in targets:
        url = bedroom_url(path)
        try:
            response = requests.post(
                url,
                timeout=max(BEDROOM_ESP32_TIMEOUT, 5.0),
                files={"file": (safe_name, raw, content_type)},
            )
            attempts.append({"url": url, "status": response.status_code})
            if 200 <= response.status_code < 300:
                return {"ok": True, "message": "Image uploaded to ESP32 screen.", "target": url, "attempts": attempts}
        except Exception as error:
            attempts.append({"url": url, "error": str(error)})
    return {"ok": False, "error": "ESP32 screen upload endpoint did not answer.", "attempts": attempts}


def proxy_bedroom_screen_mode(mode: str, slot: int | None = None) -> dict[str, Any]:
    clean_mode = str(mode or "").strip().lower()
    if clean_mode in {"dashboard", "dash"}:
        path = "/screen/dashboard"
        label = "Dashboard"
    elif clean_mode == "custom":
        path = "/screen/custom"
        label = "Custom"
    elif clean_mode in {"photo", "image", "picture"}:
        clean_slot = max(1, min(3, int(_safe_int(slot) or 1)))
        path = f"/screen/photo?slot={clean_slot}"
        label = f"Photo {clean_slot}"
    else:
        return {"ok": False, "error": "Screen mode must be dashboard, custom, or photo."}

    try:
        response = requests.get(bedroom_url(path), timeout=max(BEDROOM_ESP32_TIMEOUT, 4.0), allow_redirects=True)
        if 200 <= response.status_code < 400:
            return {"ok": True, "message": f"ESP32 screen switched to {label}.", "mode": clean_mode, "target": bedroom_url(path)}
        return {"ok": False, "error": f"ESP32 returned HTTP {response.status_code}.", "target": bedroom_url(path)}
    except Exception as error:
        return {"ok": False, "error": str(error), "target": bedroom_url(path)}


def proxy_bedroom_screen_customize(payload: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "screen_title",
        "dash_bg",
        "dash_text",
        "dash_accent",
        "custom_title",
        "line1",
        "line2",
        "line3",
        "custom_bg",
        "custom_text",
        "custom_accent",
    ]
    params = {}
    for key in keys:
        if key in payload:
            params[key] = str(payload.get(key) or "")
    params["show"] = "1" if payload.get("show") else "0"

    try:
        response = requests.get(
            bedroom_url("/screen/customize"),
            params=params,
            timeout=max(BEDROOM_ESP32_TIMEOUT, 5.0),
            allow_redirects=True,
        )
        if 200 <= response.status_code < 400:
            return {"ok": True, "message": "ESP32 screen customization saved.", "target": response.url}
        return {"ok": False, "error": f"ESP32 returned HTTP {response.status_code}.", "target": response.url}
    except Exception as error:
        return {"ok": False, "error": str(error), "target": bedroom_url("/screen/customize")}

DEVICE_TOOLS = {
    "brightnessctl": "sudo apt install brightnessctl",
    "xrandr": "sudo apt install x11-xserver-utils",
    "wpctl": "sudo apt install wireplumber",
    "pactl": "sudo apt install pulseaudio-utils",
    "nmcli": "sudo apt install network-manager",
    "bluetoothctl": "sudo apt install bluetooth bluez",
    "gsettings": "sudo apt install libglib2.0-bin",
    "powerprofilesctl": "sudo apt install power-profiles-daemon",
    "upower": "sudo apt install upower",
    "tailscale": "curl -fsSL https://tailscale.com/install.sh | sh",
    "rtl_test": "sudo apt install rtl-sdr",
    "rtl_fm": "sudo apt install rtl-sdr",
    "dump1090": "sudo apt install dump1090-mutability",
    "readsb": "Install readsb or use dump1090-mutability.",
}

WINDOWS_TOOL_PATHS = {
    "tailscale": [r"C:\Program Files\Tailscale\tailscale.exe"],
    "git": [r"C:\Program Files\Git\cmd\git.exe", r"C:\Program Files\Git\bin\git.exe"],
}

DEFAULT_SETTINGS: dict[str, Any] = {
    "assistant_name": "Nexora",
    "user_display_names": ["Saeed", "Sa3doon"],
    "easy_model": "gemma2:2b",
    "hard_model": "qwen2.5:3b",
    "voice_assistant_enabled": True,
    "offline_voice_enabled": True,
    "offline_voice_autostart": True,
    "offline_voice_engine": "vosk",
    "offline_voice_model_dir": "models/vosk-model-small-en-us-0.15",
    "offline_voice_device": None,
    "offline_voice_sample_rate": 16000,
    "offline_voice_wake_timeout": 8,
    "camera_auto_theme": False,
    "tts_enabled": True,
    "theme": "dark",
    "camera_enabled": True,
    "camera_device": 1,
    "usb_camera_mode": "sensor",
    "usb_camera_motion_area_threshold": 1000,
    "camera_background_adaptive_brightness": False,
    "listen_timeout": 5,
    "remote_access_note": "Use Wi-Fi host mode or Tailscale Serve for remote access.",
    "allow_device_control": False,
    "remote_camera_access_mode": "both",
    "remote_camera_password_hash": "",
    "remote_camera_privacy_mode": False,
    "remote_camera_high_security": False,
    "remote_camera_security_snapshots": False,
    "remote_camera_failed_attempt_threshold": 5,
    "camera_look_mode": "normal",
    "remote_camera_stream_profile": "reference720",
    "remote_camera_stream_fps": 24,
    "remote_camera_stream_quality": 82,
    "remote_camera_stream_width": 1280,
    "remote_camera_stream_height": 720,
    "camera_controls": DEFAULT_CAMERA_CONTROLS,
}


CAMERA_STREAM_PROFILES: dict[str, dict[str, int]] = {
    "lowest": {"fps": 5, "quality": 28, "width": 320, "height": 240},
    "low": {"fps": 8, "quality": 38, "width": 426, "height": 240},
    "balanced": {"fps": 12, "quality": 48, "width": 480, "height": 360},
    "fast30": {"fps": 30, "quality": 34, "width": 426, "height": 240},
    "smooth30": {"fps": 30, "quality": 58, "width": 640, "height": 360},
    "reference720": {"fps": 24, "quality": 82, "width": 1280, "height": 720},
    "high": {"fps": 30, "quality": 72, "width": 854, "height": 480},
    "highest": {"fps": 60, "quality": 86, "width": 1280, "height": 720},
}


def clamp_int(value: Any, minimum: int, maximum: int, fallback: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = fallback
    return max(minimum, min(maximum, number))


def normalize_camera_stream_settings(settings: dict[str, Any]) -> dict[str, Any]:
    profile = str(settings.get("remote_camera_stream_profile", "reference720") or "reference720").lower()
    if profile not in CAMERA_STREAM_PROFILES and profile != "custom":
        profile = "reference720"
    preset = CAMERA_STREAM_PROFILES.get(profile, CAMERA_STREAM_PROFILES["reference720"])
    if profile == "custom":
        return {
            "profile": "custom",
            "fps": clamp_int(settings.get("remote_camera_stream_fps"), 1, 150, 24),
            "quality": clamp_int(settings.get("remote_camera_stream_quality"), 20, 95, 78),
            "width": clamp_int(settings.get("remote_camera_stream_width"), 160, 1920, 1280),
            "height": clamp_int(settings.get("remote_camera_stream_height"), 120, 1080, 720),
        }
    return {"profile": profile, **preset}


def clamp_number(value: Any, minimum: float, maximum: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = fallback
    return max(minimum, min(maximum, number))


def normalize_camera_controls(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    controls = {**DEFAULT_CAMERA_CONTROLS, **source}
    controls["brightness"] = int(round(clamp_number(controls.get("brightness"), 0, 100, DEFAULT_CAMERA_CONTROLS["brightness"])))
    controls["contrast"] = int(round(clamp_number(controls.get("contrast"), 0, 100, DEFAULT_CAMERA_CONTROLS["contrast"])))
    controls["saturation"] = int(round(clamp_number(controls.get("saturation"), 0, 100, DEFAULT_CAMERA_CONTROLS["saturation"])))
    controls["sharpness"] = int(round(clamp_number(controls.get("sharpness"), 0, 100, DEFAULT_CAMERA_CONTROLS["sharpness"])))
    controls["gain"] = int(round(clamp_number(controls.get("gain"), 0, 100, DEFAULT_CAMERA_CONTROLS["gain"])))
    controls["exposure"] = round(clamp_number(controls.get("exposure"), -13, 0, DEFAULT_CAMERA_CONTROLS["exposure"]), 2)
    controls["white_balance"] = int(round(clamp_number(controls.get("white_balance"), 2800, 7000, DEFAULT_CAMERA_CONTROLS["white_balance"])))
    controls["auto_exposure"] = bool(controls.get("auto_exposure", DEFAULT_CAMERA_CONTROLS["auto_exposure"]))
    controls["auto_white_balance"] = bool(controls.get("auto_white_balance", DEFAULT_CAMERA_CONTROLS["auto_white_balance"]))
    return controls


class CommandRequest(BaseModel):
    command: str
    easy_model: str | None = None
    hard_model: str | None = None
    settings: dict[str, Any] | None = None
    context: dict[str, Any] | None = None


class PromptRequest(BaseModel):
    prompt: str
    model: str | None = None


class SpeakRequest(BaseModel):
    text: str
    rate: int | None = None
    volume: float | None = None


class OfflineVoiceRequest(BaseModel):
    settings: dict[str, Any] | None = None


app = FastAPI(title=APP_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_settings() -> dict[str, Any]:
    with SETTINGS_LOCK:
        if not SETTINGS_PATH.exists():
            write_settings(DEFAULT_SETTINGS)
        try:
            loaded = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            backup_path = SETTINGS_PATH.with_suffix(".broken.json")
            SETTINGS_PATH.replace(backup_path)
            loaded = {}
        return {**DEFAULT_SETTINGS, **loaded}


def write_settings(next_settings: dict[str, Any]) -> dict[str, Any]:
    with SETTINGS_LOCK:
        clean = {**DEFAULT_SETTINGS, **next_settings}
        temp_path = SETTINGS_PATH.with_suffix(".tmp")
        temp_path.write_text(json.dumps(clean, indent=2), encoding="utf-8")
        os.replace(temp_path, SETTINGS_PATH)
        return clean


def patch_settings(patch: dict[str, Any]) -> dict[str, Any]:
    current = read_settings()
    current.update(patch)
    return write_settings(current)


def offline_voice_service():
    return get_offline_voice_service(PROJECT_ROOT)


@app.on_event("startup")
def start_offline_voice_if_enabled() -> None:
    settings = read_settings()
    offline_enabled = bool(settings.get("offline_voice_enabled", False))
    autostart = bool(settings.get("offline_voice_autostart", False))
    if offline_enabled and autostart:
        offline_voice_service().start(settings)


def is_truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def is_private_client(request: Request) -> bool:
    host = request.client.host if request.client else ""
    try:
        address = ip_address(host)
    except ValueError:
        return host in {"localhost", "127.0.0.1", "::1"}
    return address.is_loopback or address.is_private or address in TAILSCALE_CGNAT


def client_network_kind(request: Request) -> str:
    host = request.client.host if request.client else ""
    try:
        address = ip_address(host)
    except ValueError:
        return "local" if host in {"localhost", "127.0.0.1", "::1"} else "public"
    if address.is_loopback:
        return "local"
    if address in TAILSCALE_CGNAT:
        return "tailscale"
    if address.is_private:
        return "private-lan"
    return "public"


def device_control_guard(request: Request) -> dict[str, Any] | None:
    if not is_truthy(os.environ.get("ALLOW_DEVICE_CONTROL")):
        return {"ok": False, "error": "Device control is disabled."}
    if not is_private_client(request):
        return {"ok": False, "error": "Device control is only allowed from localhost, private Wi-Fi, or private Tailscale."}
    return None


def find_tool(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    if is_windows():
        for candidate in WINDOWS_TOOL_PATHS.get(name, []):
            if Path(candidate).exists():
                return candidate
    return None


def tool_status() -> dict[str, dict[str, Any]]:
    if is_windows():
        powershell_available = bool(shutil.which("powershell") or shutil.which("pwsh"))
        return {
            "powershell": {
                "available": powershell_available,
                "install": "Built into Windows. Install PowerShell if it is missing.",
            },
            "windows_brightness_wmi": {
                "available": powershell_available,
                "install": "Uses Windows WMI/CIM. No Ubuntu brightnessctl driver needed on Windows.",
            },
            "windows_coreaudio": {
                "available": windows_coreaudio_available(),
                "install": "Install with: python -m pip install pycaw comtypes",
            },
            "powercfg": {
                "available": shutil.which("powercfg") is not None,
                "install": "Built into Windows.",
            },
            "tailscale": {
                "available": find_tool("tailscale") is not None,
                "install": "winget install Tailscale.Tailscale",
            },
            "ollama": {
                "available": shutil.which("ollama") is not None,
                "install": "winget install Ollama.Ollama",
            },
            "git": {
                "available": find_tool("git") is not None,
                "install": "winget install Git.Git",
            },
            "node": {
                "available": shutil.which("node") is not None,
                "install": "winget install OpenJS.NodeJS.LTS",
            },
        }
    return {
        name: {
            "available": shutil.which(name) is not None,
            "install": install,
        }
        for name, install in DEVICE_TOOLS.items()
    }


def hash_remote_camera_password(password: str) -> str:
    return hashlib.sha256(str(password or "").encode("utf-8")).hexdigest()


def remote_camera_password_matches(password: str, expected_hash: str) -> bool:
    if not expected_hash:
        return False
    return secrets.compare_digest(hash_remote_camera_password(password), expected_hash)


def remote_camera_network_allowed(settings: dict[str, Any], request: Request) -> tuple[bool, str, str]:
    mode = str(settings.get("remote_camera_access_mode", "disabled")).lower()
    kind = client_network_kind(request)
    if mode in {"disabled", "off", "none"}:
        return False, kind, "Remote camera access is disabled."
    if kind == "public":
        return False, kind, "Remote camera is local-only and never public."
    if mode == "local" and kind in {"local", "private-lan"}:
        return True, kind, "Local access allowed."
    if mode == "tailscale" and kind in {"local", "tailscale"}:
        return True, kind, "Tailscale access allowed."
    if mode == "both" and kind in {"local", "private-lan", "tailscale"}:
        return True, kind, "Private access allowed."
    return False, kind, f"Client is {kind}, but mode is {mode}."


def cleanup_remote_sessions() -> None:
    now = time.time()
    expired = [token for token, session in REMOTE_CAMERA_SESSIONS.items() if now - float(session.get("last_seen", 0)) > 30 * 60]
    for token in expired:
        REMOTE_CAMERA_SESSIONS.pop(token, None)


def camera_background_adaptive_enabled(settings: dict[str, Any]) -> bool:
    return bool(settings.get("camera_background_adaptive_brightness", False))


def camera_page_client_key(request: Request, payload: dict[str, Any]) -> str:
    supplied = str(payload.get("client_id") or payload.get("clientId") or "").strip()
    page = str(payload.get("page") or "camera").strip()[:40]
    if supplied:
        return f"{page}:{supplied[:120]}"
    client = request.client.host if request.client else "unknown"
    agent = request.headers.get("user-agent", "")[:160]
    digest = hashlib.sha1(f"{client}|{agent}|{page}".encode("utf-8")).hexdigest()[:16]
    return f"{page}:{client}:{digest}"


def prune_camera_page_clients(now: float | None = None) -> list[dict[str, Any]]:
    stamp = now or time.time()
    with CAMERA_PAGE_LOCK:
        expired = [
            key
            for key, client in CAMERA_PAGE_CLIENTS.items()
            if stamp - float(client.get("last_seen", 0)) > CAMERA_PAGE_TTL_SECONDS
        ]
        for key in expired:
            CAMERA_PAGE_CLIENTS.pop(key, None)
        return [dict(client) for client in CAMERA_PAGE_CLIENTS.values()]


def active_camera_page_clients() -> list[dict[str, Any]]:
    return prune_camera_page_clients()


def remote_camera_stream_count() -> int:
    with CAMERA_LOCK:
        return int(REMOTE_CAMERA_ACTIVE_STREAMS)


def camera_runtime_claimed(settings: dict[str, Any]) -> bool:
    return bool(active_camera_page_clients()) or remote_camera_stream_count() > 0 or camera_background_adaptive_enabled(settings)


def camera_page_runtime_status(settings: dict[str, Any] | None = None) -> dict[str, Any]:
    current = settings or read_settings()
    clients = active_camera_page_clients()
    return {
        "active_page_count": len(clients),
        "active_page_clients": clients,
        "active_streams": remote_camera_stream_count(),
        "background_adaptive_brightness": camera_background_adaptive_enabled(current),
        "camera_should_run": camera_runtime_claimed(current),
    }


def update_camera_page_client(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    active = payload.get("active", True) is not False
    key = camera_page_client_key(request, payload)
    now = time.time()
    if active:
        with CAMERA_PAGE_LOCK:
            CAMERA_PAGE_CLIENTS[key] = {
                "id": key,
                "page": str(payload.get("page") or "camera")[:40],
                "client": request.client.host if request.client else "unknown",
                "kind": client_network_kind(request),
                "last_seen": now,
                "user_agent": request.headers.get("user-agent", "")[:100],
            }
    else:
        with CAMERA_PAGE_LOCK:
            CAMERA_PAGE_CLIENTS.pop(key, None)
    return camera_page_runtime_status()


def enforce_camera_runtime_policy(settings: dict[str, Any] | None = None, *, reason: str = "runtime policy"):
    current = settings or read_settings()
    manager = get_camera_sensor_manager()
    mode = str(current.get("usb_camera_mode", "sensor") or "sensor").lower()
    camera_index = int(current.get("camera_device", 0) or 0)
    manager.set_stream_settings(normalize_camera_stream_settings(current))
    manager.set_look_mode(current.get("camera_look_mode", "normal"))
    manager.set_camera_controls(normalize_camera_controls(current.get("camera_controls")))
    try:
        manager.motion_area_threshold = max(100, min(50000, int(current.get("usb_camera_motion_area_threshold", 1000))))
    except (TypeError, ValueError):
        manager.motion_area_threshold = 1000

    status = manager.status()
    runtime_mode = str(status.get("mode") or manager.mode)
    sensor_active = bool(status.get("sensor_active"))
    runtime_index = int(status.get("camera_index", manager.camera_index) or 0)

    def already(runtime: str) -> bool:
        return runtime_mode == runtime and runtime_index == camera_index and not sensor_active

    if not current.get("camera_enabled", True):
        if not already("off"):
            manager.set_mode("off", camera_index)
    elif current.get("remote_camera_privacy_mode", False):
        if not already("privacy"):
            manager.set_mode("privacy", camera_index)
    elif mode in {"sensor", "live"} and camera_runtime_claimed(current):
        manager.start(camera_index)
    elif mode in {"sensor", "live"}:
        if not already("off"):
            manager.set_mode("off", camera_index)
    elif mode in {"off", "privacy"}:
        if not already(mode):
            manager.set_mode(mode, camera_index)
    else:
        if not already("off"):
            manager.set_mode("off", camera_index)
    return manager


def camera_idle_watchdog_loop() -> None:
    while True:
        time.sleep(3.0)
        try:
            settings = read_settings()
            if not camera_runtime_claimed(settings):
                release_remote_camera_capture()
            enforce_camera_runtime_policy(settings, reason="camera page idle watchdog")
        except Exception:
            pass


def ensure_camera_idle_watchdog() -> None:
    global CAMERA_IDLE_WATCHDOG_STARTED
    with CAMERA_IDLE_WATCHDOG_LOCK:
        if CAMERA_IDLE_WATCHDOG_STARTED:
            return
        CAMERA_IDLE_WATCHDOG_STARTED = True
        threading.Thread(target=camera_idle_watchdog_loop, name="bedroom-dashboard-camera-idle-watchdog", daemon=True).start()


def remote_camera_guard(request: Request, token: str | None = None) -> dict[str, Any] | None:
    settings = read_settings()
    allowed, kind, message = remote_camera_network_allowed(settings, request)
    if not allowed:
        return {"ok": False, "error": message, "client_kind": kind}
    if settings.get("remote_camera_privacy_mode", True):
        return {"ok": False, "error": "Privacy mode is on. Camera stream is blocked.", "client_kind": kind}
    if not settings.get("camera_enabled", True):
        return {"ok": False, "error": "Camera is disabled in settings.", "client_kind": kind}
    if not token or token not in REMOTE_CAMERA_SESSIONS:
        return {"ok": False, "error": "Camera password login is required.", "client_kind": kind}
    REMOTE_CAMERA_SESSIONS[token]["last_seen"] = time.time()
    return None


def runtime_status() -> dict[str, Any]:
    seconds = max(0, int((datetime.now() - STARTED_AT).total_seconds()))
    return {"started_at": STARTED_AT.isoformat(timespec="seconds"), "seconds": seconds}


def missing_tool(name: str) -> dict[str, Any]:
    if is_windows():
        windows_installs = {
            "tailscale": "winget install Tailscale.Tailscale",
            "git": "winget install Git.Git",
            "ollama": "winget install Ollama.Ollama",
            "node": "winget install OpenJS.NodeJS.LTS",
        }
        if name in windows_installs:
            return {
                "ok": False,
                "error": f"{name} is missing. Install with: {windows_installs[name]}",
                "missing": name,
            }
    return {
        "ok": False,
        "error": f"{name} is missing. Install with: {DEVICE_TOOLS.get(name, 'install the required package')}",
        "missing": name,
    }


def is_windows() -> bool:
    return os.name == "nt"


def get_os_status() -> dict[str, Any]:
    system = platform.system()
    if system == "Windows":
        return {"name": "Windows", "supported": True}
    if system == "Linux":
        os_release = ""
        try:
            os_release = Path("/etc/os-release").read_text(encoding="utf-8", errors="ignore").lower()
        except OSError:
            pass
        name = "Ubuntu" if "ubuntu" in os_release else "Linux"
        return {"name": name, "supported": name == "Ubuntu"}
    return {"name": system or "Unknown", "supported": False}


def run_system(args: list[str], timeout: int = 10) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            args,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError:
        return missing_tool(args[0])
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"{args[0]} timed out."}
    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()
    if completed.returncode != 0:
        return {"ok": False, "error": stderr or stdout or f"{args[0]} failed.", "stdout": stdout}
    return {"ok": True, "stdout": stdout}


def clamp_percent(value: Any, minimum: int = 0, maximum: int = 100) -> int:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        number = minimum
    return max(minimum, min(maximum, number))


def normalize_brightness_percent(value: Any, maximum: Any = None) -> int | None:
    try:
        current = float(value)
    except (TypeError, ValueError):
        return None
    try:
        max_value = float(maximum)
    except (TypeError, ValueError):
        max_value = 0
    if max_value > 0 and current > 100:
        return clamp_percent(round((current / max_value) * 100), 1, 100)
    if current > 1000:
        return clamp_percent(round(current / 1000), 1, 100)
    return clamp_percent(current, 1, 100)


def windows_endpoint_volume() -> Any | None:
    if not is_windows():
        return None
    try:
        import comtypes
        from comtypes import CLSCTX_ALL
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

        try:
            comtypes.CoInitialize()
        except Exception:
            pass
        speakers = AudioUtilities.GetSpeakers()
        endpoint = getattr(speakers, "EndpointVolume", None)
        if endpoint is not None:
            return endpoint
        interface = speakers.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        return interface.QueryInterface(IAudioEndpointVolume)
    except Exception:
        return None


def windows_coreaudio_available() -> bool:
    return windows_endpoint_volume() is not None


def run_powershell(command: str, timeout: int = 10) -> dict[str, Any]:
    executable = shutil.which("powershell") or shutil.which("pwsh")
    if not executable:
        return {"ok": False, "error": "PowerShell is not available on this device."}
    return run_system([executable, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], timeout=timeout)


def nmcli_split(line: str) -> list[str]:
    parts: list[str] = []
    current = []
    escaped = False
    for char in line:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\":
            escaped = True
        elif char == ":":
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    parts.append("".join(current))
    return parts


def ollama_generate(model: str, prompt: str, timeout: int = 45) -> dict[str, Any]:
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
        return {"ok": True, "model": model, "reply": data.get("response", "").strip()}
    except requests.RequestException as error:
        start_result: dict[str, Any] | None = None
        if "Connection" in type(error).__name__ or "connection" in str(error).lower():
            try:
                start_result = start_ollama_server()
                if start_result.get("ok"):
                    response = requests.post(
                        f"{OLLAMA_URL}/api/generate",
                        json={"model": model, "prompt": prompt, "stream": False},
                        timeout=timeout,
                    )
                    response.raise_for_status()
                    data = response.json()
                    return {"ok": True, "model": model, "reply": data.get("response", "").strip(), "autostart": start_result}
            except Exception:
                pass
        return {
            "ok": False,
            "model": model,
            "error": f"Ollama is not running or model is missing: {error}",
            "autostart": start_result,
        }


def installed_ollama_models_from_disk() -> list[str]:
    library = OLLAMA_MODEL_DIR / "manifests" / "registry.ollama.ai" / "library"
    models: set[str] = set()
    if not library.exists():
        return []
    for model_dir in library.iterdir():
        if not model_dir.is_dir():
            continue
        for manifest in model_dir.iterdir():
            if manifest.is_file():
                tag = manifest.name
                models.add(model_dir.name if tag == "latest" else f"{model_dir.name}:{tag}")
    return sorted(models)


def ollama_status(timeout: float = 2.5, cache_ttl: float = 0.0) -> dict[str, Any]:
    cached = OLLAMA_STATUS_CACHE.get("data")
    if cache_ttl > 0 and isinstance(cached, dict) and time.time() - float(OLLAMA_STATUS_CACHE.get("at") or 0) < cache_ttl:
        return dict(cached)
    disk_models = installed_ollama_models_from_disk()
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=timeout)
        response.raise_for_status()
        data = response.json()
        models = [item.get("name") for item in data.get("models", []) if item.get("name")]
        result = {
            "ok": True,
            "url": OLLAMA_URL,
            "models": models,
            "disk_models": disk_models,
            "models_dir": str(OLLAMA_MODEL_DIR),
        }
    except requests.RequestException as error:
        result = {
            "ok": False,
            "url": OLLAMA_URL,
            "error": str(error),
            "models": disk_models,
            "disk_models": disk_models,
            "models_dir": str(OLLAMA_MODEL_DIR),
            "offline_models_available": bool(disk_models),
        }
    OLLAMA_STATUS_CACHE["at"] = time.time()
    OLLAMA_STATUS_CACHE["data"] = dict(result)
    return result


def find_ollama_executable() -> str | None:
    executable = shutil.which("ollama")
    if executable:
        return executable
    if is_windows():
        candidates = [
            Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe",
            Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "Ollama" / "ollama.exe",
        ]
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)
    return None


def start_ollama_server() -> dict[str, Any]:
    os.environ["OLLAMA_MODELS"] = str(OLLAMA_MODEL_DIR)
    OLLAMA_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    status = ollama_status(timeout=1.0, cache_ttl=0.0)
    if status.get("ok"):
        return {"ok": True, "message": "Ollama is already running.", "models_dir": str(OLLAMA_MODEL_DIR)}

    executable = find_ollama_executable()
    if not executable:
        return {"ok": False, "message": "Ollama is not installed. Run the setup file or install Ollama first."}

    try:
        if is_windows():
            subprocess.Popen(
                [executable, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                close_fds=True,
            )
        else:
            subprocess.Popen(
                [executable, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
                close_fds=True,
            )
        time.sleep(1.4)
        status = ollama_status(timeout=1.5, cache_ttl=0.0)
        return {
            "ok": bool(status.get("ok")),
            "message": "Ollama start requested." if status.get("ok") else f"Ollama start requested but not ready yet: {status.get('error', 'waiting')}",
            "models_dir": str(OLLAMA_MODEL_DIR),
        }
    except Exception as error:
        return {"ok": False, "message": f"Could not start Ollama: {error}", "models_dir": str(OLLAMA_MODEL_DIR)}


def launch_ai_model_download() -> dict[str, Any]:
    os.environ["OLLAMA_MODELS"] = str(OLLAMA_MODEL_DIR)
    OLLAMA_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    start_result = start_ollama_server()

    if is_windows():
        script = PROJECT_ROOT / "scripts" / "ai" / "download-ai-models-windows.ps1"
        powershell = shutil.which("powershell") or shutil.which("pwsh")
        if not powershell:
            return {"ok": False, "message": "PowerShell is missing, so model download cannot start.", "start": start_result}
        if not script.exists():
            return {"ok": False, "message": f"Missing script: {script}", "start": start_result}
        subprocess.Popen(
            [powershell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            close_fds=True,
        )
    else:
        script = PROJECT_ROOT / "scripts" / "ai" / "download-ai-models.sh"
        if not script.exists():
            return {"ok": False, "message": f"Missing script: {script}", "start": start_result}
        subprocess.Popen(
            ["bash", str(script)],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
        )

    return {
        "ok": True,
        "message": f"AI model download started for {len(BEDROOM_DASHBOARD_AI_MODELS)} models.",
        "models": BEDROOM_DASHBOARD_AI_MODELS,
        "models_dir": str(OLLAMA_MODEL_DIR),
        "start": start_result,
    }


def first_setting(settings: dict[str, Any], *keys: str, fallback: str = "") -> str:
    for key in keys:
        value = settings.get(key)
        if value:
            return str(value)
    return fallback


def choose_model(command: str, settings: dict[str, Any], easy: str | None, hard: str | None) -> tuple[str, str]:
    tier = str(first_setting(settings, "modelTier", "model_tier", fallback="auto")).lower()
    if tier in {"2.5", "easy", "fast"}:
        return "easy", first_setting(settings, "model25", "easy_model", fallback=easy or "gemma2:2b")
    if tier in {"3.5", "reason", "reasoning"}:
        return "reasoning", first_setting(settings, "model35", fallback=easy or hard or "phi3.5")
    if tier in {"4.5", "hard", "smart"}:
        return "hard", first_setting(settings, "model45", "hard_model", fallback=hard or "qwen2.5:3b")
    if tier in {"qwen", "code", "coding"}:
        return "coding", first_setting(settings, "qwenModel", fallback=hard or "qwen2.5:3b")
    hard_words = ("explain", "plan", "why", "write", "homework", "complex", "hard", "think", "research")
    use_hard = len(command) > 80 or any(word in command.lower() for word in hard_words)
    if use_hard:
        return "hard", hard or first_setting(settings, "hard_model", "model45", fallback="qwen2.5:3b")
    return "easy", easy or first_setting(settings, "easy_model", "model25", fallback="gemma2:2b")


def command_percent(command: str) -> int | None:
    match = re.search(r"(\d{1,3})\s*(?:percent|%)", command, re.IGNORECASE)
    if not match:
        return None
    return int(clamp_number(match.group(1), 0, 100, 0))


def command_minutes(command: str) -> int | None:
    match = re.search(r"(\d{1,3})\s*(?:minute|minutes|min)\b", command, re.IGNORECASE)
    if not match:
        return None
    return int(clamp_number(match.group(1), 1, 180, 10))


def assistant_action(action: str, reply: str, arguments: dict[str, Any] | None = None, source: str = "local-rules") -> dict[str, Any]:
    return {
        "ok": True,
        "source": source,
        "action": action,
        "arguments": arguments or {},
        "reply": reply,
        "confidence": 0.95 if source == "local-rules" else 0.75,
    }


def local_route(command: str) -> dict[str, Any] | None:
    clean = command.lower().strip()
    percent = command_percent(clean)
    minutes = command_minutes(clean)
    camera_match = re.search(r"\b(?:camera|cam|device)\s*(\d{1,2})\b", clean)
    routes: list[tuple[bool, str, str, dict[str, Any] | None]] = [
        (bool(re.search(r"\b(open|show|go to)\b.*\b(settings|tools)\b", clean)), "open_settings", "Opening settings.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\bdashboard\b", clean)), "open_dashboard", "Opening dashboard.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\b(clock|home)\b", clean)), "open_clock", "Opening clock.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\b(signal|radio|aircraft)\b", clean)), "open_signal", "Opening Signal Center.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\bradar\b", clean)), "open_radar", "Opening Radar.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\b(ollama|local ai|ai models?|model manager)\b", clean)), "open_ollama", "Opening Ollama AI.", None),
        (bool(re.search(r"\b(room|bedroom|esp32|indoor)\b.*\b(temp(?:erature)?|humidity|sensor|reading|climate|hot|cold|humid)\b|\b(temp(?:erature)?|humidity|hot|cold|humid)\b.*\b(room|bedroom|esp32|indoor)\b", clean)), "bedroom_status", "Reading the bedroom ESP32.", None),
        (bool(re.search(r"\b(open|show|go to|work on|add|save|edit)\b.*\b(projects?|arduino|pdf|files?|code|notes?)\b", clean)), "open_projects", "Opening Projects.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\b(bedroom|esp32|sensor hub)\b", clean)), "open_bedroom", "Opening My Bedroom.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\bmusic\b", clean)), "open_music", "Opening Music.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\bprojects?\b", clean)), "open_projects", "Opening Projects.", None),
        (bool(re.search(r"\b(open|show|go to)\b.*\b(camera|webcam|localhost camera)\b", clean)), "open_camera", "Opening camera.", None),
        ("alarm" in clean and ("open" in clean or "show" in clean), "open_alarm", "Opening alarms.", None),
        ("countdown" in clean and ("open" in clean or "show" in clean), "open_countdown", "Opening countdown.", None),
        ("stopwatch" in clean and ("open" in clean or "show" in clean), "open_stopwatch", "Opening stopwatch.", None),
        ("world clock" in clean and ("open" in clean or "show" in clean), "open_world_clock", "Opening world clock.", None),
        ("prayer focus" in clean and ("open" in clean or "show" in clean), "open_prayer_focus", "Opening prayer focus.", None),
        ("red mode" in clean or "red night" in clean, "theme_red_night", "Switching to red night mode.", None),
        ("dark mode" in clean or "middle mode" in clean, "theme_dark", "Switching to dark mode.", None),
        ("light mode" in clean or "white mode" in clean, "theme_light", "Switching to light mode.", None),
        ("auto theme" in clean or clean == "auto", "theme_auto", "Auto theme is on.", None),
        ("study mode" in clean, "study_mode", "Study mode is ready.", None),
        ("sleep mode" in clean, "sleep_mode", "Sleep mode is on.", None),
        ("show weather" in clean, "show_weather", "Showing weather.", None),
        ("show prayer" in clean, "show_prayer", "Showing prayer times.", None),
        (bool(minutes and "countdown" in clean and ("start" in clean or "set" in clean)), "start_countdown", f"Starting countdown for {minutes} minutes.", {"minutes": minutes}),
        (bool(minutes and ("timer" in clean or "start" in clean)), "start_timer", f"Starting timer for {minutes} minutes.", {"minutes": minutes}),
        ("pause countdown" in clean, "pause_countdown", "Countdown paused.", None),
        ("reset countdown" in clean, "reset_countdown", "Countdown reset.", None),
        ("start stopwatch" in clean, "start_stopwatch", "Stopwatch started.", None),
        ("stop stopwatch" in clean or "pause stopwatch" in clean, "stop_stopwatch", "Stopwatch paused.", None),
        ("reset stopwatch" in clean, "reset_stopwatch", "Stopwatch reset.", None),
        (bool(percent is not None and "volume" in clean), "set_volume", f"Volume set to {percent} percent.", {"percent": percent}),
        ("mute music" in clean or "mute volume" in clean, "mute_volume", "Audio muted.", None),
        (bool(percent is not None and ("brightness" in clean or "screen" in clean)), "set_brightness", f"Brightness set to {percent} percent.", {"percent": percent}),
        ("brighter" in clean, "brighter", "Screen is brighter.", None),
        ("dim screen" in clean or "dim the screen" in clean, "dim_screen", "Screen is dim.", None),
        ("turn on night light" in clean, "night_light_on", "Night Light is on.", None),
        ("turn off night light" in clean, "night_light_off", "Night Light is off.", None),
        (bool(camera_match or ("switch" in clean and "camera" in clean)), "switch_camera", "Switching camera.", {"camera_index": int(camera_match.group(1)) if camera_match else None}),
        ("health summary" in clean or "summarize health" in clean or "system status" in clean, "health_summary", "Opening health summary.", None),
        ("repair health" in clean or "fix health" in clean or "fix backend" in clean or "fix ai" in clean, "health_repair", "Starting health repair.", None),
        ("download ai" in clean or "install ai" in clean or "pull models" in clean, "download_ai_models", "Downloading local AI models.", None),
        ("easy model" in clean or "fast model" in clean, "set_model_easy", "Easy model selected.", None),
        ("hard model" in clean or "smart model" in clean, "set_model_hard", "Hard model selected.", None),
        ("auto model" in clean, "set_model_auto", "Auto model selected.", None),
        ("turn off athan" in clean or "disable athan" in clean or "mute athan" in clean, "turn_off_athan", "Athan reminders disabled.", None),
        ("turn on athan" in clean or "enable athan" in clean, "turn_on_athan", "Athan reminders enabled.", None),
    ]
    for matched, action, reply, arguments in routes:
        if matched:
            return assistant_action(action, reply, arguments)
    return None


def extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    clean = text.strip()
    clean = re.sub(r"^```(?:json)?\s*", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean)
    start = clean.find("{")
    end = clean.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(clean[start:end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def normalize_assistant_ai_action(parsed: dict[str, Any], command: str, model: str, model_kind: str) -> dict[str, Any]:
    action = str(parsed.get("action") or parsed.get("intent") or "reply").strip()
    aliases = {
        "open_local_camera": "open_camera",
        "open_remote_camera": "open_camera",
        "open_camera_page": "open_camera",
        "open_time_tools": "open_alarm",
        "red_mode": "theme_red_night",
        "dark_mode": "theme_dark",
        "light_mode": "theme_light",
        "auto_theme": "theme_auto",
        "mute_music": "mute_volume",
    }
    action = aliases.get(action, action)
    if action not in ASSISTANT_ACTIONS:
        action = "chat"
    arguments = parsed.get("arguments") or parsed.get("args") or {}
    if not isinstance(arguments, dict):
        arguments = {}
    if action in {"start_timer", "start_countdown"} and "minutes" not in arguments:
        minutes = command_minutes(command)
        if minutes:
            arguments["minutes"] = minutes
    if action in {"set_volume", "set_brightness"} and "percent" not in arguments:
        percent = command_percent(command)
        if percent is not None:
            arguments["percent"] = percent
    reply = str(parsed.get("reply") or parsed.get("message") or "").strip()
    if not reply:
        reply = "Done." if action not in {"chat", "reply"} else "I understood you, but I need a little more detail."
    return {
        "ok": True,
        "source": "ollama-action",
        "action": action,
        "arguments": arguments,
        "reply": reply,
        "model": model,
        "model_kind": model_kind,
        "confidence": clamp_number(parsed.get("confidence"), 0, 1, 0.72),
    }


def build_command_classifier_prompt(command: str, settings: dict[str, Any], context: dict[str, Any] | None = None) -> str:
    assistant_name = first_setting(settings, "assistantName", "assistant_name", fallback="Nexora")
    language = first_setting(settings, "replyLanguage", "reply_language", fallback="both")
    allowed = ", ".join(sorted(ASSISTANT_ACTIONS))
    return (
        f"You are {assistant_name}, the local Bedroom Dashboard bedroom kiosk command router.\n"
        "Return ONLY one JSON object. No markdown, no explanation outside JSON.\n"
        "Schema: {\"action\":\"one_allowed_action\",\"arguments\":{},\"reply\":\"short spoken reply\",\"confidence\":0.0-1.0}\n"
        f"Allowed actions: {allowed}.\n"
        "Use an action when the user wants the kiosk to do something. Use chat when the user asks a normal question or needs an explanation.\n"
        "For start_timer/start_countdown include {\"minutes\": number}. For set_volume/set_brightness include {\"percent\": number}. For switch_camera include {\"camera_index\": number} when known.\n"
        f"Reply language mode is {language}; keep reply short and friendly.\n"
        f"Context JSON: {json.dumps(context or {}, ensure_ascii=False)[:1200]}\n"
        f"User command: {command}\n"
        "JSON:"
    )


def configured_usb_camera_sensor(start: bool = True):
    settings = read_settings()
    manager = get_camera_sensor_manager()
    manager.set_stream_settings(normalize_camera_stream_settings(settings))
    manager.set_look_mode(settings.get("camera_look_mode", "normal"))
    manager.set_camera_controls(normalize_camera_controls(settings.get("camera_controls")))
    try:
        manager.motion_area_threshold = max(100, min(50000, int(settings.get("usb_camera_motion_area_threshold", 1000))))
    except (TypeError, ValueError):
        manager.motion_area_threshold = 1000
    if start:
        return enforce_camera_runtime_policy(settings)
    return manager


def read_camera_brightness(device: int = 0) -> dict[str, Any]:
    manager = configured_usb_camera_sensor(start=True)
    brightness = manager.brightness()
    status = manager.status()
    if status.get("error") and not status.get("connected"):
        return {"ok": False, "error": status.get("error"), "device": device, **brightness}
    return {"ok": True, "brightness": brightness.get("raw", 0), "percent": brightness.get("brightness", 0), "level": brightness.get("level"), "device": device}


ensure_camera_idle_watchdog()


def decide_theme(brightness: int | None) -> dict[str, Any]:
    now = datetime.now()
    hour = now.hour + now.minute / 60
    is_night = now.hour >= 18 or now.hour < 5
    if 5 <= hour < 7:
        return {"theme": "dawn", "reason": "Morning dawn animation"}
    if 7 <= hour < 12:
        return {"theme": "morning-sun", "reason": "Morning sun mode"}
    if brightness is None:
        return {"theme": "red-night" if is_night else "light", "reason": "No brightness reading"}
    if is_night and brightness < 40:
        return {"theme": "red-night", "reason": "Night and dark room"}
    if is_night:
        return {"theme": "dark", "reason": "Night with room light"}
    if brightness < 40:
        return {"theme": "dark-red", "reason": "Day but dark room"}
    if brightness > 80:
        return {"theme": "light", "reason": "Day and bright room"}
    return {"theme": "dark", "reason": "Medium room light"}


def speak_in_background(text: str, rate: int | None, volume: float | None) -> dict[str, Any]:
    def run() -> None:
        try:
            import pyttsx3

            engine = pyttsx3.init()
            if rate is not None:
                engine.setProperty("rate", rate)
            if volume is not None:
                engine.setProperty("volume", max(0, min(1, volume)))
            engine.say(text)
            engine.runAndWait()
        except Exception:
            try:
                subprocess.run(["espeak", text], check=False, timeout=20)
            except Exception:
                pass

    threading.Thread(target=run, daemon=True).start()
    return {"ok": True, "message": "Speech request queued."}


def get_brightness() -> dict[str, Any]:
    if is_windows():
        command = "(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1 -ExpandProperty CurrentBrightness)"
        result = run_powershell(command, timeout=8)
        if result["ok"]:
            match = re.search(r"(\d+(?:\.\d+)?)", result.get("stdout", ""))
            percent = normalize_brightness_percent(match.group(1) if match else None)
            if percent is not None:
                return {"ok": True, "supported": True, "tool": "powershell-wmi", "percent": percent, "raw": result.get("stdout", "")}
        return {
            "ok": False,
            "supported": False,
            "tool": "powershell-wmi",
            "error": result.get("error") or "Windows brightness control is not available on this display.",
        }
    if shutil.which("brightnessctl"):
        result = run_system(["brightnessctl", "-m"])
        if not result["ok"]:
            return result
        fields = result["stdout"].split(",")
        percent_match = re.search(r"(\d+(?:\.\d+)?)\s*%", result["stdout"])
        if percent_match:
            percent = clamp_percent(percent_match.group(1), 1, 100)
        else:
            current = fields[2] if len(fields) >= 3 else None
            maximum = fields[3] if len(fields) >= 4 else None
            percent = normalize_brightness_percent(current, maximum)
        return {"ok": True, "supported": True, "tool": "brightnessctl", "percent": percent}
    if shutil.which("xrandr"):
        return {
            "ok": True,
            "supported": True,
            "tool": "xrandr",
            "percent": 100,
            "message": "xrandr brightness fallback cannot read the exact current hardware brightness.",
        }
    return {
        **missing_tool("brightnessctl"),
        "supported": False,
        "error": "Brightness control is not available on this device. brightnessctl is missing. Install with: sudo apt install brightnessctl",
    }


def connected_xrandr_outputs() -> list[str]:
    result = run_system(["xrandr", "--current"], timeout=5)
    if not result["ok"]:
        return []
    outputs = []
    for line in result["stdout"].splitlines():
        match = re.match(r"^(\S+)\s+connected\b", line)
        if match:
            outputs.append(match.group(1))
    return outputs


def set_brightness(payload: dict[str, Any]) -> dict[str, Any]:
    current = get_brightness()
    if not current.get("supported"):
        return current
    if "action" in payload:
        base = current.get("percent") or 50
        step = int(payload.get("step", 10))
        percent = base + step if payload["action"] == "up" else base - step
    else:
        percent = payload.get("percent", current.get("percent") or 50)
    percent = clamp_percent(percent, 1, 100)

    if current.get("tool") == "brightnessctl":
        result = run_system(["brightnessctl", "set", f"{percent}%"])
        if not result["ok"]:
            return result
        return {**get_brightness(), "message": f"Brightness set to {percent}%."}

    if current.get("tool") == "powershell-wmi":
        command = (
            "$method = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Select-Object -First 1; "
            f"Invoke-CimMethod -InputObject $method -MethodName WmiSetBrightness -Arguments @{{Timeout=1; Brightness={percent}}} | Out-Null"
        )
        result = run_powershell(command, timeout=8)
        if not result["ok"]:
            return {
                "ok": False,
                "supported": False,
                "tool": "powershell-wmi",
                "error": result.get("error") or "Windows brightness control failed.",
            }
        return {**get_brightness(), "message": f"Brightness set to {percent}%."}

    outputs = connected_xrandr_outputs()
    if not outputs:
        return {"ok": False, "error": "Brightness control is not available on this device."}
    brightness = f"{percent / 100:.2f}"
    for output in outputs:
        result = run_system(["xrandr", "--output", output, "--brightness", brightness], timeout=5)
        if not result["ok"]:
            return result
    return {"ok": True, "supported": True, "tool": "xrandr", "percent": percent, "message": f"Brightness set to {percent}%."}


def get_volume() -> dict[str, Any]:
    if is_windows():
        endpoint = windows_endpoint_volume()
        if endpoint is not None:
            try:
                percent = clamp_percent(round(float(endpoint.GetMasterVolumeLevelScalar()) * 100), 0, 100)
                muted = bool(endpoint.GetMute())
                return {"ok": True, "supported": True, "tool": "windows-coreaudio", "percent": percent, "muted": muted}
            except Exception as error:
                return {
                    "ok": False,
                    "supported": False,
                    "tool": "windows-coreaudio",
                    "error": f"Windows volume read failed: {error}",
                }
        return {
            "ok": False,
            "supported": False,
            "error": "Windows volume control needs pycaw/comtypes. Install with: python -m pip install pycaw comtypes",
        }
    if shutil.which("wpctl"):
        volume = run_system(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
        if not volume["ok"]:
            return volume
        match = re.search(r"Volume:\s+([0-9.]+)", volume["stdout"])
        percent = round(float(match.group(1)) * 100) if match else None
        muted = "[MUTED]" in volume["stdout"]
        return {"ok": True, "tool": "wpctl", "percent": percent, "muted": muted}
    if shutil.which("pactl"):
        volume = run_system(["pactl", "get-sink-volume", "@DEFAULT_SINK@"])
        mute = run_system(["pactl", "get-sink-mute", "@DEFAULT_SINK@"])
        if not volume["ok"]:
            return volume
        match = re.search(r"(\d+)%", volume["stdout"])
        percent = int(match.group(1)) if match else None
        muted = "yes" in mute.get("stdout", "").lower()
        return {"ok": True, "tool": "pactl", "percent": percent, "muted": muted}
    return missing_tool("wpctl")


def set_volume(payload: dict[str, Any]) -> dict[str, Any]:
    current = get_volume()
    if not current["ok"]:
        return current
    if "action" in payload:
        base = current.get("percent") or 50
        step = int(payload.get("step", 5))
        percent = base + step if payload["action"] == "up" else base - step
    else:
        percent = payload.get("percent", current.get("percent") or 50)
    percent = clamp_percent(percent, 0, 100)
    unmute_after_change = percent > 0 and bool(payload.get("unmute", True))
    if current["tool"] == "windows-coreaudio":
        endpoint = windows_endpoint_volume()
        if endpoint is None:
            return {"ok": False, "supported": False, "error": "Windows CoreAudio backend is not available."}
        try:
            endpoint.SetMasterVolumeLevelScalar(percent / 100, None)
            if unmute_after_change:
                endpoint.SetMute(0, None)
        except Exception as error:
            return {"ok": False, "supported": False, "error": f"Windows volume update failed: {error}"}
        return {**get_volume(), "message": f"Volume set to {percent}%."}
    if current["tool"] == "wpctl":
        result = run_system(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", f"{percent / 100:.2f}"])
        if result["ok"] and unmute_after_change:
            run_system(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "0"])
    else:
        result = run_system(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{percent}%"])
        if result["ok"] and unmute_after_change:
            run_system(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "false"])
    if not result["ok"]:
        return result
    return {**get_volume(), "message": f"Volume set to {percent}%."}


def set_mute(payload: dict[str, Any]) -> dict[str, Any]:
    current = get_volume()
    if not current["ok"]:
        return current
    if "muted" in payload:
        next_state = bool(payload["muted"])
    else:
        next_state = not bool(current.get("muted"))
    if current["tool"] == "windows-coreaudio":
        endpoint = windows_endpoint_volume()
        if endpoint is None:
            return {"ok": False, "supported": False, "error": "Windows CoreAudio backend is not available."}
        try:
            endpoint.SetMute(1 if next_state else 0, None)
        except Exception as error:
            return {"ok": False, "supported": False, "error": f"Windows mute update failed: {error}"}
        return {**get_volume(), "message": "Audio muted." if next_state else "Audio unmuted."}
    if current["tool"] == "wpctl":
        result = run_system(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "1" if next_state else "0"])
    else:
        result = run_system(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "true" if next_state else "false"])
    if not result["ok"]:
        return result
    return {**get_volume(), "message": "Audio muted." if next_state else "Audio unmuted."}


def get_night_light() -> dict[str, Any]:
    if is_windows():
        return {
            "ok": False,
            "supported": False,
            "error": "Windows Night Light is managed in Windows Settings. GNOME gsettings is only for Ubuntu.",
        }
    if not shutil.which("gsettings"):
        return missing_tool("gsettings")
    enabled = run_system(["gsettings", "get", "org.gnome.settings-daemon.plugins.color", "night-light-enabled"])
    temperature = run_system(["gsettings", "get", "org.gnome.settings-daemon.plugins.color", "night-light-temperature"])
    if not enabled["ok"]:
        return enabled
    temp_match = re.search(r"(\d+)", temperature.get("stdout", ""))
    return {
        "ok": True,
        "tool": "gsettings",
        "enabled": "true" in enabled["stdout"].lower(),
        "temperature": int(temp_match.group(1)) if temp_match else None,
    }


def set_night_light(payload: dict[str, Any]) -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "error": "Windows Night Light cannot be changed by this backend yet."}
    if not shutil.which("gsettings"):
        return missing_tool("gsettings")
    if "enabled" in payload:
        result = run_system([
            "gsettings",
            "set",
            "org.gnome.settings-daemon.plugins.color",
            "night-light-enabled",
            "true" if payload["enabled"] else "false",
        ])
        if not result["ok"]:
            return result
    if "temperature" in payload:
        temperature = max(1000, min(10000, int(payload["temperature"])))
        result = run_system([
            "gsettings",
            "set",
            "org.gnome.settings-daemon.plugins.color",
            "night-light-temperature",
            str(temperature),
        ])
        if not result["ok"]:
            return result
    return {**get_night_light(), "message": "Night Light updated."}


def get_battery_status() -> dict[str, Any]:
    if is_windows() and shutil.which("powershell"):
        result = run_system([
            "powershell",
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress",
        ], timeout=8)
        if not result["ok"] or not result.get("stdout"):
            return {"ok": True, "supported": False, "percent": None, "charging": None, "message": "No battery was found."}
        try:
            data = json.loads(result["stdout"])
            status = int(data.get("BatteryStatus", 0) or 0)
            return {
                "ok": True,
                "supported": True,
                "tool": "powershell",
                "percent": int(data.get("EstimatedChargeRemaining", 0)),
                "charging": status in {2, 6, 7, 8, 9},
            }
        except (TypeError, ValueError, json.JSONDecodeError):
            return {"ok": False, "error": "Could not parse Windows battery status."}

    batteries = sorted(Path("/sys/class/power_supply").glob("BAT*"))
    if batteries:
        battery = batteries[0]
        try:
            percent = int((battery / "capacity").read_text(encoding="utf-8").strip())
            status = (battery / "status").read_text(encoding="utf-8").strip().lower()
            return {
                "ok": True,
                "supported": True,
                "tool": "sysfs",
                "percent": percent,
                "charging": status in {"charging", "full"},
                "status": status,
            }
        except OSError as error:
            return {"ok": False, "error": f"Could not read battery status: {error}"}

    if shutil.which("upower"):
        devices = run_system(["upower", "-e"], timeout=6)
        if devices["ok"]:
            battery_paths = [line for line in devices["stdout"].splitlines() if "battery" in line.lower()]
            if battery_paths:
                info = run_system(["upower", "-i", battery_paths[0]], timeout=6)
                if info["ok"]:
                    pct_match = re.search(r"percentage:\s+(\d+)%", info["stdout"], re.IGNORECASE)
                    state_match = re.search(r"state:\s+(.+)", info["stdout"], re.IGNORECASE)
                    state = state_match.group(1).strip().lower() if state_match else ""
                    return {
                        "ok": True,
                        "supported": True,
                        "tool": "upower",
                        "percent": int(pct_match.group(1)) if pct_match else None,
                        "charging": state in {"charging", "fully-charged"},
                        "status": state,
                    }
    return {"ok": True, "supported": False, "percent": None, "charging": None, "message": "No battery was found."}


def normalize_power_mode(value: Any) -> str:
    clean = str(value or "").strip().lower().replace("_", "-").replace(" ", "-")
    aliases = {
        "battery": "battery-saver",
        "battery-saver": "battery-saver",
        "power-saver": "battery-saver",
        "save": "battery-saver",
        "normal": "normal",
        "balanced": "normal",
        "performance": "performance",
        "high": "performance",
    }
    return aliases.get(clean, "normal")


def get_power_mode() -> dict[str, Any]:
    if is_windows() and shutil.which("powercfg"):
        result = run_system(["powercfg", "/getactivescheme"], timeout=8)
        if not result["ok"]:
            return result
        output = result["stdout"].lower()
        if "power saver" in output:
            mode = "battery-saver"
        elif "high performance" in output or "ultimate performance" in output:
            mode = "performance"
        else:
            mode = "normal"
        return {"ok": True, "supported": True, "tool": "powercfg", "mode": mode, "raw": result["stdout"]}

    if shutil.which("powerprofilesctl"):
        result = run_system(["powerprofilesctl", "get"], timeout=6)
        if not result["ok"]:
            return result
        raw = result["stdout"].strip()
        mode = "battery-saver" if raw == "power-saver" else "normal" if raw == "balanced" else raw
        return {"ok": True, "supported": True, "tool": "powerprofilesctl", "mode": mode, "raw": raw}
    return {**missing_tool("powerprofilesctl"), "supported": False}


def set_power_mode(payload: dict[str, Any]) -> dict[str, Any]:
    mode = normalize_power_mode(payload.get("mode"))
    if is_windows() and shutil.which("powercfg"):
        scheme = {
            "battery-saver": "SCHEME_MAX",
            "normal": "SCHEME_BALANCED",
            "performance": "SCHEME_MIN",
        }[mode]
        result = run_system(["powercfg", "/setactive", scheme], timeout=8)
        if not result["ok"]:
            return result
        return {**get_power_mode(), "message": f"Power mode set to {mode}."}

    if not shutil.which("powerprofilesctl"):
        return {**missing_tool("powerprofilesctl"), "supported": False}
    profile = "power-saver" if mode == "battery-saver" else "balanced" if mode == "normal" else "performance"
    result = run_system(["powerprofilesctl", "set", profile], timeout=8)
    if not result["ok"]:
        return result
    return {**get_power_mode(), "message": f"Power mode set to {mode}."}


def get_do_not_disturb() -> dict[str, Any]:
    if is_windows():
        return {"ok": True, "supported": False, "enabled": None, "message": "Windows Do Not Disturb is managed in Windows Settings."}
    if not shutil.which("gsettings"):
        return missing_tool("gsettings")
    result = run_system(["gsettings", "get", "org.gnome.desktop.notifications", "show-banners"], timeout=6)
    if not result["ok"]:
        return result
    return {"ok": True, "supported": True, "tool": "gsettings", "enabled": "false" in result["stdout"].lower()}


def set_do_not_disturb(payload: dict[str, Any]) -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "error": "Windows Do Not Disturb cannot be changed by this backend yet."}
    if not shutil.which("gsettings"):
        return missing_tool("gsettings")
    enabled = bool(payload.get("enabled"))
    result = run_system([
        "gsettings",
        "set",
        "org.gnome.desktop.notifications",
        "show-banners",
        "false" if enabled else "true",
    ], timeout=6)
    if not result["ok"]:
        return result
    return {**get_do_not_disturb(), "message": "Do Not Disturb is on." if enabled else "Do Not Disturb is off."}


def get_airplane_mode() -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "error": "Windows Airplane mode is not implemented yet. Use Windows quick settings for now."}
    wifi = get_wifi_status()
    bluetooth = get_bluetooth_status()
    wifi_on = bool(wifi.get("enabled")) if wifi.get("ok") else None
    bluetooth_on = bool(bluetooth.get("enabled")) if bluetooth.get("ok") else None
    if wifi_on is None and bluetooth_on is None:
        return {"ok": False, "error": "Airplane mode needs nmcli or bluetoothctl."}
    enabled = (wifi_on is False or wifi_on is None) and (bluetooth_on is False or bluetooth_on is None)
    return {"ok": True, "supported": True, "enabled": enabled, "wifi": wifi, "bluetooth": bluetooth}


def set_airplane_mode(payload: dict[str, Any]) -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "error": "Windows Airplane mode cannot be changed by this backend yet."}
    enabled = bool(payload.get("enabled"))
    errors = []
    if shutil.which("nmcli"):
        wifi_result = run_system(["nmcli", "radio", "wifi", "off" if enabled else "on"], timeout=8)
        if not wifi_result["ok"]:
            errors.append(wifi_result.get("error", "Wi-Fi toggle failed."))
    if shutil.which("bluetoothctl"):
        bluetooth_result = run_system(["bluetoothctl", "power", "off" if enabled else "on"], timeout=8)
        if not bluetooth_result["ok"]:
            errors.append(bluetooth_result.get("error", "Bluetooth toggle failed."))
    if errors:
        return {"ok": False, "error": " ".join(errors)}
    status = get_airplane_mode()
    return {**status, "message": "Airplane mode is on." if enabled else "Airplane mode is off."}


def get_tailscale_status() -> dict[str, Any]:
    tailscale = find_tool("tailscale")
    if not tailscale:
        return missing_tool("tailscale")
    result = run_system([tailscale, "status", "--json"], timeout=8)
    if result["ok"]:
        try:
            data = json.loads(result["stdout"])
            backend_state = data.get("BackendState", "")
            return {
                "ok": True,
                "tool": "tailscale",
                "enabled": backend_state.lower() == "running",
                "state": backend_state or "unknown",
                "self": data.get("Self", {}),
            }
        except json.JSONDecodeError:
            pass
    fallback = run_system([tailscale, "status"], timeout=8)
    if not fallback["ok"]:
        return fallback
    stdout = fallback["stdout"]
    stopped = "stopped" in stdout.lower() or "logged out" in stdout.lower()
    return {"ok": True, "tool": "tailscale", "enabled": not stopped, "state": "running" if not stopped else "stopped", "raw": stdout}


def set_tailscale(payload: dict[str, Any]) -> dict[str, Any]:
    tailscale = find_tool("tailscale")
    if not tailscale:
        return missing_tool("tailscale")
    enabled = bool(payload.get("enabled"))
    result = run_system([tailscale, "up" if enabled else "down"], timeout=35)
    if not result["ok"]:
        return result
    if enabled and payload.get("serve") is True:
        serve_result = run_system([tailscale, "serve", "--bg", "5173"], timeout=20)
        if not serve_result["ok"]:
            return serve_result
        return {**get_tailscale_status(), "message": "Tailscale VPN is on and serving Bedroom Dashboard."}
    if payload.get("serve") is False:
        run_system([tailscale, "serve", "reset"], timeout=12)
    return {**get_tailscale_status(), "message": "Tailscale VPN is on." if enabled else "Tailscale VPN is off."}


def get_wifi_status() -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "error": "Windows Wi-Fi control is not implemented yet. Ubuntu uses nmcli."}
    if not shutil.which("nmcli"):
        return missing_tool("nmcli")
    radio = run_system(["nmcli", "radio", "wifi"])
    active = run_system(["nmcli", "-t", "-f", "ACTIVE,SSID", "dev", "wifi", "list", "--rescan", "no"], timeout=8)
    connected = ""
    if active["ok"]:
        for line in active["stdout"].splitlines():
            fields = nmcli_split(line)
            if len(fields) >= 2 and fields[0] == "yes":
                connected = fields[1]
                break
    return {
        "ok": True,
        "tool": "nmcli",
        "enabled": radio.get("stdout", "").strip().lower() == "enabled",
        "connected": connected,
    }


def scan_wifi() -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "networks": [], "error": "Windows Wi-Fi scanning is not implemented yet. Use Windows network settings for now."}
    if not shutil.which("nmcli"):
        return missing_tool("nmcli")
    result = run_system(["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY,IN-USE", "dev", "wifi", "list", "--rescan", "yes"], timeout=18)
    if not result["ok"]:
        return result
    networks = []
    seen = set()
    for line in result["stdout"].splitlines():
        fields = nmcli_split(line)
        if len(fields) < 4 or not fields[0] or fields[0] in seen:
            continue
        seen.add(fields[0])
        networks.append({
            "ssid": fields[0],
            "signal": fields[1],
            "security": fields[2],
            "active": fields[3] == "*",
        })
    return {"ok": True, "networks": networks, "message": "Wi-Fi scan complete."}


def connect_wifi(payload: dict[str, Any]) -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "error": "Windows Wi-Fi connect is not implemented yet. Use Windows network settings for now."}
    if not shutil.which("nmcli"):
        return missing_tool("nmcli")
    ssid = str(payload.get("ssid", "")).strip()
    password = str(payload.get("password", ""))
    if not ssid:
        return {"ok": False, "error": "Wi-Fi SSID is required."}
    args = ["nmcli", "dev", "wifi", "connect", ssid]
    if password:
        args += ["password", password]
    result = run_system(args, timeout=30)
    if not result["ok"]:
        return result
    return {**get_wifi_status(), "message": f"Connected to {ssid}."}


def toggle_wifi(payload: dict[str, Any]) -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "error": "Windows Wi-Fi toggle is not implemented yet. Use Windows network settings for now."}
    if not shutil.which("nmcli"):
        return missing_tool("nmcli")
    enabled = payload.get("enabled")
    if enabled is None:
        current = get_wifi_status()
        enabled = not bool(current.get("enabled"))
    result = run_system(["nmcli", "radio", "wifi", "on" if enabled else "off"])
    if not result["ok"]:
        return result
    return {**get_wifi_status(), "message": "Wi-Fi is on." if enabled else "Wi-Fi is off."}


def get_bluetooth_status() -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "error": "Windows Bluetooth control is not implemented yet. Ubuntu uses bluetoothctl."}
    if not shutil.which("bluetoothctl"):
        return missing_tool("bluetoothctl")
    result = run_system(["bluetoothctl", "show"], timeout=8)
    if not result["ok"]:
        return result
    powered = bool(re.search(r"Powered:\s+yes", result["stdout"], re.IGNORECASE))
    return {"ok": True, "tool": "bluetoothctl", "enabled": powered}


def bluetooth_devices(paired: bool = False) -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "devices": [], "error": "Windows Bluetooth device control is not implemented yet."}
    if not shutil.which("bluetoothctl"):
        return missing_tool("bluetoothctl")
    args = ["bluetoothctl", "paired-devices"] if paired else ["bluetoothctl", "devices"]
    result = run_system(args, timeout=8)
    if not result["ok"]:
        return result
    devices = []
    for line in result["stdout"].splitlines():
        match = re.match(r"Device\s+([0-9A-Fa-f:]+)\s+(.+)", line.strip())
        if match:
            devices.append({"address": match.group(1), "name": match.group(2)})
    return {"ok": True, "devices": devices}


def scan_bluetooth() -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "devices": [], "error": "Windows Bluetooth scanning is not implemented yet. Use Windows Bluetooth settings for now."}
    if not shutil.which("bluetoothctl"):
        return missing_tool("bluetoothctl")
    run_system(["bluetoothctl", "power", "on"], timeout=6)
    run_system(["bluetoothctl", "--timeout", "8", "scan", "on"], timeout=12)
    return {**bluetooth_devices(False), "message": "Bluetooth scan complete."}


def toggle_bluetooth(payload: dict[str, Any]) -> dict[str, Any]:
    if is_windows():
        return {"ok": False, "supported": False, "error": "Windows Bluetooth toggle is not implemented yet. Use Windows Bluetooth settings for now."}
    if not shutil.which("bluetoothctl"):
        return missing_tool("bluetoothctl")
    enabled = payload.get("enabled")
    if enabled is None:
        current = get_bluetooth_status()
        enabled = not bool(current.get("enabled"))
    result = run_system(["bluetoothctl", "power", "on" if enabled else "off"], timeout=8)
    if not result["ok"]:
        return result
    return {**get_bluetooth_status(), "message": "Bluetooth is on." if enabled else "Bluetooth is off."}


def bluetooth_action(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not shutil.which("bluetoothctl"):
        return missing_tool("bluetoothctl")
    address = str(payload.get("address", payload.get("mac", ""))).strip()
    if not re.match(r"^[0-9A-Fa-f:]{17}$", address):
        return {"ok": False, "error": "Bluetooth device address is required."}
    result = run_system(["bluetoothctl", action, address], timeout=24)
    if not result["ok"]:
        return result
    return {"ok": True, "message": f"Bluetooth {action} command sent.", "address": address}


@app.get("/api/status")
def api_status() -> dict[str, Any]:
    return {
        "ok": True,
        "name": APP_NAME,
        "time": datetime.now().isoformat(timespec="seconds"),
        "runtime": runtime_status(),
        "ollama": ollama_status(timeout=0.45, cache_ttl=10.0),
    }


@app.get("/api/settings")
def api_get_settings() -> dict[str, Any]:
    return {"ok": True, "settings": read_settings()}


@app.post("/api/settings")
def api_post_settings(payload: dict[str, Any]) -> dict[str, Any]:
    patch = payload.get("settings", payload)
    return {"ok": True, "settings": patch_settings(patch)}


@app.post("/api/command")
def api_command(payload: CommandRequest) -> dict[str, Any]:
    local = local_route(payload.command)
    if local:
        return local

    settings = {**read_settings(), **(payload.settings or {})}
    model_kind, model = choose_model(payload.command, settings, payload.easy_model, payload.hard_model)
    prompt = build_command_classifier_prompt(payload.command, settings, payload.context)
    result = ollama_generate(model, prompt, timeout=45 if model_kind in {"easy", "reasoning"} else 90)
    if not result.get("ok"):
        return {
            "ok": False,
            "source": "offline-fallback",
            "action": "reply",
            "reply": "Local AI is offline right now. Basic built-in commands still work, but Ollama needs to be running for smart command understanding.",
            "model": model,
            "model_kind": model_kind,
            "error": result.get("error"),
            "ollama": ollama_status(timeout=0.6, cache_ttl=0.0),
        }
    parsed = extract_json_object(result.get("reply", ""))
    if parsed:
        return normalize_assistant_ai_action(parsed, payload.command, model, model_kind)
    return {
        "ok": True,
        "source": "ollama-chat",
        "action": "chat",
        "reply": result.get("reply") or "I heard you, but I could not turn that into a kiosk command.",
        "model": model,
        "model_kind": model_kind,
        "confidence": 0.45,
    }


@app.get("/api/ai/models")
def api_ai_models() -> dict[str, Any]:
    status = ollama_status(timeout=0.8, cache_ttl=0.0)
    return {
        "ok": bool(status.get("ok") or status.get("disk_models")),
        "required": BEDROOM_DASHBOARD_AI_MODELS,
        **status,
    }


@app.post("/api/ai/easy")
def api_ai_easy(payload: PromptRequest) -> dict[str, Any]:
    settings = read_settings()
    return ollama_generate(payload.model or settings["easy_model"], payload.prompt, timeout=30)


@app.post("/api/ai/hard")
def api_ai_hard(payload: PromptRequest) -> dict[str, Any]:
    settings = read_settings()
    return ollama_generate(payload.model or settings["hard_model"], payload.prompt, timeout=90)


@app.get("/api/camera/brightness")
def api_camera_brightness() -> dict[str, Any]:
    settings = read_settings()
    if not settings.get("camera_enabled", True):
        return {"ok": False, "error": "Camera is disabled in settings."}
    return read_camera_brightness(int(settings.get("camera_device", 0)))


@app.get("/api/theme/auto")
def api_theme_auto() -> dict[str, Any]:
    brightness = api_camera_brightness()
    value = brightness.get("brightness") if brightness.get("ok") else None
    return {"ok": True, "brightness": value, **decide_theme(value)}


@app.post("/api/speak")
def api_speak(payload: SpeakRequest) -> dict[str, Any]:
    settings = read_settings()
    if not settings.get("tts_enabled", True):
        return {"ok": False, "error": "Text to speech is disabled in settings."}
    if not payload.text.strip():
        return {"ok": False, "error": "No text was provided."}
    return speak_in_background(payload.text.strip(), payload.rate, payload.volume)


@app.get("/api/voice/offline/status")
def api_offline_voice_status() -> dict[str, Any]:
    service = offline_voice_service()
    service.update_settings(read_settings())
    return service.status()


@app.get("/api/voice/offline/devices")
def api_offline_voice_devices() -> dict[str, Any]:
    return offline_voice_service().devices()


@app.get("/api/voice/offline/events")
def api_offline_voice_events(since: int = 0) -> dict[str, Any]:
    return offline_voice_service().events(since)


@app.post("/api/voice/offline/start")
def api_offline_voice_start(payload: OfflineVoiceRequest | None = None) -> dict[str, Any]:
    request_settings = payload.settings if payload and payload.settings else {}
    settings = {**read_settings(), **request_settings}
    patch_settings({
        "offline_voice_enabled": True,
        "offline_voice_engine": settings.get("offline_voice_engine", "vosk"),
        "offline_voice_model_dir": settings.get("offline_voice_model_dir", settings.get("offlineVoiceModelDir", "models/vosk-model-small-en-us-0.15")),
        "offline_voice_device": settings.get("offline_voice_device", settings.get("offlineVoiceDevice")),
        "offline_voice_sample_rate": settings.get("offline_voice_sample_rate", settings.get("offlineVoiceSampleRate", 16000)),
        "offline_voice_wake_timeout": settings.get("offline_voice_wake_timeout", settings.get("offlineVoiceWakeTimeout", 8)),
        "assistant_name": settings.get("assistant_name", settings.get("assistantName", "Nexora")),
        "custom_wake_phrase": settings.get("custom_wake_phrase", settings.get("customWakePhrase", "")),
    })
    return offline_voice_service().start(settings)


@app.post("/api/voice/offline/stop")
def api_offline_voice_stop() -> dict[str, Any]:
    patch_settings({"offline_voice_autostart": False})
    return offline_voice_service().stop()


@app.post("/api/voice/offline/settings")
def api_offline_voice_settings(payload: OfflineVoiceRequest) -> dict[str, Any]:
    request_settings = payload.settings or {}
    current_settings = read_settings()
    patch = {
        "offline_voice_enabled": bool(request_settings.get("offline_voice_enabled", request_settings.get("offlineVoice", True))),
        "offline_voice_autostart": bool(request_settings.get("offline_voice_autostart", request_settings.get("offlineVoiceAutostart", False))),
        "offline_voice_engine": request_settings.get("offline_voice_engine", request_settings.get("offlineVoiceEngine", "vosk")),
        "offline_voice_model_dir": request_settings.get("offline_voice_model_dir", request_settings.get("offlineVoiceModelDir", "models/vosk-model-small-en-us-0.15")),
        "offline_voice_device": request_settings.get("offline_voice_device", request_settings.get("offlineVoiceDevice")),
        "offline_voice_sample_rate": request_settings.get("offline_voice_sample_rate", request_settings.get("offlineVoiceSampleRate", 16000)),
        "offline_voice_wake_timeout": request_settings.get("offline_voice_wake_timeout", request_settings.get("offlineVoiceWakeTimeout", 8)),
        "assistant_name": request_settings.get("assistant_name", request_settings.get("assistantName", current_settings.get("assistant_name", "Nexora"))),
        "custom_wake_phrase": request_settings.get("custom_wake_phrase", request_settings.get("customWakePhrase", current_settings.get("custom_wake_phrase", ""))),
    }
    settings = patch_settings(patch)
    offline_voice_service().update_settings(settings)
    return {"ok": True, "settings": settings, "voice": offline_voice_service().status()}


@app.get("/api/music")
def api_music() -> dict[str, Any]:
    try:
        tracks = scan_audio_tree(MUSIC_DIR, recursive=True, media_prefix="/media/music")
        return {
            "ok": True,
            "directory": str(ensure_media_root(MUSIC_DIR)),
            "tracks": tracks,
            "playlists": summarize_playlists(tracks),
            "fetchedAt": int(time.time() * 1000),
        }
    except Exception as error:
        return {
            "ok": False,
            "directory": str(MUSIC_DIR),
            "tracks": [],
            "playlists": [],
            "fetchedAt": int(time.time() * 1000),
            "error": f"Music scan failed: {error}",
        }


@app.get("/api/alarm-sounds")
def api_alarm_sounds() -> dict[str, Any]:
    root = pick_existing_root(ALARM_SOUND_DIRS)
    try:
        tracks = scan_audio_tree(root, recursive=False, media_prefix="/media/alarm-sounds")
        return {
            "ok": True,
            "directory": str(root),
            "tracks": tracks,
            "fetchedAt": int(time.time() * 1000),
        }
    except Exception as error:
        return {
            "ok": False,
            "directory": str(root),
            "tracks": [],
            "fetchedAt": int(time.time() * 1000),
            "error": f"Alarm sound scan failed: {error}",
        }


@app.get("/api/video-intros")
def api_video_intros() -> dict[str, Any]:
    root = pick_existing_root(VIDEO_INTRO_DIRS)
    try:
        videos = scan_video_tree(root, media_prefix="/media/video-intros")
        return {
            "ok": True,
            "directory": str(root),
            "videos": videos,
            "fetchedAt": int(time.time() * 1000),
        }
    except Exception as error:
        return {
            "ok": False,
            "directory": str(root),
            "videos": [],
            "fetchedAt": int(time.time() * 1000),
            "error": f"Video intro scan failed: {error}",
        }


@app.get("/media/music/{relative:path}")
def api_music_file(relative: str, request: Request) -> Response:
    return media_response(MUSIC_DIR, relative, request, AUDIO_EXTENSIONS)


@app.get("/media/alarm-sounds/{relative:path}")
def api_alarm_sound_file(relative: str, request: Request) -> Response:
    return media_response(pick_existing_root(ALARM_SOUND_DIRS), relative, request, AUDIO_EXTENSIONS)


@app.get("/media/video-intros/{relative:path}")
def api_video_intro_file(relative: str, request: Request) -> Response:
    return media_response(pick_existing_root(VIDEO_INTRO_DIRS), relative, request, VIDEO_EXTENSIONS)


@app.get("/api/signal/status")
def api_signal_status() -> dict[str, Any]:
    return signal_status()


@app.get("/api/signal/radio/status")
def api_signal_radio_status() -> dict[str, Any]:
    return {"ok": True, "radio": radio_status()}


@app.get("/api/signal/aircraft/status")
def api_signal_aircraft_status() -> dict[str, Any]:
    return {"ok": True, "aircraft": aircraft_status()}


@app.get("/api/bedroom/sensor")
def api_bedroom_sensor() -> dict[str, Any]:
    started = time.time()
    try:
        parsed = fetch_bedroom_esp32_data()
        return {
            "ok": True,
            "source": parsed.get("source_url") or bedroom_base_url(),
            "wifi_name": BEDROOM_WIFI_NAME,
            "fetched_at": time.time(),
            "latency_ms": round((time.time() - started) * 1000),
            "data": parsed,
        }
    except Exception as error:
        return {
            "ok": False,
            "source": bedroom_base_url(),
            "wifi_name": BEDROOM_WIFI_NAME,
            "fetched_at": time.time(),
            "latency_ms": round((time.time() - started) * 1000),
            "error": short_bedroom_error(error),
            "error_detail": str(error),
            "data": {
                "title": "ESP32 Smart Hub",
                "temperature_c": None,
                "humidity_percent": None,
                "wifi_dbm": None,
                "wifi_quality": "offline",
                "uptime": "",
                "uptime_seconds": None,
                "free_ram_kb": None,
                "has_24h_graph_data": False,
                "matrix_editor": False,
                "screen_upload": False,
                "controls": {"buzzer": False, "ir_ac1": False, "matrix": False},
            },
        }


@app.post("/api/bedroom/matrix")
def api_bedroom_matrix(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Bedroom ESP32 controls are private network only."}
    pixels = payload.get("pixels")
    if not isinstance(pixels, list):
        return {"ok": False, "error": "Matrix payload must include pixels as a list."}
    result = proxy_bedroom_matrix(pixels, str(payload.get("pattern") or "custom"))
    return {
        **result,
        "source": BEDROOM_ESP32_URL,
        "wifi_name": BEDROOM_WIFI_NAME,
        "fetched_at": time.time(),
    }


@app.post("/api/bedroom/screen-image")
def api_bedroom_screen_image(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Bedroom ESP32 uploads are private network only."}
    result = proxy_bedroom_screen_image(
        str(payload.get("filename") or "screen-image"),
        str(payload.get("content_type") or "application/octet-stream"),
        str(payload.get("data_base64") or ""),
        _safe_int(payload.get("slot")) or 1,
    )
    return {
        **result,
        "source": BEDROOM_ESP32_URL,
        "wifi_name": BEDROOM_WIFI_NAME,
        "fetched_at": time.time(),
    }


@app.post("/api/bedroom/screen-mode")
def api_bedroom_screen_mode(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Bedroom ESP32 screen controls are private network only."}
    result = proxy_bedroom_screen_mode(str(payload.get("mode") or ""), _safe_int(payload.get("slot")) or 1)
    return {
        **result,
        "source": BEDROOM_ESP32_URL,
        "wifi_name": BEDROOM_WIFI_NAME,
        "fetched_at": time.time(),
    }


@app.post("/api/bedroom/screen-customize")
def api_bedroom_screen_customize(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Bedroom ESP32 screen controls are private network only."}
    result = proxy_bedroom_screen_customize(payload)
    return {
        **result,
        "source": BEDROOM_ESP32_URL,
        "wifi_name": BEDROOM_WIFI_NAME,
        "fetched_at": time.time(),
    }


@app.post("/api/local-camera/page-heartbeat")
@app.post("/api/usb-camera/page-heartbeat")
def api_local_camera_page_heartbeat(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Camera page heartbeat is private network only."}
    runtime = update_camera_page_client(payload, request)
    settings = read_settings()
    manager = enforce_camera_runtime_policy(settings, reason="camera page heartbeat")
    return {"ok": True, **runtime, "camera": manager.status()}


@app.get("/api/local-camera/page-status")
@app.get("/api/usb-camera/page-status")
def api_local_camera_page_status(request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Camera page status is private network only."}
    return {"ok": True, **camera_page_runtime_status()}


@app.post("/api/local-camera/streams/reset")
@app.post("/api/usb-camera/streams/reset")
def api_local_camera_streams_reset(request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Camera stream reset is private network only."}
    global REMOTE_CAMERA_ACTIVE_STREAMS
    with CAMERA_LOCK:
        REMOTE_CAMERA_ACTIVE_STREAMS = 0
    settings = read_settings()
    manager = enforce_camera_runtime_policy(settings, reason="manual stream counter reset")
    return {"ok": True, **camera_page_runtime_status(settings), "camera": manager.status()}


@app.get("/api/local-camera/status")
@app.get("/api/usb-camera/status")
def api_local_camera_status() -> dict[str, Any]:
    return configured_usb_camera_sensor(start=False).status()


@app.get("/api/local-camera/motion")
@app.get("/api/usb-camera/motion")
def api_local_camera_motion() -> dict[str, Any]:
    return configured_usb_camera_sensor(start=camera_runtime_claimed(read_settings())).motion()


@app.get("/api/local-camera/brightness")
@app.get("/api/usb-camera/brightness")
def api_local_camera_brightness() -> dict[str, Any]:
    return configured_usb_camera_sensor(start=camera_runtime_claimed(read_settings())).brightness()


@app.get("/api/local-camera/face")
@app.get("/api/usb-camera/face")
def api_local_camera_face() -> dict[str, Any]:
    return configured_usb_camera_sensor(start=camera_runtime_claimed(read_settings())).face()


@app.get("/api/local-camera/sensor")
@app.get("/api/usb-camera/sensor")
def api_local_camera_sensor() -> dict[str, Any]:
    settings = read_settings()
    snapshot = configured_usb_camera_sensor(start=camera_runtime_claimed(settings)).snapshot()
    return {
        "camera": snapshot["camera"],
        "motion": snapshot["motion"],
        "brightness": snapshot["brightness"],
        "face": snapshot["face"],
    }


@app.get("/api/radar/sensor")
def api_radar_sensor() -> dict[str, Any]:
    settings = read_settings()
    snapshot = configured_usb_camera_sensor(start=camera_runtime_claimed(settings)).snapshot()
    motion = snapshot.get("motion", {})
    brightness = snapshot.get("brightness", {})
    face = snapshot.get("face", {})
    face_width = face.get("w")
    estimated_distance_m = None
    distance_confidence = "none"
    if isinstance(face_width, (int, float)) and face_width > 0:
        # Approximate webcam distance from face width. This is a useful radar hint,
        # not a real measurement. ESP32 ultrasonic will provide true distance later.
        estimated_distance_m = round(max(0.35, min(4.5, 0.14 / max(face_width, 0.03))), 2)
        distance_confidence = "stable" if face.get("stable") else "warming-up"
    elif motion.get("motion"):
        distance_confidence = "motion-only"
    return {
        "ok": True,
        "source": "local-camera",
        "camera": snapshot.get("camera", {}),
        "motion": motion,
        "brightness": brightness,
        "face": face,
        "radar": {
            "motion_detected": bool(motion.get("motion")),
            "motion_zone": motion.get("zone", "none"),
            "motion_strength": motion.get("strength", 0),
            "room_light": brightness.get("level", "unknown"),
            "face_presence": bool(face.get("face_detected") or face.get("stable")),
            "distance_label": face.get("distance", "unknown"),
            "estimated_distance_m": estimated_distance_m,
            "distance_confidence": distance_confidence,
            "privacy": "sensor-only; no recording, no identity matching",
        },
        "ultrasonic": {
            "connected": False,
            "distance_cm": None,
            "zone": "not-connected",
            "source": "future-esp32-hc-sr04",
            "message": "ESP32 HC-SR04 distance data is not connected yet.",
        },
        "modules": [
            {"name": "Laptop/computer camera", "connected": bool(snapshot.get("camera", {}).get("connected")), "role": "motion, brightness, face presence"},
            {"name": "USB camera", "connected": bool(snapshot.get("camera", {}).get("connected")), "role": "same shared camera sensor loop"},
            {"name": "ESP32 HC-SR04", "connected": False, "role": "future distance sensor"},
        ],
    }


@app.get("/api/local-camera/frame")
@app.get("/api/usb-camera/frame")
def api_local_camera_frame(request: Request):
    if not is_private_client(request):
        return Response(content=b"Camera frame is private network only.", status_code=403, media_type="text/plain")
    settings = read_settings()
    if not settings.get("camera_enabled", True) or settings.get("remote_camera_privacy_mode", False):
        return Response(content=b"Camera is disabled or privacy mode is active.", status_code=409, media_type="text/plain")
    manager = configured_usb_camera_sensor(start=True)
    deadline = time.time() + 0.45
    frame = manager.latest_jpeg()
    while frame is None and time.time() < deadline:
        time.sleep(0.03)
        frame = manager.latest_jpeg()
    if frame is None:
        return Response(content=b"Camera frame unavailable.", status_code=204, media_type="text/plain")
    return Response(
        content=frame,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache"},
    )


@app.get("/api/local-camera/logs")
@app.get("/api/usb-camera/logs")
def api_local_camera_logs() -> dict[str, Any]:
    return {"ok": True, "logs": configured_usb_camera_sensor(start=False).logs()}


@app.post("/api/local-camera/restart")
@app.post("/api/usb-camera/restart")
def api_local_camera_restart(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Local camera restart is private network only."}
    settings = read_settings()
    camera_index = int(payload.get("camera_index", settings.get("camera_device", 0)) or 0)
    camera_index = max(0, min(12, camera_index))
    manager = configured_usb_camera_sensor(start=False)
    manager.set_stream_settings(normalize_camera_stream_settings(settings))
    manager.set_look_mode(str(settings.get("camera_look_mode", "normal")))
    manager.set_camera_controls(normalize_camera_controls(settings.get("camera_controls")))
    manager.switch_camera_background(camera_index)
    return {"ok": True, "message": "Camera loop restart requested.", "camera_index": camera_index}


@app.get("/api/local-camera/controls")
@app.get("/api/usb-camera/controls")
def api_local_camera_controls() -> dict[str, Any]:
    settings = read_settings()
    manager = configured_usb_camera_sensor(start=False)
    status = manager.status()
    return {
        "ok": True,
        "controls": normalize_camera_controls(settings.get("camera_controls")),
        "driver_status": status.get("camera_control_status", {}),
    }


@app.post("/api/local-camera/controls")
@app.post("/api/usb-camera/controls")
def api_local_camera_controls_update(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Local camera controls can only be changed from localhost, private Wi-Fi, or private Tailscale."}
    controls = normalize_camera_controls(payload.get("controls", payload))
    next_settings = patch_settings({"camera_controls": controls})
    manager = configured_usb_camera_sensor(start=True)
    driver_status = manager.set_camera_controls(controls)
    return {
        "ok": True,
        "controls": normalize_camera_controls(next_settings.get("camera_controls")),
        "driver_status": driver_status,
    }


@app.post("/api/local-camera/mode")
@app.post("/api/usb-camera/mode")
def api_local_camera_mode(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Local camera mode can only be changed from localhost, private Wi-Fi, or private Tailscale."}
    mode = str(payload.get("mode") or "sensor").lower()
    if mode not in {"off", "sensor", "live", "privacy"}:
        mode = "sensor"
    settings = read_settings()
    camera_index = int(payload.get("camera_index", settings.get("camera_device", 0)) or 0)
    patch = {"usb_camera_mode": mode, "camera_device": max(0, min(12, camera_index))}
    if "motion_area_threshold" in payload:
        try:
            patch["usb_camera_motion_area_threshold"] = max(100, min(50000, int(payload.get("motion_area_threshold"))))
        except (TypeError, ValueError):
            pass
    next_settings = patch_settings(patch)
    snapshot = configured_usb_camera_sensor(start=True).snapshot()
    return {"ok": True, "mode": mode, "sensor": snapshot}


@app.get("/api/remote-camera/status")
def api_remote_camera_status(request: Request) -> dict[str, Any]:
    cleanup_remote_sessions()
    settings = read_settings()
    stream_settings = normalize_camera_stream_settings(settings)
    page_runtime = camera_page_runtime_status(settings)
    should_run = bool(page_runtime.get("camera_should_run"))
    sensor_snapshot = configured_usb_camera_sensor(start=should_run).snapshot()
    allowed, kind, message = remote_camera_network_allowed(settings, request)
    sessions = [
        {
            "client": session.get("client"),
            "kind": session.get("kind"),
            "created_at": session.get("created_at"),
            "last_seen": session.get("last_seen"),
        }
        for session in REMOTE_CAMERA_SESSIONS.values()
    ]
    return {
        "ok": True,
        "mode": settings.get("remote_camera_access_mode", "disabled"),
        "network_allowed": allowed,
        "client_kind": kind,
        "message": message,
        "camera_enabled": bool(settings.get("camera_enabled", True)),
        "camera_device": int(settings.get("camera_device", 0)),
        "privacy_mode": bool(settings.get("remote_camera_privacy_mode", True)),
        "high_security": bool(settings.get("remote_camera_high_security", False)),
        "security_snapshots": bool(settings.get("remote_camera_security_snapshots", False)),
        "camera_mode": settings.get("usb_camera_mode", "sensor"),
        "camera_look_mode": settings.get("camera_look_mode", "normal"),
        "background_adaptive_brightness": bool(settings.get("camera_background_adaptive_brightness", False)),
        "camera_page": page_runtime,
        "stream_settings": stream_settings,
        "camera_controls": normalize_camera_controls(settings.get("camera_controls")),
        "camera_control_status": sensor_snapshot.get("camera", {}).get("camera_control_status", {}),
        "usb_sensor": {
            "camera": sensor_snapshot.get("camera"),
            "motion": sensor_snapshot.get("motion"),
            "brightness": sensor_snapshot.get("brightness"),
            "face": sensor_snapshot.get("face"),
        },
        "password_set": bool(settings.get("remote_camera_password_hash")),
        "snapshot_count": len(list(REMOTE_CAMERA_SNAPSHOT_DIR.glob("*.jpg"))) if REMOTE_CAMERA_SNAPSHOT_DIR.exists() else 0,
        "active_connections": sessions,
    }


@app.post("/api/remote-camera/settings")
def api_remote_camera_settings(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Remote camera settings can only be changed from localhost, private Wi-Fi, or private Tailscale."}
    settings = read_settings()
    patch: dict[str, Any] = {}
    if "mode" in payload:
        mode = str(payload.get("mode") or "disabled").lower()
        patch["remote_camera_access_mode"] = mode if mode in {"disabled", "local", "tailscale", "both"} else "disabled"
    if "camera_mode" in payload or "usb_camera_mode" in payload:
        sensor_mode = str(payload.get("camera_mode", payload.get("usb_camera_mode")) or "sensor").lower()
        patch["usb_camera_mode"] = sensor_mode if sensor_mode in {"off", "sensor", "live", "privacy"} else "sensor"
    if "motion_area_threshold" in payload:
        try:
            patch["usb_camera_motion_area_threshold"] = max(100, min(50000, int(payload.get("motion_area_threshold"))))
        except (TypeError, ValueError):
            pass
    if "stream_profile" in payload:
        profile = str(payload.get("stream_profile") or "reference720").lower()
        patch["remote_camera_stream_profile"] = profile if profile in {*CAMERA_STREAM_PROFILES.keys(), "custom"} else "reference720"
    if "camera_look_mode" in payload:
        look_mode = str(payload.get("camera_look_mode") or "normal").lower()
        patch["camera_look_mode"] = look_mode if look_mode in {"normal", "night-vision", "dark-room", "bright-room", "manual"} else "normal"
    if "stream_fps" in payload:
        patch["remote_camera_stream_fps"] = clamp_int(payload.get("stream_fps"), 1, 150, 24)
    if "stream_quality" in payload:
        patch["remote_camera_stream_quality"] = clamp_int(payload.get("stream_quality"), 20, 95, 82)
    if "stream_width" in payload:
        patch["remote_camera_stream_width"] = clamp_int(payload.get("stream_width"), 160, 1920, 1280)
    if "stream_height" in payload:
        patch["remote_camera_stream_height"] = clamp_int(payload.get("stream_height"), 120, 1080, 720)
    if "camera_controls" in payload:
        patch["camera_controls"] = normalize_camera_controls(payload.get("camera_controls"))
    for source, target in [
        ("camera_enabled", "camera_enabled"),
        ("privacy_mode", "remote_camera_privacy_mode"),
        ("high_security", "remote_camera_high_security"),
        ("security_snapshots", "remote_camera_security_snapshots"),
        ("background_adaptive_brightness", "camera_background_adaptive_brightness"),
    ]:
        if source in payload:
            patch[target] = bool(payload[source])
    if "failed_attempt_threshold" in payload:
        try:
            patch["remote_camera_failed_attempt_threshold"] = max(1, min(20, int(payload.get("failed_attempt_threshold"))))
        except (TypeError, ValueError):
            pass
    if "camera_device" in payload:
        try:
            patch["camera_device"] = max(0, min(12, int(payload.get("camera_device"))))
        except (TypeError, ValueError):
            pass
    password = str(payload.get("password") or "")
    if password:
        existing_hash = str(settings.get("remote_camera_password_hash") or "")
        old_password = str(payload.get("old_password") or payload.get("current_password") or "")
        if existing_hash and not remote_camera_password_matches(old_password, existing_hash):
            return {
                "ok": False,
                "error": "Current camera password is required before changing the password.",
                "password_set": True,
            }
        patch["remote_camera_password_hash"] = hash_remote_camera_password(password)
    next_settings = patch_settings(patch) if patch else settings
    manager = get_camera_sensor_manager()
    page_runtime = camera_page_runtime_status(next_settings)
    camera_should_run = bool(page_runtime.get("camera_should_run"))
    camera_device_changed = "camera_device" in patch
    stream_changed = any(key.startswith("remote_camera_stream_") for key in patch)
    runtime_changed = (
        patch.get("camera_enabled") is False
        or "remote_camera_privacy_mode" in patch
        or "usb_camera_mode" in patch
        or "camera_background_adaptive_brightness" in patch
    )
    if camera_device_changed and camera_should_run:
        manager.set_stream_settings(normalize_camera_stream_settings(next_settings))
        manager.set_look_mode(str(next_settings.get("camera_look_mode", "normal")))
        manager.set_camera_controls(normalize_camera_controls(next_settings.get("camera_controls")))
        manager.switch_camera_background(int(next_settings.get("camera_device", 0)))
    elif camera_device_changed or runtime_changed or stream_changed:
        release_remote_camera_capture()
        enforce_camera_runtime_policy(next_settings, reason="remote camera settings changed")
    elif "camera_controls" in patch:
        manager.set_camera_controls(normalize_camera_controls(next_settings.get("camera_controls")))
    elif "camera_look_mode" in patch:
        manager.set_look_mode(str(next_settings.get("camera_look_mode", "normal")))
    return {"ok": True, "settings": {
        "mode": next_settings.get("remote_camera_access_mode", "disabled"),
        "camera_enabled": bool(next_settings.get("camera_enabled", True)),
        "camera_device": int(next_settings.get("camera_device", 0)),
        "privacy_mode": bool(next_settings.get("remote_camera_privacy_mode", True)),
        "high_security": bool(next_settings.get("remote_camera_high_security", False)),
        "security_snapshots": bool(next_settings.get("remote_camera_security_snapshots", False)),
        "camera_mode": next_settings.get("usb_camera_mode", "sensor"),
        "camera_look_mode": next_settings.get("camera_look_mode", "normal"),
        "background_adaptive_brightness": bool(next_settings.get("camera_background_adaptive_brightness", False)),
        "stream_settings": normalize_camera_stream_settings(next_settings),
        "camera_controls": normalize_camera_controls(next_settings.get("camera_controls")),
        "camera_control_status": get_camera_sensor_manager().status().get("camera_control_status", {}),
        "motion_area_threshold": next_settings.get("usb_camera_motion_area_threshold", 1000),
        "failed_attempt_threshold": next_settings.get("remote_camera_failed_attempt_threshold", 5),
        "password_set": bool(next_settings.get("remote_camera_password_hash")),
    }}


@app.post("/api/remote-camera/login")
def api_remote_camera_login(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    cleanup_remote_sessions()
    settings = read_settings()
    allowed, kind, message = remote_camera_network_allowed(settings, request)
    client = request.client.host if request.client else "unknown"
    if not allowed:
        return {"ok": False, "error": message, "client_kind": kind}
    expected_hash = settings.get("remote_camera_password_hash") or ""
    if not expected_hash:
        return {"ok": False, "error": "Set a remote camera password in Settings first.", "client_kind": kind}
    if not remote_camera_password_matches(str(payload.get("password") or ""), expected_hash):
        REMOTE_CAMERA_FAILED_ATTEMPTS[client] = REMOTE_CAMERA_FAILED_ATTEMPTS.get(client, 0) + 1
        return {
            "ok": False,
            "error": "Wrong camera password.",
            "client_kind": kind,
            "failed_attempts": REMOTE_CAMERA_FAILED_ATTEMPTS[client],
            "threshold": settings.get("remote_camera_failed_attempt_threshold", 5),
        }
    token = secrets.token_urlsafe(32)
    now = time.time()
    REMOTE_CAMERA_SESSIONS[token] = {
        "client": client,
        "kind": kind,
        "created_at": now,
        "last_seen": now,
    }
    REMOTE_CAMERA_FAILED_ATTEMPTS.pop(client, None)
    return {"ok": True, "token": token, "client_kind": kind, "message": "Remote camera unlocked for this private session."}


@app.get("/api/remote-camera/devices")
def api_remote_camera_devices(request: Request, refresh: int = 0) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Camera device listing is private only.", "devices": []}
    return list_camera_devices(force_refresh=bool(refresh))


def release_remote_camera_capture() -> None:
    global REMOTE_CAMERA_CAPTURE, REMOTE_CAMERA_CAPTURE_DEVICE, REMOTE_CAMERA_LAST_FRAME, REMOTE_CAMERA_LAST_FRAME_AT
    with CAMERA_LOCK:
        if REMOTE_CAMERA_CAPTURE is not None:
            try:
                REMOTE_CAMERA_CAPTURE.release()
            except Exception:
                pass
        REMOTE_CAMERA_CAPTURE = None
        REMOTE_CAMERA_CAPTURE_DEVICE = None
        REMOTE_CAMERA_LAST_FRAME = None
        REMOTE_CAMERA_LAST_FRAME_AT = 0.0


def configure_camera_capture(cv2: Any, cap: Any) -> None:
    try:
        cap.set(getattr(cv2, "CAP_PROP_FOURCC", 6), cv2.VideoWriter_fourcc(*"MJPG"))
    except Exception:
        pass
    for prop, value in [
        (getattr(cv2, "CAP_PROP_FRAME_WIDTH", 3), 426),
        (getattr(cv2, "CAP_PROP_FRAME_HEIGHT", 4), 240),
        (getattr(cv2, "CAP_PROP_FPS", 5), 15),
        (getattr(cv2, "CAP_PROP_BUFFERSIZE", 38), 1),
    ]:
        try:
            cap.set(prop, value)
        except Exception:
            pass


def persistent_camera_capture(cv2: Any, device: int = 0):
    global REMOTE_CAMERA_CAPTURE, REMOTE_CAMERA_CAPTURE_DEVICE
    if (
        REMOTE_CAMERA_CAPTURE is not None
        and REMOTE_CAMERA_CAPTURE_DEVICE == device
        and REMOTE_CAMERA_CAPTURE.isOpened()
    ):
        return REMOTE_CAMERA_CAPTURE

    release_remote_camera_capture()
    cap = open_camera_capture(cv2, device)
    if cap is not None and cap.isOpened():
        configure_camera_capture(cv2, cap)
        REMOTE_CAMERA_CAPTURE = cap
        REMOTE_CAMERA_CAPTURE_DEVICE = device
        return REMOTE_CAMERA_CAPTURE
    try:
        cap.release()
    except Exception:
        pass
    return None


def camera_jpeg_frame(device: int = 0, *, prefer_cached: bool = False) -> bytes | None:
    settings = read_settings()
    if not settings.get("camera_enabled", True) or settings.get("remote_camera_privacy_mode", True):
        return None
    manager = configured_usb_camera_sensor(start=True)
    deadline = time.time() + (0.7 if prefer_cached else 0.35)
    while time.time() < deadline:
        frame = manager.latest_jpeg()
        if frame:
            return frame
        time.sleep(0.03)
    return manager.latest_jpeg()


def open_camera_capture(cv2: Any, device: int):
    backends: list[int] = []
    if is_windows():
        backends.append(getattr(cv2, "CAP_MSMF", 1400))
        if _env_truthy(os.environ.get("BEDROOM_DASHBOARD_CAMERA_ALLOW_DSHOW")):
            backends.append(getattr(cv2, "CAP_DSHOW", 700))
    backends.append(getattr(cv2, "CAP_ANY", 0))

    for backend in backends:
        cap = None
        try:
            cap = cv2.VideoCapture(device, backend)
            if cap is not None and cap.isOpened():
                return cap
        except Exception:
            pass
        safe_release_capture(cap)
    try:
        return cv2.VideoCapture(device)
    except Exception:
        return None


def safe_release_capture(cap: Any) -> None:
    if cap is None:
        return
    try:
        cap.release()
    except Exception:
        pass


def safe_capture_is_open(cap: Any) -> bool:
    if cap is None:
        return False
    try:
        return bool(cap.isOpened())
    except Exception:
        return False


def safe_capture_set(cap: Any, prop: Any, value: float) -> bool:
    if cap is None:
        return False
    try:
        return bool(cap.set(prop, value))
    except Exception:
        return False


def system_camera_hints(max_devices: int) -> dict[int, str]:
    hints: dict[int, str] = {}
    if is_windows():
        ps = (
            "Get-CimInstance Win32_PnPEntity | "
            "Where-Object { $_.PNPClass -in @('Camera','Image') -or $_.Name -match 'camera|webcam|usb video|lenovo' } | "
            "Select-Object -ExpandProperty Name"
        )
        result = run_powershell(ps, timeout=2)
        if result.get("ok"):
            names = [line.strip() for line in str(result.get("stdout") or "").splitlines() if line.strip()]
            for index, name in enumerate(names[:max_devices]):
                hints[index] = name
        return hints

    for video_path in sorted(Path("/dev").glob("video*"))[:max_devices]:
        match = re.search(r"video(\d+)$", video_path.name)
        if not match:
            continue
        index = int(match.group(1))
        if index < max_devices:
            hints[index] = video_path.name
    return hints


def list_camera_devices(max_devices: int = 13, force_refresh: bool = False) -> dict[str, Any]:
    cache_ttl = 30.0
    cached = REMOTE_CAMERA_DEVICE_CACHE.get("data")
    if not force_refresh and cached and time.time() - float(REMOTE_CAMERA_DEVICE_CACHE.get("at") or 0) < cache_ttl:
        return {**cached, "selected": int(read_settings().get("camera_device", 0))}

    def camera_label(index: int, suffix: str = "") -> str:
        names = {
            0: "Device 0 - Laptop camera",
            1: "Device 1 - Lenovo USB / door view",
        }
        return f"{names.get(index, f'Device {index}')}{suffix}"

    hints = system_camera_hints(max_devices)
    devices: list[dict[str, Any]] = []
    sensor_status = get_camera_sensor_manager().status()
    active_sensor_index = int(sensor_status.get("camera_index", -1)) if sensor_status.get("connected") else -1
    selected = int(read_settings().get("camera_device", 0))
    for index in range(max_devices):
        suffix = ""
        available = index in hints
        if index == active_sensor_index:
            suffix = " (sensor active)"
            available = True
        elif REMOTE_CAMERA_CAPTURE is not None and REMOTE_CAMERA_CAPTURE_DEVICE == index and safe_capture_is_open(REMOTE_CAMERA_CAPTURE):
            suffix = " (active)"
            available = True
        elif index in hints:
            suffix = f" - {hints[index][:54]}"
        devices.append({
            "id": index,
            "label": camera_label(index, suffix),
            "available": available,
            "source": "active" if index == active_sensor_index else "os" if index in hints else "slot",
        })

    existing_ids = {int(device["id"]) for device in devices}
    for index in range(max_devices):
        if index not in existing_ids:
            devices.append({"id": index, "label": camera_label(index), "available": False})

    devices = sorted(devices, key=lambda device: int(device["id"]))
    result = {
        "ok": True,
        "devices": devices,
        "selected": selected,
    }
    REMOTE_CAMERA_DEVICE_CACHE["at"] = time.time()
    REMOTE_CAMERA_DEVICE_CACHE["data"] = result
    return result


@app.get("/api/remote-camera/snapshot")
def api_remote_camera_snapshot(request: Request, token: str = ""):
    blocked = remote_camera_guard(request, token)
    if blocked:
        return blocked
    settings = read_settings()
    frame = camera_jpeg_frame(int(settings.get("camera_device", 0)), prefer_cached=True)
    if frame is None:
        return {"ok": False, "error": "Camera stream is unavailable on this device."}
    if settings.get("remote_camera_security_snapshots", False):
        try:
            REMOTE_CAMERA_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
            client = (request.client.host if request.client else "local").replace(":", "_").replace(".", "_")
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            (REMOTE_CAMERA_SNAPSHOT_DIR / f"{stamp}-{client}.jpg").write_bytes(frame)
        except Exception:
            pass
    return Response(
        content=frame,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache"},
    )


@app.get("/api/remote-camera/stream")
def api_remote_camera_stream(request: Request, token: str = "", camera: int | None = None):
    blocked = remote_camera_guard(request, token)
    if blocked:
        return blocked
    if camera is not None:
        try:
            selected_camera = max(0, min(12, int(camera)))
            settings = read_settings()
            if selected_camera != int(settings.get("camera_device", 0) or 0):
                settings = patch_settings({"camera_device": selected_camera})
                manager = get_camera_sensor_manager()
                if bool(camera_page_runtime_status(settings).get("camera_should_run")):
                    manager.set_stream_settings(normalize_camera_stream_settings(settings))
                    manager.set_look_mode(str(settings.get("camera_look_mode", "normal")))
                    manager.set_camera_controls(normalize_camera_controls(settings.get("camera_controls")))
                    manager.switch_camera_background(selected_camera)
        except Exception:
            pass

    def frames():
        global REMOTE_CAMERA_ACTIVE_STREAMS
        consecutive_failures = 0
        last_sequence = -1
        settings = read_settings()
        stream_settings = normalize_camera_stream_settings(settings)
        frame_interval = max(1 / max(1, int(stream_settings["fps"])), 0.006)
        settings_refresh_at = 0.0
        with CAMERA_LOCK:
            REMOTE_CAMERA_ACTIVE_STREAMS += 1
        manager = configured_usb_camera_sensor(start=True)
        try:
            while True:
                now = time.time()
                if now >= settings_refresh_at:
                    settings = read_settings()
                    stream_settings = normalize_camera_stream_settings(settings)
                    frame_interval = max(1 / max(1, int(stream_settings["fps"])), 0.006)
                    settings_refresh_at = now + 1.0
                if settings.get("remote_camera_privacy_mode", True) or not settings.get("camera_enabled", True):
                    break
                frame, sequence, _ = manager.latest_jpeg_info()
                if frame is None:
                    consecutive_failures += 1
                    if consecutive_failures >= 20:
                        break
                    time.sleep(0.05)
                    continue
                if sequence == last_sequence:
                    time.sleep(min(frame_interval / 3, 0.01))
                    continue
                last_sequence = sequence
                consecutive_failures = 0
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(frame)}\r\n\r\n".encode("ascii")
                    + frame
                    + b"\r\n"
                )
        finally:
            with CAMERA_LOCK:
                REMOTE_CAMERA_ACTIVE_STREAMS = max(0, REMOTE_CAMERA_ACTIVE_STREAMS - 1)

    return StreamingResponse(
        frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/device/restart-backend")
def api_restart_backend(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    if blocked:
        return blocked
    return {
        "ok": False,
        "error": "Backend restart is a protected placeholder. Restart the systemd service or start-kiosk.sh process from the terminal.",
    }


def kiosk_health_snapshot(request: Request | None = None) -> dict[str, Any]:
    settings = read_settings()
    manager = configured_usb_camera_sensor(start=False)
    page_runtime = camera_page_runtime_status(settings)
    sensor = manager.snapshot()
    remote_allowed = None
    if request is not None:
        allowed, kind, message = remote_camera_network_allowed(settings, request)
        remote_allowed = {"allowed": allowed, "client_kind": kind, "message": message}
    dependencies = tool_status()
    missing = [name for name, value in dependencies.items() if not value.get("available")]
    return {
        "ok": True,
        "backend": {"online": True, **runtime_status()},
        "os": get_os_status(),
        "ollama": ollama_status(),
        "dependencies": dependencies,
        "missing_dependencies": missing,
        "device_control_enabled": is_truthy(os.environ.get("ALLOW_DEVICE_CONTROL")),
        "battery": get_battery_status(),
        "power": get_power_mode(),
        "brightness": get_brightness(),
        "volume": get_volume(),
        "wifi": get_wifi_status(),
        "tailscale": get_tailscale_status(),
        "camera_page": page_runtime,
        "remote_camera": {
            "mode": settings.get("remote_camera_access_mode", "disabled"),
            "camera_enabled": bool(settings.get("camera_enabled", True)),
            "privacy_mode": bool(settings.get("remote_camera_privacy_mode", False)),
            "password_set": bool(settings.get("remote_camera_password_hash")),
            "network": remote_allowed,
        },
        "camera": sensor.get("camera", {}),
        "motion": sensor.get("motion", {}),
        "room_brightness": sensor.get("brightness", {}),
        "face_presence": sensor.get("face", {}),
        "camera_logs": manager.logs()[:25],
    }


@app.get("/api/kiosk/health")
def api_kiosk_health(request: Request) -> dict[str, Any]:
    if not is_private_client(request):
        return {"ok": False, "error": "Kiosk health is private network only."}
    return kiosk_health_snapshot(request)


@app.post("/api/system/repair")
def api_system_repair(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    if blocked:
        return blocked

    actions = payload.get("actions")
    if isinstance(actions, str):
        actions = [actions]
    if not isinstance(actions, list) or not actions:
        actions = ["camera_restart", "reset_streams", "clear_expired_sessions", "apply_runtime_policy"]

    settings = read_settings()
    manager = configured_usb_camera_sensor(start=False)
    results: list[dict[str, Any]] = []

    for raw_action in actions:
        action = str(raw_action or "").strip().lower()
        try:
            if action == "camera_restart":
                manager.set_stream_settings(normalize_camera_stream_settings(settings))
                manager.set_look_mode(str(settings.get("camera_look_mode", "normal")))
                manager.set_camera_controls(normalize_camera_controls(settings.get("camera_controls")))
                manager.switch_camera_background(int(settings.get("camera_device", 0) or 0))
                results.append({"action": action, "ok": True, "message": "Camera loop restart requested."})
            elif action == "reset_streams":
                global REMOTE_CAMERA_ACTIVE_STREAMS
                with CAMERA_LOCK:
                    REMOTE_CAMERA_ACTIVE_STREAMS = 0
                results.append({"action": action, "ok": True, "message": "Camera stream counter reset."})
            elif action == "clear_expired_sessions":
                before = len(REMOTE_CAMERA_SESSIONS)
                cleanup_remote_sessions()
                after = len(REMOTE_CAMERA_SESSIONS)
                results.append({"action": action, "ok": True, "message": f"Expired sessions cleared: {before - after}."})
            elif action == "clear_camera_clients":
                with CAMERA_PAGE_LOCK:
                    count = len(CAMERA_PAGE_CLIENTS)
                    CAMERA_PAGE_CLIENTS.clear()
                results.append({"action": action, "ok": True, "message": f"Camera page clients cleared: {count}."})
            elif action == "release_legacy_capture":
                release_remote_camera_capture()
                results.append({"action": action, "ok": True, "message": "Legacy camera capture released."})
            elif action == "apply_runtime_policy":
                enforce_camera_runtime_policy(settings, reason="manual repair")
                results.append({"action": action, "ok": True, "message": "Camera runtime policy re-applied."})
            elif action == "restart_ollama":
                result = start_ollama_server()
                results.append({"action": action, "ok": bool(result.get("ok")), "message": result.get("message", "Ollama start requested."), "details": result})
            elif action == "pull_ai_models":
                result = launch_ai_model_download()
                results.append({"action": action, "ok": bool(result.get("ok")), "message": result.get("message", "AI model download started."), "details": result})
            else:
                results.append({"action": action, "ok": False, "message": "Unknown repair action."})
        except Exception as error:
            results.append({"action": action, "ok": False, "message": str(error)})

    return {"ok": all(item.get("ok") for item in results), "results": results, "health": kiosk_health_snapshot(request)}


@app.get("/api/device/status")
def api_device_status(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    if blocked:
        return {**blocked, "dependencies": tool_status()}
    return {
        "ok": True,
        "allowed": True,
        "os": get_os_status(),
        "dependencies": tool_status(),
        "runtime": runtime_status(),
        "brightness": get_brightness(),
        "battery": get_battery_status(),
        "power": get_power_mode(),
        "volume": get_volume(),
        "night_light": get_night_light(),
        "do_not_disturb": get_do_not_disturb(),
        "airplane": get_airplane_mode(),
        "tailscale": get_tailscale_status(),
        "wifi": get_wifi_status(),
        "bluetooth": get_bluetooth_status(),
    }


@app.get("/api/device/brightness")
def api_get_device_brightness(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_brightness()


@app.post("/api/device/brightness")
def api_set_device_brightness(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or set_brightness(payload)


@app.get("/api/device/volume")
def api_get_device_volume(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_volume()


@app.post("/api/device/volume")
def api_set_device_volume(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or set_volume(payload)


@app.post("/api/device/volume/mute")
def api_set_device_mute(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or set_mute(payload)


@app.get("/api/device/night-light")
def api_get_night_light(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_night_light()


@app.post("/api/device/night-light")
def api_set_device_night_light(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or set_night_light(payload)


@app.get("/api/device/battery")
def api_get_battery(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_battery_status()


@app.get("/api/device/runtime")
def api_get_runtime(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or {"ok": True, **runtime_status()}


@app.get("/api/device/power")
def api_get_power_mode(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_power_mode()


@app.post("/api/device/power")
def api_set_power_mode(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or set_power_mode(payload)


@app.get("/api/device/dnd")
def api_get_do_not_disturb(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_do_not_disturb()


@app.post("/api/device/dnd")
def api_set_do_not_disturb(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or set_do_not_disturb(payload)


@app.get("/api/device/airplane")
def api_get_airplane_mode(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_airplane_mode()


@app.post("/api/device/airplane")
def api_set_airplane_mode(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or set_airplane_mode(payload)


@app.get("/api/device/tailscale")
def api_get_tailscale(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_tailscale_status()


@app.post("/api/device/tailscale")
def api_set_tailscale(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or set_tailscale(payload)


@app.get("/api/device/wifi/status")
def api_get_wifi_status(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_wifi_status()


@app.post("/api/device/wifi/toggle")
def api_toggle_wifi(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or toggle_wifi(payload)


@app.get("/api/device/wifi/scan")
def api_scan_wifi(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or scan_wifi()


@app.post("/api/device/wifi/connect")
def api_connect_wifi(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or connect_wifi(payload)


@app.get("/api/device/bluetooth/status")
def api_get_bluetooth_status(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or get_bluetooth_status()


@app.post("/api/device/bluetooth/toggle")
def api_toggle_bluetooth(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or toggle_bluetooth(payload)


@app.get("/api/device/bluetooth/scan")
def api_scan_bluetooth(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or scan_bluetooth()


@app.get("/api/device/bluetooth/paired")
def api_paired_bluetooth(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or bluetooth_devices(True)


@app.post("/api/device/bluetooth/pair")
def api_pair_bluetooth(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or bluetooth_action("pair", payload)


@app.post("/api/device/bluetooth/connect")
def api_connect_bluetooth(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or bluetooth_action("connect", payload)


@app.post("/api/device/bluetooth/disconnect")
def api_disconnect_bluetooth(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or bluetooth_action("disconnect", payload)


@app.post("/api/device/bluetooth/remove")
def api_remove_bluetooth(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    return blocked or bluetooth_action("remove", payload)
