from __future__ import annotations

import json
import os
import queue
import re
import threading
import time
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


DEFAULT_MODEL_DIR = "models/vosk-model-small-en-us-0.15"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _normalize_text(value: str) -> str:
    text = str(value or "").lower().strip()
    text = re.sub(r"[^a-z0-9\u0600-\u06ff\s]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    replacements = {
        "hey nexus": "hey nexora",
        "hey next door": "hey nexora",
        "hey next era": "hey nexora",
        "next aura": "nexora",
        "next sora": "nexora",
        "next door": "nexora",
        "next era": "nexora",
        "next row": "nexora",
        "neck sora": "nexora",
        "nick sora": "nexora",
        "nicks aura": "nexora",
        "nixora": "nexora",
        "nexaura": "nexora",
        "nexus": "nexora",
        "nexa": "nexora",
        "nex or a": "nexora",
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
    names = [assistant]
    if assistant_clean == "nexora":
        names += [
            "next aura",
            "next sora",
            "next door",
            "next era",
            "next or a",
            "next order",
            "nex aura",
            "nexus",
            "nexa",
            "nexar",
            "nex ore",
            "nixora",
            "nicks aura",
            "nick sora",
        ]
    custom_clean = _normalize_text(custom)
    if assistant_clean in {"d", "dee"} or custom_clean in {"d", "dee", "hey d", "hey dee"}:
        names += ["D", "Dee"]
    phrases = [
        custom,
    ]
    for name in names:
        phrases += [
            name,
            f"hey {name}",
            f"hi {name}",
            f"ok {name}",
            f"okay {name}",
        ]
    return _unique(phrases)


def _ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def _cleanup_command(command: str) -> str:
    clean = _normalize_text(command)
    clean = re.sub(r"^(please|can you|could you|would you|will you)\s+", "", clean)
    return clean.strip()


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

    # Vosk often gets the wake word close but not exact. Fuzzy-match only the
    # first few words so normal background speech does not trigger commands.
    for phrase in phrases:
        clean_phrase = _normalize_text(phrase)
        phrase_words = clean_phrase.split()
        if not phrase_words or len(phrase_words) > 3 or len(words) < len(phrase_words):
            continue
        candidate = " ".join(words[:len(phrase_words)])
        threshold = 0.74 if len(clean_phrase) >= 5 else 0.9
        if _ratio(candidate, clean_phrase) >= threshold:
            return clean_phrase, _cleanup_command(" ".join(words[len(phrase_words):]))

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

    def _model_path(self, settings: dict[str, Any]) -> Path:
        configured = (
            os.environ.get("BEDROOM_DASHBOARD_VOSK_MODEL_DIR")
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
        return {
            "ok": bool(self._running),
            "running": self._running,
            "enabled": bool(settings.get("offline_voice_enabled") or settings.get("offlineVoice")),
            "engine": "vosk",
            "dependencies": deps,
            "model_path": str(model_path),
            "model_present": model_path.exists(),
            "device": settings.get("offline_voice_device") or settings.get("offlineVoiceDevice") or None,
            "sample_rate": int(settings.get("offline_voice_sample_rate") or settings.get("offlineVoiceSampleRate") or 16000),
            "wake_timeout": float(settings.get("offline_voice_wake_timeout") or settings.get("offlineVoiceWakeTimeout") or 8),
            "wake_phrases": _wake_phrases(settings),
            "last_transcript": self._last_transcript,
            "last_command": self._last_command,
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
            import sounddevice as sd

            devices = []
            for index, device in enumerate(sd.query_devices()):
                if int(device.get("max_input_channels", 0)) <= 0:
                    continue
                devices.append({
                    "index": index,
                    "name": device.get("name", f"Input {index}"),
                    "channels": int(device.get("max_input_channels", 0)),
                    "default_samplerate": int(float(device.get("default_samplerate", 16000))),
                })
            return {"ok": True, "devices": devices}
        except Exception as error:
            return {"ok": False, "devices": [], "error": str(error)}

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
            self._thread = threading.Thread(target=self._run, args=(dict(self._settings),), name="bedroom-dashboard-offline-voice", daemon=True)
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

    def _handle_text(self, text: str, settings: dict[str, Any], partial: bool = False) -> None:
        settings = self._settings_snapshot(settings)
        clean = _normalize_text(text)
        if not clean:
            return
        self._last_transcript = text
        if partial:
            now = time.time()
            if now - self._last_partial_emit > 1.25:
                self._last_partial_emit = now
                self._push_event("transcript", text, partial=True)
            return

        self._push_event("transcript", text, partial=False)
        wake_match, wake_command = _find_wake_and_command(text, settings)

        now = time.time()
        if wake_match:
            self._wake_until = now + float(settings.get("offline_voice_wake_timeout") or settings.get("offlineVoiceWakeTimeout") or 8)
            command = wake_command
            self._push_event("wake", text, wake_phrase=wake_match)
            if not command:
                return
        elif now <= self._wake_until:
            command = _cleanup_command(text)
        else:
            return

        if command:
            self._last_command = command
            self._wake_until = 0.0
            self._push_event("command", command, command=command)

    def _run(self, settings: dict[str, Any]) -> None:
        try:
            import sounddevice as sd
            from vosk import KaldiRecognizer, Model

            sample_rate = int(settings.get("offline_voice_sample_rate") or settings.get("offlineVoiceSampleRate") or 16000)
            device = settings.get("offline_voice_device") or settings.get("offlineVoiceDevice") or None
            if device in {"", "auto", "default"}:
                device = None
            try:
                device = int(device) if device is not None and str(device).strip().isdigit() else device
            except Exception:
                pass

            model = Model(str(self._model_path(settings)))
            recognizer = KaldiRecognizer(model, sample_rate)
            recognizer.SetWords(False)
            audio_queue: queue.Queue[bytes] = queue.Queue(maxsize=6)

            def callback(indata: bytes, frames: int, time_info: Any, status: Any) -> None:
                if status:
                    self._last_error = str(status)
                try:
                    audio_queue.put_nowait(bytes(indata))
                except queue.Full:
                    pass

            with sd.RawInputStream(
                samplerate=sample_rate,
                blocksize=8000,
                dtype="int16",
                channels=1,
                callback=callback,
                device=device,
            ):
                self._push_event("status", "Offline voice listener ready.")
                while not self._stop_event.is_set():
                    try:
                        data = audio_queue.get(timeout=0.25)
                    except queue.Empty:
                        continue
                    if recognizer.AcceptWaveform(data):
                        result = json.loads(recognizer.Result() or "{}")
                        self._handle_text(str(result.get("text") or "").strip(), settings, partial=False)
                    else:
                        partial = json.loads(recognizer.PartialResult() or "{}").get("partial", "")
                        self._handle_text(str(partial or "").strip(), settings, partial=True)
        except Exception as error:
            self._last_error = f"Offline voice failed: {error}"
            self._push_event("error", self._last_error)
        finally:
            with self._lock:
                self._running = False


_SERVICE: OfflineVoiceService | None = None


def get_offline_voice_service(project_root: Path) -> OfflineVoiceService:
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = OfflineVoiceService(project_root)
    return _SERVICE
