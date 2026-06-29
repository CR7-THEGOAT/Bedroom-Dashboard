import json
import os
import platform
import re
import shutil
import subprocess
import threading
import hashlib
import secrets
import time
from datetime import datetime
from ipaddress import ip_address, ip_network
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, Request
from fastapi.responses import Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sdr_services import aircraft_status, radio_status, signal_status


APP_NAME = "Bedroom Dashboard Local Backend"
SETTINGS_PATH = Path(__file__).with_name("settings.json")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
SETTINGS_LOCK = threading.RLock()
TAILSCALE_CGNAT = ip_network("100.64.0.0/10")
STARTED_AT = datetime.now()
REMOTE_CAMERA_SESSIONS: dict[str, dict[str, Any]] = {}
REMOTE_CAMERA_FAILED_ATTEMPTS: dict[str, int] = {}
REMOTE_CAMERA_SNAPSHOT_DIR = Path(__file__).with_name("security_snapshots")

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

DEFAULT_SETTINGS: dict[str, Any] = {
    "assistant_name": "Nexora",
    "user_display_names": ["Saeed", "Sa3doon"],
    "easy_model": "qwen2.5:3b",
    "hard_model": "qwen3:4b",
    "voice_assistant_enabled": True,
    "camera_auto_theme": False,
    "tts_enabled": True,
    "theme": "dark",
    "camera_enabled": True,
    "camera_device": 0,
    "listen_timeout": 5,
    "remote_access_note": "Use Wi-Fi host mode or Tailscale Serve for remote access.",
    "allow_device_control": False,
    "remote_camera_access_mode": "disabled",
    "remote_camera_password_hash": "",
    "remote_camera_privacy_mode": True,
    "remote_camera_high_security": False,
    "remote_camera_security_snapshots": False,
    "remote_camera_failed_attempt_threshold": 5,
}


class CommandRequest(BaseModel):
    command: str
    easy_model: str | None = None
    hard_model: str | None = None


class PromptRequest(BaseModel):
    prompt: str
    model: str | None = None


class SpeakRequest(BaseModel):
    text: str
    rate: int | None = None
    volume: float | None = None


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


def tool_status() -> dict[str, dict[str, Any]]:
    return {
        name: {
            "available": shutil.which(name) is not None,
            "install": install,
        }
        for name, install in DEVICE_TOOLS.items()
    }


def hash_remote_camera_password(password: str) -> str:
    return hashlib.sha256(str(password or "").encode("utf-8")).hexdigest()


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
        return {
            "ok": False,
            "model": model,
            "error": f"Ollama is not running or model is missing: {error}",
        }


def ollama_status() -> dict[str, Any]:
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2.5)
        response.raise_for_status()
        data = response.json()
        models = [item.get("name") for item in data.get("models", []) if item.get("name")]
        return {"ok": True, "url": OLLAMA_URL, "models": models}
    except requests.RequestException as error:
        return {"ok": False, "url": OLLAMA_URL, "error": str(error)}


def choose_model(command: str, settings: dict[str, Any], easy: str | None, hard: str | None) -> tuple[str, str]:
    hard_words = ("explain", "plan", "why", "write", "homework", "complex", "hard", "think", "research")
    use_hard = len(command) > 80 or any(word in command.lower() for word in hard_words)
    if use_hard:
        return "hard", hard or settings["hard_model"]
    return "easy", easy or settings["easy_model"]


def local_route(command: str) -> dict[str, Any] | None:
    clean = command.lower().strip()
    routes = {
        "open settings": ("open_settings", "Opening settings."),
        "open dashboard": ("open_dashboard", "Opening dashboard."),
        "open clock": ("open_clock", "Opening clock."),
        "switch to red mode": ("theme_red_night", "Switching to red night mode."),
        "switch to dark mode": ("theme_dark", "Switching to dark mode."),
        "switch to light mode": ("theme_light", "Switching to light mode."),
        "show prayer times": ("show_prayer", "Showing prayer times."),
        "show weather": ("show_weather", "Showing weather."),
        "mute music": ("mute_music", "Muting music."),
        "study mode": ("study_mode", "Study mode is ready."),
        "sleep mode": ("sleep_mode", "Sleep mode is on."),
    }
    for phrase, (action, reply) in routes.items():
        if phrase in clean:
            return {"ok": True, "source": "local", "action": action, "reply": reply, "model": "easy"}
    return None


def read_camera_brightness(device: int = 0) -> dict[str, Any]:
    try:
        import cv2
    except Exception as error:
        return {"ok": False, "error": f"OpenCV is not installed: {error}"}

    cap = None
    try:
        cap = cv2.VideoCapture(device)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 160)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 120)
        ok, frame = cap.read()
        if not ok or frame is None:
            return {"ok": False, "error": "Camera was not found or returned no frame."}
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return {"ok": True, "brightness": int(gray.mean()), "device": device}
    except Exception as error:
        return {"ok": False, "error": str(error)}
    finally:
        if cap is not None:
            cap.release()


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
    if shutil.which("brightnessctl"):
        result = run_system(["brightnessctl", "-m"])
        if not result["ok"]:
            return result
        fields = result["stdout"].split(",")
        percent_text = fields[4] if len(fields) >= 5 else ""
        match = re.search(r"(\d+)", percent_text)
        percent = int(match.group(1)) if match else None
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
    if current["tool"] == "wpctl":
        result = run_system(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", f"{percent / 100:.2f}"])
    else:
        result = run_system(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{percent}%"])
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
    if current["tool"] == "wpctl":
        result = run_system(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "1" if next_state else "0"])
    else:
        result = run_system(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "true" if next_state else "false"])
    if not result["ok"]:
        return result
    return {**get_volume(), "message": "Audio muted." if next_state else "Audio unmuted."}


def get_night_light() -> dict[str, Any]:
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
    wifi = get_wifi_status()
    bluetooth = get_bluetooth_status()
    wifi_on = bool(wifi.get("enabled")) if wifi.get("ok") else None
    bluetooth_on = bool(bluetooth.get("enabled")) if bluetooth.get("ok") else None
    if wifi_on is None and bluetooth_on is None:
        return {"ok": False, "error": "Airplane mode needs nmcli or bluetoothctl."}
    enabled = (wifi_on is False or wifi_on is None) and (bluetooth_on is False or bluetooth_on is None)
    return {"ok": True, "supported": True, "enabled": enabled, "wifi": wifi, "bluetooth": bluetooth}


def set_airplane_mode(payload: dict[str, Any]) -> dict[str, Any]:
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
    if not shutil.which("tailscale"):
        return missing_tool("tailscale")
    result = run_system(["tailscale", "status", "--json"], timeout=8)
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
    fallback = run_system(["tailscale", "status"], timeout=8)
    if not fallback["ok"]:
        return fallback
    stdout = fallback["stdout"]
    stopped = "stopped" in stdout.lower() or "logged out" in stdout.lower()
    return {"ok": True, "tool": "tailscale", "enabled": not stopped, "state": "running" if not stopped else "stopped", "raw": stdout}


def set_tailscale(payload: dict[str, Any]) -> dict[str, Any]:
    if not shutil.which("tailscale"):
        return missing_tool("tailscale")
    enabled = bool(payload.get("enabled"))
    result = run_system(["tailscale", "up" if enabled else "down"], timeout=35)
    if not result["ok"]:
        return result
    if enabled and payload.get("serve") is True:
        serve_result = run_system(["tailscale", "serve", "--bg", "5173"], timeout=20)
        if not serve_result["ok"]:
            return serve_result
        return {**get_tailscale_status(), "message": "Tailscale VPN is on and serving Bedroom Dashboard."}
    if payload.get("serve") is False:
        run_system(["tailscale", "serve", "reset"], timeout=12)
    return {**get_tailscale_status(), "message": "Tailscale VPN is on." if enabled else "Tailscale VPN is off."}


def get_wifi_status() -> dict[str, Any]:
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
    if not shutil.which("bluetoothctl"):
        return missing_tool("bluetoothctl")
    result = run_system(["bluetoothctl", "show"], timeout=8)
    if not result["ok"]:
        return result
    powered = bool(re.search(r"Powered:\s+yes", result["stdout"], re.IGNORECASE))
    return {"ok": True, "tool": "bluetoothctl", "enabled": powered}


def bluetooth_devices(paired: bool = False) -> dict[str, Any]:
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
    if not shutil.which("bluetoothctl"):
        return missing_tool("bluetoothctl")
    run_system(["bluetoothctl", "power", "on"], timeout=6)
    run_system(["bluetoothctl", "--timeout", "8", "scan", "on"], timeout=12)
    return {**bluetooth_devices(False), "message": "Bluetooth scan complete."}


def toggle_bluetooth(payload: dict[str, Any]) -> dict[str, Any]:
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
        "ollama": ollama_status(),
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

    settings = read_settings()
    model_kind, model = choose_model(payload.command, settings, payload.easy_model, payload.hard_model)
    result = ollama_generate(model, payload.command)
    result["model"] = model_kind
    return result


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


@app.get("/api/signal/status")
def api_signal_status() -> dict[str, Any]:
    return signal_status()


@app.get("/api/signal/radio/status")
def api_signal_radio_status() -> dict[str, Any]:
    return {"ok": True, "radio": radio_status()}


@app.get("/api/signal/aircraft/status")
def api_signal_aircraft_status() -> dict[str, Any]:
    return {"ok": True, "aircraft": aircraft_status()}


@app.get("/api/remote-camera/status")
def api_remote_camera_status(request: Request) -> dict[str, Any]:
    cleanup_remote_sessions()
    settings = read_settings()
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
        "privacy_mode": bool(settings.get("remote_camera_privacy_mode", True)),
        "high_security": bool(settings.get("remote_camera_high_security", False)),
        "security_snapshots": bool(settings.get("remote_camera_security_snapshots", False)),
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
    for source, target in [
        ("camera_enabled", "camera_enabled"),
        ("privacy_mode", "remote_camera_privacy_mode"),
        ("high_security", "remote_camera_high_security"),
        ("security_snapshots", "remote_camera_security_snapshots"),
    ]:
        if source in payload:
            patch[target] = bool(payload[source])
    if "failed_attempt_threshold" in payload:
        try:
            patch["remote_camera_failed_attempt_threshold"] = max(1, min(20, int(payload.get("failed_attempt_threshold"))))
        except (TypeError, ValueError):
            pass
    password = str(payload.get("password") or "")
    if password:
        patch["remote_camera_password_hash"] = hash_remote_camera_password(password)
    next_settings = patch_settings(patch) if patch else settings
    return {"ok": True, "settings": {
        "mode": next_settings.get("remote_camera_access_mode", "disabled"),
        "camera_enabled": bool(next_settings.get("camera_enabled", True)),
        "privacy_mode": bool(next_settings.get("remote_camera_privacy_mode", True)),
        "high_security": bool(next_settings.get("remote_camera_high_security", False)),
        "security_snapshots": bool(next_settings.get("remote_camera_security_snapshots", False)),
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
    password_hash = hash_remote_camera_password(str(payload.get("password") or ""))
    if not secrets.compare_digest(password_hash, expected_hash):
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


def camera_jpeg_frame(device: int = 0) -> bytes | None:
    try:
        import cv2  # type: ignore
    except Exception:
        return None
    cap = cv2.VideoCapture(device)
    try:
        if not cap.isOpened():
            return None
        ok, frame = cap.read()
        if not ok:
            return None
        ok, encoded = cv2.imencode(".jpg", frame)
        if not ok:
            return None
        return encoded.tobytes()
    finally:
        cap.release()


@app.get("/api/remote-camera/snapshot")
def api_remote_camera_snapshot(request: Request, token: str = ""):
    blocked = remote_camera_guard(request, token)
    if blocked:
        return blocked
    settings = read_settings()
    frame = camera_jpeg_frame(int(settings.get("camera_device", 0)))
    if frame is None:
        return {"ok": False, "error": "Camera stream is unavailable on this device."}
    if settings.get("remote_camera_security_snapshots", False):
        REMOTE_CAMERA_SNAPSHOT_DIR.mkdir(exist_ok=True)
        client = (request.client.host if request.client else "local").replace(":", "_").replace(".", "_")
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        (REMOTE_CAMERA_SNAPSHOT_DIR / f"{stamp}-{client}.jpg").write_bytes(frame)
    return Response(content=frame, media_type="image/jpeg")


@app.get("/api/remote-camera/stream")
def api_remote_camera_stream(request: Request, token: str = ""):
    blocked = remote_camera_guard(request, token)
    if blocked:
        return blocked

    def frames():
        while True:
            frame = camera_jpeg_frame(int(read_settings().get("camera_device", 0)))
            if frame is None:
                break
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            time.sleep(0.35)

    return StreamingResponse(frames(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.post("/api/device/restart-backend")
def api_restart_backend(request: Request) -> dict[str, Any]:
    blocked = device_control_guard(request)
    if blocked:
        return blocked
    return {
        "ok": False,
        "error": "Backend restart is a protected placeholder. Restart the systemd service or start-kiosk.sh process from the terminal.",
    }


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
