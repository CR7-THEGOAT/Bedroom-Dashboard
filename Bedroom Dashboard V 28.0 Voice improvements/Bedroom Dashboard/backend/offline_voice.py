from __future__ import annotations

import array
import json
import math
import os
import queue
import re
import threading
import time
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


DEFAULT_MODEL_DIR = "models/vosk-model-small-en-us-0.15"
WAKE_PREFIXES = ("hey", "hi", "ok", "okay")


def _now_ms() -> int:
    return int(time.time() * 1000)


def _normalize_text(value: str) -> str:
    text = str(value or "").lower().strip()
    text = re.sub(r"[^a-z0-9\u0600-\u06ff\s]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    replacements = {
        "hey nick": "hey nexora",
        "hey nora": "hey nexora",
        "hey nexus": "hey nexora",
        "hey nexar": "hey nexora",
        "hey nex": "hey nexora",
        "hey next": "hey nexora",
        "hey next order": "hey nexora",
        "hey next door": "hey nexora",
        "hey next era": "hey nexora",
        "hey next row": "hey nexora",
        "hey next or a": "hey nexora",
        "hey next ore": "hey nexora",
        "hey next ira": "hey nexora",
        "hey nex ore": "hey nexora",
        "next aura": "nexora",
        "next sora": "nexora",
        "next door": "nexora",
        "next era": "nexora",
        "next row": "nexora",
        "next order": "nexora",
        "next oral": "nexora",
        "next or a": "nexora",
        "next or": "nexora",
        "next ore": "nexora",
        "next ira": "nexora",
        "nextora": "nexora",
        "neck sora": "nexora",
        "nick sora": "nexora",
        "nick zora": "nexora",
        "nick's aura": "nexora",
        "nicks aura": "nexora",
        "nix zora": "nexora",
        "nixora": "nexora",
        "nexaura": "nexora",
        "nex aura": "nexora",
        "nex or a": "nexora",
        "nex ore": "nexora",
        "nex order": "nexora",
        "exora": "nexora",
        "nexus": "nexora",
        "nexa": "nexora",
        "hey next aura": "hey nexora",
        "hey next sora": "hey nexora",
    }
    for source, target in sorted(replacements.items(), key=lambda item: len(item[0]), reverse=True):
        pattern = rf"(?<![a-z0-9]){re.escape(source)}(?![a-z0-9])"
        text = re.sub(pattern, target, text)
    return text


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        clean = _normalize_text(value)
        if clean and clean not in seen:
            seen.add(clean)
            result.append(clean)
    return result


def _wake_phrases(settings: dict[str, Any]) -> list[str]:
    assistant = str(settings.get("assistant_name") or settings.get("assistantName") or "Nexora").strip()
    custom = str(settings.get("custom_wake_phrase") or settings.get("customWakePhrase") or "").strip()
    assistant_clean = _normalize_text(assistant)
    primary_names = [assistant]
    aliases: list[str] = []
    if assistant_clean == "nexora":
        primary_names += ["Nexora"]
        aliases += [
            "next aura",
            "next sora",
            "next door",
            "next era",
            "next or a",
            "next order",
            "next row",
            "next ira",
            "nex aura",
            "nex order",
            "exora",
            "nexus",
            "nexa",
            "nexar",
            "nex ore",
            "nixora",
            "nora",
            "nick",
            "nicks aura",
            "nick sora",
            "nick zora",
        ]
    custom_clean = _normalize_text(custom)
    if assistant_clean in {"d", "dee"} or custom_clean in {"d", "dee", "hey d", "hey dee"}:
        primary_names += ["D", "Dee"]
    phrases = [
        custom,
    ]
    for name in primary_names:
        phrases += [
            *(f"{prefix} {name}" for prefix in WAKE_PREFIXES),
        ]
    for alias in aliases:
        phrases += [f"{prefix} {alias}" for prefix in WAKE_PREFIXES]
    return _unique(phrases)


def _ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def _cleanup_command(command: str) -> str:
    clean = _normalize_text(command)
    clean = re.sub(r"^(please|can you|could you|would you|will you)\s+", "", clean)
    return clean.strip()


def _valid_command(command: str) -> bool:
    clean = _cleanup_command(command)
    if len(clean) < 3:
        return False
    if clean in {"uh", "um", "ah", "oh", "the", "and", "yeah", "yes", "no", "okay", "ok"}:
        return False
    if len(clean.split()) == 1 and len(clean) < 4:
        return False
    return True


def _find_wake_and_command(text: str, settings: dict[str, Any]) -> tuple[str, str]:
    clean = _normalize_text(text)
    if not clean:
        return "", ""
    words = clean.split()
    phrases = sorted(_wake_phrases(settings), key=lambda item: len(_normalize_text(item)), reverse=True)

    for phrase in phrases:
        clean_phrase = _normalize_text(phrase)
        if not clean_phrase:
            continue
        pattern = rf"(^|\s){re.escape(clean_phrase)}(?=\s|$)"
        match = re.search(pattern, clean)
        if match:
            return clean_phrase, _cleanup_command(clean[match.end():])

    # Vosk often gets the wake word close but not exact. Fuzzy-match the first
    # few words and short sliding windows so a clipped "hey nex..." still wakes.
    for phrase in phrases:
        clean_phrase = _normalize_text(phrase)
        phrase_words = clean_phrase.split()
        if not phrase_words or len(phrase_words) > 3 or len(words) < len(phrase_words):
            continue
        threshold = 0.78 if len(clean_phrase) >= 5 else 0.92
        max_start = min(2, len(words) - len(phrase_words))
        for start in range(max_start + 1):
            candidate = " ".join(words[start:start + len(phrase_words)])
            if phrase_words[0] in WAKE_PREFIXES and not any(_ratio(words[start], prefix) >= 0.75 for prefix in WAKE_PREFIXES):
                continue
            if _ratio(candidate, clean_phrase) >= threshold:
                return clean_phrase, _cleanup_command(" ".join(words[start + len(phrase_words):]))

    # Special handling for "hey/hi/ok" + a mangled assistant name.
    if words and words[0] in {"hey", "hi", "ok", "okay"} and len(words) >= 2:
        assistant = _normalize_text(settings.get("assistant_name") or settings.get("assistantName") or "nexora")
        aliases = [
            assistant,
            "nexora",
            "nextora",
            "next",
            "nexus",
            "nexa",
            "nexar",
            "nixora",
            "nora",
            "aura",
            "sora",
            "dee",
            "d",
        ]
        if any(_ratio(words[1], alias) >= 0.72 for alias in aliases if alias):
            return f"{words[0]} {words[1]}", _cleanup_command(" ".join(words[2:]))

    return "", ""


def _average_confidence(result: dict[str, Any]) -> float | None:
    words = result.get("result")
    if not isinstance(words, list):
        return None
    scores = []
    for word in words:
        if not isinstance(word, dict):
            continue
        try:
            scores.append(float(word.get("conf")))
        except (TypeError, ValueError):
            continue
    if not scores:
        return None
    return sum(scores) / len(scores)


def _float_setting(settings: dict[str, Any], names: tuple[str, ...], default: float, minimum: float, maximum: float) -> float:
    value: Any = None
    for name in names:
        candidate = settings.get(name)
        if candidate is not None and candidate != "":
            value = candidate
            break
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))


def _bool_setting(settings: dict[str, Any], names: tuple[str, ...], default: bool = False) -> bool:
    for name in names:
        if name not in settings:
            continue
        value = settings.get(name)
        if isinstance(value, bool):
            return value
        text = str(value or "").strip().lower()
        if text in {"1", "true", "yes", "on"}:
            return True
        if text in {"0", "false", "no", "off"}:
            return False
    return default


def _pcm16_stats(data: bytes) -> dict[str, Any]:
    try:
        samples = array.array("h")
        samples.frombytes(data)
        if not samples:
            return {"rms": 0.0, "peak": 0, "clipping_pct": 0.0, "samples": 0}
        peak = max(abs(int(sample)) for sample in samples)
        rms = math.sqrt(sum(int(sample) * int(sample) for sample in samples) / len(samples))
        clipped = sum(1 for sample in samples if abs(int(sample)) >= 32700)
        return {
            "rms": round(rms, 1),
            "peak": peak,
            "clipping_pct": round((clipped / len(samples)) * 100, 3),
            "samples": len(samples),
        }
    except Exception:
        return {"rms": 0.0, "peak": 0, "clipping_pct": 0.0, "samples": 0}


def _device_record(index: int, device: dict[str, Any]) -> dict[str, Any]:
    return {
        "index": index,
        "name": str(device.get("name", f"Input {index}")),
        "channels": int(device.get("max_input_channels", 0) or 0),
        "default_samplerate": int(float(device.get("default_samplerate", 16000) or 16000)),
    }


def _score_input_device(device: dict[str, Any]) -> int:
    name = str(device.get("name") or "").lower()
    channels = int(device.get("channels") or 0)
    samplerate = int(device.get("default_samplerate") or 0)
    if channels <= 0:
        return -10000
    score = 0
    if "microphone array" in name:
        score += 95
    if "microphone" in name:
        score += 80
    if re.search(r"\bmic\b", name):
        score += 70
    if "onboard" in name or "intel" in name or "smart sound" in name:
        score += 25
    if "capture" in name and ("microphone" in name or re.search(r"\bmic\b", name)):
        score += 18
    if samplerate == 16000:
        score += 8
    elif samplerate == 48000:
        score += 14
    elif samplerate == 44100:
        score += 8
    score += min(channels, 4)
    penalties = [
        "sound mapper",
        "primary sound capture",
        "stereo mix",
        "what u hear",
        "loopback",
        "output",
        "headphone",
        "speaker",
        "virtual",
    ]
    for penalty in penalties:
        if penalty in name:
            score -= 120
    return score


def _select_best_input_device(devices: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [device for device in devices if int(device.get("channels") or 0) > 0]
    if not candidates:
        return None
    return max(candidates, key=lambda device: (_score_input_device(device), -int(device.get("index") or 0)))


def _prepare_pcm16(data: bytes, settings: dict[str, Any]) -> bytes:
    gain = _float_setting(settings, ("offline_voice_input_gain", "offlineVoiceInputGain"), 3.0, 1.0, 8.0)
    target_rms = _float_setting(settings, ("offline_voice_target_rms", "offlineVoiceTargetRms"), 1400.0, 0.0, 8000.0)
    max_gain = _float_setting(settings, ("offline_voice_max_gain", "offlineVoiceMaxGain"), 5.0, 1.0, 12.0)
    noise_gate = _float_setting(settings, ("offline_voice_noise_gate", "offlineVoiceNoiseGate"), 120.0, 0.0, 2000.0)
    if not data or (gain <= 1.01 and target_rms <= 0 and noise_gate <= 0):
        return data
    try:
        samples = array.array("h")
        samples.frombytes(data)
        if not samples:
            return data
        rms = math.sqrt(sum(int(sample) * int(sample) for sample in samples) / len(samples))
        if noise_gate > 0 and rms < noise_gate:
            return b"\x00" * len(data)
        active_gain = min(max_gain, max(gain, target_rms / max(rms, 1.0) if target_rms > 0 else gain))
        if active_gain <= 1.01:
            return data
        boosted = array.array("h")
        append = boosted.append
        for sample in samples:
            value = int(round(sample * active_gain))
            append(max(-32768, min(32767, value)))
        return boosted.tobytes()
    except Exception:
        return data


class OfflineVoiceService:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._events: list[dict[str, Any]] = []
        self._event_id = 0
        self._settings: dict[str, Any] = {}
        self._running = False
        self._last_error = ""
        self._last_transcript = ""
        self._last_command = ""
        self._wake_until = 0.0
        self._last_partial_emit = 0.0
        self._audio_stats: dict[str, Any] = {}
        self._resolved_device: dict[str, Any] | None = None
        self._restart_count = 0
        self._last_audio_at = 0.0

    def _model_path(self, settings: dict[str, Any]) -> Path:
        configured = (
            os.environ.get("KISOKE_VOSK_MODEL_DIR")
            or settings.get("offline_voice_model_dir")
            or settings.get("offlineVoiceModelDir")
            or DEFAULT_MODEL_DIR
        )
        path = Path(str(configured)).expanduser()
        if not path.is_absolute():
            path = self.project_root / path
        return path

    def _dependency_status(self) -> dict[str, Any]:
        missing: list[str] = []
        try:
            import vosk  # noqa: F401
        except Exception:
            missing.append("vosk")
        try:
            import sounddevice  # noqa: F401
        except Exception:
            missing.append("sounddevice")
        return {
            "ok": not missing,
            "missing": missing,
            "install": "backend/.venv/Scripts/python.exe -m pip install vosk sounddevice"
            if os.name == "nt"
            else "backend/.venv/bin/pip install vosk sounddevice",
        }

    def _input_devices(self) -> list[dict[str, Any]]:
        import sounddevice as sd

        devices = []
        for index, device in enumerate(sd.query_devices()):
            record = _device_record(index, device)
            if record["channels"] <= 0:
                continue
            record["score"] = _score_input_device(record)
            devices.append(record)
        recommended = _select_best_input_device(devices)
        for record in devices:
            record["recommended"] = bool(recommended and record["index"] == recommended["index"])
        return sorted(devices, key=lambda item: (not item.get("recommended"), -int(item.get("score") or 0), int(item.get("index") or 0)))

    def _probe_input_device(self, device: dict[str, Any], duration: float = 0.38) -> dict[str, Any]:
        import sounddevice as sd

        sample_rate = int(device.get("default_samplerate") or 16000)
        audio_queue: queue.Queue[bytes] = queue.Queue(maxsize=10)

        def callback(indata: bytes, frames: int, time_info: Any, status: Any) -> None:
            try:
                audio_queue.put_nowait(bytes(indata))
            except queue.Full:
                pass

        chunks: list[bytes] = []
        error = ""
        try:
            with sd.RawInputStream(
                samplerate=sample_rate,
                blocksize=max(1600, int(sample_rate * 0.18)),
                dtype="int16",
                channels=1,
                callback=callback,
                device=int(device["index"]),
            ):
                end_at = time.time() + max(0.15, duration)
                while time.time() < end_at:
                    try:
                        chunks.append(audio_queue.get(timeout=0.12))
                    except queue.Empty:
                        pass
        except Exception as probe_error:
            error = str(probe_error)

        data = b"".join(chunks)
        stats = _pcm16_stats(data)
        return {
            "ok": bool(chunks) and not error,
            "chunks": len(chunks),
            "sample_rate": sample_rate,
            "error": error,
            **stats,
        }

    def _resolve_input_device(self, settings: dict[str, Any]) -> tuple[int | str | None, dict[str, Any] | None]:
        requested = settings.get("offline_voice_device") or settings.get("offlineVoiceDevice") or "auto"
        if str(requested).strip().lower() in {"", "auto", "default"}:
            devices = self._input_devices()
            probed: list[dict[str, Any]] = []
            for device in devices:
                if int(device.get("score") or 0) < -50:
                    continue
                probe = self._probe_input_device(device)
                candidate = {**device, "probe": probe, "active_samplerate": probe.get("sample_rate")}
                probed.append(candidate)
                if probe.get("chunks") and (float(probe.get("rms") or 0) >= 5 or int(probe.get("peak") or 0) >= 80):
                    return int(candidate["index"]), candidate
            active = next((device for device in probed if device.get("probe", {}).get("chunks")), None)
            if active:
                return int(active["index"]), active
            best = _select_best_input_device(devices)
            if best:
                return int(best["index"]), best
            return None, None
        try:
            device_id: int | str = int(requested) if str(requested).strip().isdigit() else str(requested).strip()
        except Exception:
            device_id = str(requested).strip()
        try:
            devices = self._input_devices()
            for device in devices:
                if device["index"] == device_id or str(device["index"]) == str(device_id) or device["name"] == device_id:
                    return device_id, device
        except Exception:
            pass
        return device_id, None

    def _sample_rate(self, settings: dict[str, Any], device_info: dict[str, Any] | None) -> int:
        if device_info and int(device_info.get("active_samplerate") or 0) >= 8000:
            return int(device_info["active_samplerate"])
        configured = int(settings.get("offline_voice_sample_rate") or settings.get("offlineVoiceSampleRate") or 0)
        if 8000 <= configured <= 48000:
            return configured
        if device_info:
            samplerate = int(device_info.get("default_samplerate") or 16000)
            if 8000 <= samplerate <= 48000:
                return samplerate
        return 16000

    def _update_audio_stats(self, stats: dict[str, Any], gated: bool = False) -> None:
        with self._lock:
            previous = self._audio_stats
            self._last_audio_at = time.time()
            self._audio_stats = {
                **stats,
                "gated": gated,
                "updated_at": _now_ms(),
                "level": "hot" if stats.get("clipping_pct", 0) > 0.5 else "voice" if stats.get("rms", 0) >= 280 else "quiet",
                "blocks": int(previous.get("blocks") or 0) + 1,
            }

    def _push_event(self, event_type: str, text: str = "", **extra: Any) -> dict[str, Any]:
        with self._lock:
            self._event_id += 1
            event = {
                "id": self._event_id,
                "type": event_type,
                "text": text,
                "source": "vosk",
                "at": _now_ms(),
                **extra,
            }
            self._events.append(event)
            self._events = self._events[-80:]
            return event

    def status(self) -> dict[str, Any]:
        settings = dict(self._settings)
        deps = self._dependency_status()
        model_path = self._model_path(settings)
        with self._lock:
            audio_stats = dict(self._audio_stats)
            resolved_device = dict(self._resolved_device) if isinstance(self._resolved_device, dict) else None
        runtime_sample_rate = int((resolved_device or {}).get("sample_rate") or settings.get("offline_voice_sample_rate") or settings.get("offlineVoiceSampleRate") or 16000)
        return {
            "ok": bool(self._running),
            "running": self._running,
            "enabled": bool(settings.get("offline_voice_enabled") or settings.get("offlineVoice")),
            "engine": "vosk",
            "dependencies": deps,
            "model_path": str(model_path),
            "model_present": model_path.exists(),
            "device": settings.get("offline_voice_device") or settings.get("offlineVoiceDevice") or "auto",
            "resolved_device": resolved_device,
            "audio": audio_stats,
            "sample_rate": runtime_sample_rate,
            "input_gain": _float_setting(settings, ("offline_voice_input_gain", "offlineVoiceInputGain"), 3.0, 1.0, 8.0),
            "target_rms": _float_setting(settings, ("offline_voice_target_rms", "offlineVoiceTargetRms"), 1400.0, 0.0, 8000.0),
            "noise_gate": _float_setting(settings, ("offline_voice_noise_gate", "offlineVoiceNoiseGate"), 120.0, 0.0, 2000.0),
            "min_confidence": _float_setting(settings, ("offline_voice_min_confidence", "offlineVoiceMinConfidence"), 0.28, 0.0, 1.0),
            "wake_timeout": float(settings.get("offline_voice_wake_timeout") or settings.get("offlineVoiceWakeTimeout") or 8),
            "wake_phrases": _wake_phrases(settings),
            "last_transcript": self._last_transcript,
            "last_command": self._last_command,
            "restart_count": self._restart_count,
            "last_audio_at": int(self._last_audio_at * 1000) if self._last_audio_at else 0,
            "last_event_id": self._event_id,
            "last_error": self._last_error,
            "message": self._status_message(deps, model_path),
        }

    def _status_message(self, deps: dict[str, Any], model_path: Path) -> str:
        if self._running:
            return "Offline Vosk listener is running."
        if deps.get("missing"):
            return f"Missing Python packages: {', '.join(deps['missing'])}."
        if not model_path.exists():
            return f"Vosk model missing at {model_path}."
        if self._last_error:
            return self._last_error
        return "Offline listener is stopped."

    def events(self, since: int = 0) -> dict[str, Any]:
        with self._lock:
            clean_since = int(since or 0)
            events = [event for event in self._events if int(event.get("id", 0)) > clean_since]
            return {"ok": True, "events": events, "last_event_id": self._event_id, "running": self._running}

    def devices(self) -> dict[str, Any]:
        deps = self._dependency_status()
        if "sounddevice" in deps.get("missing", []):
            return {"ok": False, "devices": [], "error": "sounddevice is not installed.", "dependencies": deps}
        try:
            devices = self._input_devices()
            recommended = next((device for device in devices if device.get("recommended")), None)
            return {"ok": True, "devices": devices, "recommended": recommended}
        except Exception as error:
            return {"ok": False, "devices": [], "error": str(error)}

    def self_test(self, settings: dict[str, Any] | None = None) -> dict[str, Any]:
        active_settings = self._settings_snapshot(settings or {})
        cases = [
            ("hey nexora open dashboard", True, "open dashboard"),
            ("hey next order open settings", True, "open settings"),
            ("hi nora what time is it", True, "what time is it"),
            ("ok nick turn on voice replies", True, "turn on voice replies"),
            ("i asked a fat girl out on a date and she gave me a straight answer", False, ""),
            ("the next order was late and the room was noisy", False, ""),
            ("nick said the speaker was too loud", False, ""),
            ("nora is in the story but nobody said hey first", False, ""),
        ]
        results = []
        for text, should_wake, expected_command in cases:
            wake, command = _find_wake_and_command(text, active_settings)
            passed = bool(wake) == should_wake
            if expected_command:
                passed = passed and command == expected_command
            results.append({
                "text": text,
                "wake": wake,
                "command": command,
                "expected_wake": should_wake,
                "expected_command": expected_command,
                "passed": passed,
            })
        return {
            "ok": all(item["passed"] for item in results),
            "results": results,
            "status": self.status(),
            "devices": self.devices(),
        }

    def start(self, settings: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self._settings = dict(settings or {})
            if self._running:
                return self.status()

            deps = self._dependency_status()
            model_path = self._model_path(self._settings)
            if deps.get("missing"):
                self._last_error = f"Missing Python packages: {', '.join(deps['missing'])}."
                self._push_event("error", self._last_error)
                return self.status()
            if not model_path.exists():
                self._last_error = f"Vosk model missing at {model_path}."
                self._push_event("error", self._last_error)
                return self.status()

            self._stop_event.clear()
            self._last_error = ""
            self._last_transcript = ""
            self._last_command = ""
            self._wake_until = 0.0
            self._last_partial_emit = 0.0
            self._audio_stats = {}
            self._restart_count = 0
            self._last_audio_at = 0.0
            self._events = []
            self._event_id = 0
            self._thread = threading.Thread(target=self._run, args=(dict(self._settings),), name="kisoke-offline-voice", daemon=True)
            self._running = True
            self._thread.start()
            self._push_event("status", "Offline voice listener starting.")
            return self.status()

    def stop(self) -> dict[str, Any]:
        self._stop_event.set()
        with self._lock:
            self._running = False
            self._wake_until = 0.0
            self._push_event("status", "Offline voice listener stopped.")
        return self.status()

    def update_settings(self, settings: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self._settings = {**self._settings, **(settings or {})}
        return self.status()

    def _settings_snapshot(self, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
        with self._lock:
            return {**(fallback or {}), **self._settings}

    def _handle_text(self, text: str, settings: dict[str, Any], partial: bool = False, confidence: float | None = None) -> None:
        settings = self._settings_snapshot(settings)
        clean = _normalize_text(text)
        if not clean:
            return
        debug = _bool_setting(settings, ("offline_voice_debug", "offlineVoiceDebug", "voiceDebug"), False)
        if partial:
            now = time.time()
            if debug and now - self._last_partial_emit > 1.25:
                self._last_partial_emit = now
                self._push_event("transcript", text, partial=True)
            wake_match, _ = _find_wake_and_command(text, settings)
            if wake_match and now > self._wake_until:
                self._wake_until = now + float(settings.get("offline_voice_wake_timeout") or settings.get("offlineVoiceWakeTimeout") or 8)
                self._last_transcript = text
                self._push_event("wake", text, wake_phrase=wake_match, partial=True)
            return

        wake_match, wake_command = _find_wake_and_command(text, settings)
        now = time.time()
        inside_wake_window = now <= self._wake_until
        min_confidence = _float_setting(settings, ("offline_voice_min_confidence", "offlineVoiceMinConfidence"), 0.28, 0.0, 1.0)
        if confidence is not None and confidence < min_confidence and not wake_match and not inside_wake_window:
            if debug:
                self._push_event("noise", text, confidence=confidence, reason="low-confidence")
            return
        if not wake_match and not inside_wake_window:
            if debug:
                self._push_event("noise", text, confidence=confidence, reason="no-wake")
            return

        self._last_transcript = text
        self._push_event("transcript", text, partial=False, confidence=confidence)

        if wake_match:
            self._wake_until = now + float(settings.get("offline_voice_wake_timeout") or settings.get("offlineVoiceWakeTimeout") or 8)
            command = wake_command
            self._push_event("wake", text, wake_phrase=wake_match, confidence=confidence)
            if not command:
                return
        elif now <= self._wake_until:
            window_wake, window_command = _find_wake_and_command(text, settings)
            if window_wake and not window_command:
                return
            command = window_command if window_wake else _cleanup_command(text)
        else:
            return

        if _valid_command(command) and (confidence is None or confidence >= min_confidence or wake_match or inside_wake_window):
            self._last_command = command
            self._wake_until = 0.0
            self._push_event("command", command, command=command, confidence=confidence)

    def _run(self, settings: dict[str, Any]) -> None:
        restart_count = 0
        while not self._stop_event.is_set():
            with self._lock:
                self._running = True
            self._run_once(self._settings_snapshot(settings))
            if self._stop_event.is_set():
                break
            restart_count += 1
            with self._lock:
                self._restart_count = restart_count
            delay = min(10.0, 1.5 + restart_count * 0.75)
            self._push_event("status", f"Microphone listener stopped; retrying mic access in {delay:.1f}s.")
            end_at = time.time() + delay
            while time.time() < end_at and not self._stop_event.is_set():
                time.sleep(0.2)
        with self._lock:
            self._running = False

    def _run_once(self, settings: dict[str, Any]) -> None:
        try:
            import sounddevice as sd
            from vosk import KaldiRecognizer, Model

            requested_device = settings.get("offline_voice_device") or settings.get("offlineVoiceDevice") or "auto"
            device, device_info = self._resolve_input_device(settings)
            sample_rate = self._sample_rate(settings, device_info)
            resolved_device = {
                **(device_info or {}),
                "selected": device,
                "requested": requested_device,
                "sample_rate": sample_rate,
                "auto_selected": str(requested_device).strip().lower() in {"", "auto", "default"},
            }
            with self._lock:
                self._resolved_device = resolved_device
                self._settings = {
                    **self._settings,
                    "_resolved_offline_voice_device": resolved_device,
                    "offline_voice_sample_rate": sample_rate,
                }

            model = Model(str(self._model_path(settings)))
            recognizer = KaldiRecognizer(model, sample_rate)
            recognizer.SetWords(True)
            audio_queue: queue.Queue[bytes] = queue.Queue(maxsize=12)

            def callback(indata: bytes, frames: int, time_info: Any, status: Any) -> None:
                if status:
                    self._last_error = str(status)
                try:
                    audio_queue.put_nowait(bytes(indata))
                except queue.Full:
                    pass

            with sd.RawInputStream(
                samplerate=sample_rate,
                blocksize=max(3200, int(sample_rate * 0.35)),
                dtype="int16",
                channels=1,
                callback=callback,
                device=device,
            ):
                self._push_event("status", f"Offline voice listener ready on {resolved_device.get('name') or device or 'default input'}.")
                last_frame_at = time.time()
                while not self._stop_event.is_set():
                    try:
                        data = audio_queue.get(timeout=0.25)
                    except queue.Empty:
                        if time.time() - last_frame_at > 12:
                            raise RuntimeError("Microphone stream produced no audio frames for 12 seconds; retrying input device.")
                        continue
                    last_frame_at = time.time()
                    active_settings = self._settings_snapshot(settings)
                    raw_stats = _pcm16_stats(data)
                    prepared = _prepare_pcm16(data, active_settings)
                    prepared_stats = _pcm16_stats(prepared)
                    gated = prepared_stats.get("peak", 0) == 0 and raw_stats.get("peak", 0) > 0
                    self._update_audio_stats({**raw_stats, "processed_rms": prepared_stats.get("rms", 0.0), "processed_peak": prepared_stats.get("peak", 0)}, gated=gated)
                    if recognizer.AcceptWaveform(prepared):
                        result = json.loads(recognizer.Result() or "{}")
                        confidence = _average_confidence(result)
                        self._handle_text(str(result.get("text") or "").strip(), active_settings, partial=False, confidence=confidence)
                    else:
                        partial = json.loads(recognizer.PartialResult() or "{}").get("partial", "")
                        self._handle_text(str(partial or "").strip(), active_settings, partial=True)
        except Exception as error:
            self._last_error = f"Offline voice failed: {error}"
            self._push_event("error", self._last_error)
        finally:
            if self._stop_event.is_set():
                with self._lock:
                    self._running = False


_SERVICE: OfflineVoiceService | None = None


def get_offline_voice_service(project_root: Path) -> OfflineVoiceService:
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = OfflineVoiceService(project_root)
    return _SERVICE
