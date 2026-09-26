from __future__ import annotations

from collections import deque
from time import time
from typing import Any


def now_ts() -> float:
    return time()


def empty_motion() -> dict[str, Any]:
    return {
        "motion": False,
        "x": None,
        "y": None,
        "zone": "none",
        "strength": 0,
        "last_seen": None,
    }


def empty_brightness() -> dict[str, Any]:
    return {
        "brightness": 0,
        "raw": 0,
        "level": "unknown",
        "last_updated": None,
    }


def empty_face() -> dict[str, Any]:
    return {
        "face_detected": False,
        "confidence": 0,
        "x": None,
        "y": None,
        "w": None,
        "h": None,
        "position": "none",
        "distance": "unknown",
        "stable": False,
        "last_seen": None,
    }


def empty_status(mode: str = "sensor") -> dict[str, Any]:
    return {
        "connected": False,
        "camera_index": 0,
        "width": 640,
        "height": 480,
        "fps": 12,
        "actual_fps": 0,
        "stream_profile": "balanced",
        "stream_width": 480,
        "stream_height": 360,
        "stream_quality": 48,
        "sensor_active": False,
        "mode": mode,
        "last_frame_time": None,
        "error": None,
    }


def motion_zone(x: float | None) -> str:
    if x is None:
        return "none"
    if x < 0.25:
        return "left"
    if x < 0.45:
        return "center-left"
    if x <= 0.55:
        return "center"
    if x <= 0.75:
        return "center-right"
    return "right"


def brightness_level(percent: int) -> str:
    if percent <= 20:
        return "very_dark"
    if percent <= 40:
        return "dark"
    if percent <= 65:
        return "dim"
    if percent <= 85:
        return "bright"
    return "very_bright"


def face_position(x: float | None, w: float | None) -> str:
    if x is None or w is None:
        return "none"
    center = x + (w / 2)
    if center < 0.38:
        return "left"
    if center > 0.62:
        return "right"
    return "center"


def face_distance(w: float | None) -> str:
    if w is None:
        return "unknown"
    if w < 0.16:
        return "far"
    if w > 0.35:
        return "close"
    return "normal"


class CameraEventLog:
    def __init__(self, limit: int = 120) -> None:
        self._entries: deque[dict[str, Any]] = deque(maxlen=limit)

    def add(self, level: str, message: str, **extra: Any) -> None:
        self._entries.appendleft({
            "time": now_ts(),
            "level": level,
            "message": message,
            **extra,
        })

    def entries(self) -> list[dict[str, Any]]:
        return list(self._entries)
