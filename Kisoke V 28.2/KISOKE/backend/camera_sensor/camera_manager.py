from __future__ import annotations

import os
import platform
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any

from .sensor_state import (
    CameraEventLog,
    brightness_level,
    empty_brightness,
    empty_face,
    empty_motion,
    empty_status,
    face_distance,
    face_position,
    motion_zone,
    now_ts,
)

DEFAULT_CAMERA_CONTROLS: dict[str, Any] = {
    "brightness": 50,
    "contrast": 50,
    "saturation": 50,
    "sharpness": 50,
    "gain": 0,
    "auto_exposure": True,
    "exposure": -6,
    "auto_white_balance": True,
    "white_balance": 4500,
}

CAMERA_CONTROL_LIMITS: dict[str, tuple[float, float]] = {
    "brightness": (0, 100),
    "contrast": (0, 100),
    "saturation": (0, 100),
    "sharpness": (0, 100),
    "gain": (0, 100),
    "exposure": (-13, 0),
    "white_balance": (2800, 7000),
}


class CameraSensorManager:
    def __init__(self) -> None:
        self.width = 640
        self.height = 480
        self.fps = 24
        self.process_width = 192
        self.process_height = 144
        self.live_width = 1280
        self.live_height = 720
        self.jpeg_quality = 82
        self.stream_profile = "reference720"
        self.look_mode = "normal"
        self.mode = "sensor"
        self.camera_index = 0
        self.motion_area_threshold = 1000
        self.face_every_n_frames = 36
        self.motion_every_n_frames = 4
        self.jpeg_every_n_frames = 1
        self.brightness_interval = 0.35
        self.motion_interval = 0.22
        self.face_interval = 2.0
        self.camera_controls = dict(DEFAULT_CAMERA_CONTROLS)
        self.camera_control_status: dict[str, Any] = {
            "applied": {},
            "readback": {},
            "unsupported": [],
            "last_updated": None,
        }

        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._cap: Any | None = None
        self._cv2: Any | None = None
        self._face_detector: Any | None = None
        self._frame_count = 0
        self._last_gray: Any | None = None
        self._brightness_samples: deque[int] = deque(maxlen=10)
        self._face_first_seen: float | None = None
        self._face_last_seen: float | None = None
        self._latest_jpeg: bytes | None = None
        self._latest_jpeg_sequence = 0
        self._last_brightness_at = 0.0
        self._last_motion_at = 0.0
        self._last_face_at = 0.0
        self._frame_times: deque[float] = deque(maxlen=40)
        self._clahe_filter: Any | None = None
        self._switch_lock = threading.Lock()
        self._connected_at = 0.0
        self._generation = 0

        self._status = empty_status(self.mode)
        self._motion = empty_motion()
        self._brightness = empty_brightness()
        self._face = empty_face()
        self._log = CameraEventLog()

    def set_mode(self, mode: str, camera_index: int | None = None) -> dict[str, Any]:
        clean_mode = str(mode or "sensor").lower()
        if clean_mode not in {"off", "sensor", "privacy"}:
            clean_mode = "sensor"
        previous_index = self.camera_index
        with self._lock:
            self.mode = clean_mode
            if camera_index is not None:
                self.camera_index = max(0, min(12, int(camera_index)))
            self._status["mode"] = self.mode
        if clean_mode == "sensor":
            if previous_index != self.camera_index:
                self.stop(reason="camera changed")
                with self._lock:
                    self.mode = "sensor"
            self.start(self.camera_index)
        else:
            self.stop(reason=f"{clean_mode} mode")
        return self.snapshot()

    def switch_camera(self, camera_index: int, *, force: bool = False) -> None:
        requested_index = max(0, min(12, int(camera_index)))
        with self._lock:
            already_selected = self.camera_index == requested_index
            thread_alive = bool(self._thread and self._thread.is_alive())
            self.camera_index = requested_index
            self._status["camera_index"] = requested_index
            self._latest_jpeg = None
            self._latest_jpeg_sequence = 0
            self._last_gray = None
            self._brightness_samples.clear()
        if already_selected and thread_alive and not force:
            return
        if thread_alive:
            self.stop(reason="camera switched")
            deadline = time.time() + 0.55
            while time.time() < deadline:
                with self._lock:
                    thread = self._thread
                    if thread is None or not thread.is_alive():
                        self._thread = None
                        break
                time.sleep(0.03)
        with self._lock:
            self.mode = "sensor"
            self._thread = None
            self._status.update({
                "camera_index": requested_index,
                "sensor_active": False,
                "error": "Switching camera...",
                "last_frame_time": None,
            })
        self.start(requested_index)

    def switch_camera_background(self, camera_index: int) -> None:
        requested_index = max(0, min(12, int(camera_index)))
        with self._lock:
            self.mode = "sensor"
            self._status.update({
                "camera_index": requested_index,
                "sensor_active": False,
                "error": "Switching camera...",
            })

        def worker() -> None:
            self._switch_lock.acquire()
            try:
                self.switch_camera(requested_index, force=True)
            finally:
                self._switch_lock.release()

        threading.Thread(target=worker, name="kisoke-camera-switch", daemon=True).start()

    def set_stream_settings(self, settings: dict[str, Any]) -> None:
        with self._lock:
            previous = (self.live_width, self.live_height, self.fps)
            self.stream_profile = str(settings.get("profile") or self.stream_profile)
            self.fps = max(1, min(150, int(settings.get("fps", self.fps))))
            self.jpeg_quality = max(20, min(95, int(settings.get("quality", self.jpeg_quality))))
            self.live_width = max(160, min(1920, int(settings.get("width", self.live_width))))
            self.live_height = max(120, min(1080, int(settings.get("height", self.live_height))))
            cap = self._cap
            cv2 = self._cv2
            self._status.update({
                "fps": self.fps,
                "stream_profile": self.stream_profile,
                "stream_width": self.live_width,
                "stream_height": self.live_height,
                "stream_quality": self.jpeg_quality,
            })
        if cap is not None and cv2 is not None and previous != (self.live_width, self.live_height, self.fps):
            self._configure_capture(cv2, cap)

    def set_camera_controls(self, controls: dict[str, Any] | None) -> dict[str, Any]:
        clean = self._normalize_camera_controls(controls or {})
        with self._lock:
            self.camera_controls = clean
            cap = self._cap
            cv2 = self._cv2
            self._status["camera_controls"] = dict(self.camera_controls)
        if cap is not None and cv2 is not None:
            return self._apply_camera_controls(cv2, cap)
        with self._lock:
            return dict(self.camera_control_status)

    def set_look_mode(self, mode: str | None) -> None:
        clean = str(mode or "normal").lower()
        if clean not in {"normal", "dark-room", "night-vision", "bright-room", "manual"}:
            clean = "normal"
        with self._lock:
            self.look_mode = clean
            self._status["camera_look_mode"] = clean

    def start(self, camera_index: int = 0) -> None:
        requested_index = max(0, min(12, int(camera_index)))
        with self._lock:
            thread_alive = bool(self._thread and self._thread.is_alive())
            current_index = self.camera_index
        if thread_alive and current_index != requested_index:
            self.stop(reason="camera changed")
        with self._lock:
            self.camera_index = requested_index
            self.mode = "sensor"
            if self._thread and self._thread.is_alive() and current_index == requested_index:
                return
            self._stop.clear()
            self._generation += 1
            generation = self._generation
            self._thread = threading.Thread(target=self._loop, args=(generation,), name="kisoke-local-camera-sensor", daemon=True)
            self._thread.start()
            self._log.add("info", "Local camera sensor starting", camera_index=self.camera_index)

    def stop(self, reason: str = "stopped") -> None:
        thread = None
        self._stop.set()
        with self._lock:
            self._generation += 1
            thread = self._thread
            self._release_capture_locked()
            self._latest_jpeg = None
            self._latest_jpeg_sequence = 0
            self._last_gray = None
            self._status.update({
                "connected": False,
                "sensor_active": False,
                "mode": self.mode,
                "error": None if self.mode in {"off", "privacy"} else reason,
            })
            if self.mode == "privacy":
                self._status["privacy_mode"] = True
            self._log.add("info", f"Local camera sensor {reason}", mode=self.mode)
        if thread and thread.is_alive() and threading.current_thread() is not thread:
            thread.join(timeout=0.12)
        with self._lock:
            if self._thread and not self._thread.is_alive():
                self._thread = None

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "camera": dict(self._status),
                "motion": dict(self._motion),
                "brightness": dict(self._brightness),
                "face": dict(self._face),
                "mode": self.mode,
                "logs": self._log.entries()[:20],
            }

    def status(self) -> dict[str, Any]:
        return self.snapshot()["camera"]

    def motion(self) -> dict[str, Any]:
        return self.snapshot()["motion"]

    def brightness(self) -> dict[str, Any]:
        return self.snapshot()["brightness"]

    def face(self) -> dict[str, Any]:
        return self.snapshot()["face"]

    def logs(self) -> list[dict[str, Any]]:
        with self._lock:
            return self._log.entries()

    def latest_jpeg(self) -> bytes | None:
        with self._lock:
            return self._latest_jpeg

    def latest_jpeg_info(self) -> tuple[bytes | None, int, float | None]:
        with self._lock:
            return self._latest_jpeg, self._latest_jpeg_sequence, self._status.get("last_frame_time")

    def _loop(self, generation: int) -> None:
        try:
            cv2 = self._import_cv2()
            self._cv2 = cv2
        except Exception as error:
            self._set_error(f"OpenCV is not installed: {error}")
            return

        while not self._stop.is_set() and self._is_generation_active(generation):
            with self._lock:
                requested_index = int(self.camera_index)
            cap = self._open_capture(self._cv2, requested_index)
            if cap is None or not cap.isOpened():
                self._set_error("Local camera unavailable")
                with self._lock:
                    self._status["sensor_active"] = False
                return

            with self._lock:
                if not self._is_generation_active(generation):
                    try:
                        cap.release()
                    except Exception:
                        pass
                    return
                self._cap = cap
                self._connected_at = now_ts()
                self._status = {
                    "connected": True,
                    "camera_index": requested_index,
                    "width": self.width,
                    "height": self.height,
                    "fps": self.fps,
                    "stream_profile": self.stream_profile,
                    "stream_width": self.live_width,
                    "stream_height": self.live_height,
                    "stream_quality": self.jpeg_quality,
                    "camera_look_mode": self.look_mode,
                    "camera_controls": dict(self.camera_controls),
                    "camera_control_status": dict(self.camera_control_status),
                    "sensor_active": True,
                    "mode": self.mode,
                    "last_frame_time": None,
                    "error": None,
                }
                self._log.add("info", "Local camera connected", camera_index=requested_index)

            while not self._stop.is_set() and self._is_generation_active(generation):
                started = time.time()
                ok, frame = cap.read()
                if not ok or frame is None:
                    self._set_error("Local camera returned no frame")
                    with self._lock:
                        self._status["sensor_active"] = False
                    return
                self._process_frame(frame)
                elapsed = time.time() - started
                frame_interval = 1 / max(1, int(self.fps))
                if elapsed < frame_interval:
                    time.sleep(frame_interval - elapsed)

            with self._lock:
                self._release_capture_locked()
            if not self._stop.is_set() and self._is_generation_active(generation):
                return

    def _is_generation_active(self, generation: int) -> bool:
        with self._lock:
            return generation == self._generation

    def _import_cv2(self):
        import cv2  # type: ignore

        return cv2

    def _open_capture(self, cv2: Any, camera_index: int):
        backends: list[int] = []
        if platform.system() == "Windows":
            backends.append(getattr(cv2, "CAP_MSMF", 1400))
            if str(os.environ.get("KISOKE_CAMERA_ALLOW_DSHOW", "")).lower() in {"1", "true", "yes", "on"}:
                backends.append(getattr(cv2, "CAP_DSHOW", 700))
        backends.append(getattr(cv2, "CAP_ANY", 0))
        for backend in backends:
            cap = cv2.VideoCapture(camera_index, backend)
            if cap.isOpened():
                self._configure_capture(cv2, cap)
                return cap
            cap.release()
        return None

    def _configure_capture(self, cv2: Any, cap: Any) -> None:
        target_width = max(self.process_width, min(1920, int(self.live_width)))
        target_height = max(self.process_height, min(1080, int(self.live_height)))
        try:
            cap.set(getattr(cv2, "CAP_PROP_FOURCC", 6), cv2.VideoWriter_fourcc(*"MJPG"))
        except Exception:
            pass
        for prop, value in [
            (getattr(cv2, "CAP_PROP_FRAME_WIDTH", 3), target_width),
            (getattr(cv2, "CAP_PROP_FRAME_HEIGHT", 4), target_height),
            (getattr(cv2, "CAP_PROP_FPS", 5), self.fps),
            (getattr(cv2, "CAP_PROP_BUFFERSIZE", 38), 1),
        ]:
            try:
                cap.set(prop, value)
            except Exception:
                pass
        with self._lock:
            self.width = target_width
            self.height = target_height
        self._apply_camera_controls(cv2, cap)

    def _normalize_camera_controls(self, controls: dict[str, Any]) -> dict[str, Any]:
        clean = dict(DEFAULT_CAMERA_CONTROLS)
        clean.update(controls or {})
        for key, (minimum, maximum) in CAMERA_CONTROL_LIMITS.items():
            try:
                value = float(clean.get(key, DEFAULT_CAMERA_CONTROLS[key]))
            except (TypeError, ValueError):
                value = float(DEFAULT_CAMERA_CONTROLS[key])
            if key not in {"exposure", "white_balance"}:
                value = int(round(value))
            clean[key] = max(minimum, min(maximum, value))
        clean["brightness"] = int(clean["brightness"])
        clean["contrast"] = int(clean["contrast"])
        clean["saturation"] = int(clean["saturation"])
        clean["sharpness"] = int(clean["sharpness"])
        clean["gain"] = int(clean["gain"])
        clean["white_balance"] = int(clean["white_balance"])
        clean["exposure"] = round(float(clean["exposure"]), 2)
        clean["auto_exposure"] = bool(clean.get("auto_exposure", True))
        clean["auto_white_balance"] = bool(clean.get("auto_white_balance", True))
        return clean

    def _apply_camera_controls(self, cv2: Any, cap: Any) -> dict[str, Any]:
        prop_names = {
            "brightness": "CAP_PROP_BRIGHTNESS",
            "contrast": "CAP_PROP_CONTRAST",
            "saturation": "CAP_PROP_SATURATION",
            "sharpness": "CAP_PROP_SHARPNESS",
            "gain": "CAP_PROP_GAIN",
            "exposure": "CAP_PROP_EXPOSURE",
            "auto_exposure": "CAP_PROP_AUTO_EXPOSURE",
            "white_balance": "CAP_PROP_WB_TEMPERATURE",
            "auto_white_balance": "CAP_PROP_AUTO_WB",
        }
        applied: dict[str, Any] = {}
        readback: dict[str, Any] = {}
        unsupported: list[str] = []

        with self._lock:
            controls = dict(self.camera_controls)
            camera_index = int(self.camera_index)
            look_mode = self.look_mode

        # Per-camera correction from real captures in Saeed's room, 2026-06-12:
        # - Device 0 / laptop camera: -2 keeps the face readable even with the
        #   ceiling light blown out, matching the Windows Camera reference.
        # - Device 1 / Lenovo USB door view: -5 is the cleanest normal-room balance.
        # Manual mode intentionally respects the UI sliders.
        if platform.system() == "Windows" and look_mode == "normal":
            controls["gain"] = 0
            if camera_index == 0:
                # The integrated laptop camera behaves closer to Lenovo Camera
                # when the driver keeps auto exposure. Software post-processing
                # below handles the bright ceiling without crushing the face.
                controls["auto_exposure"] = True
            elif camera_index == 1:
                controls["auto_exposure"] = False
                controls["exposure"] = -5.0

        windows_driver = platform.system() == "Windows"
        for key, prop_name in prop_names.items():
            prop = getattr(cv2, prop_name, None)
            if prop is None:
                unsupported.append(key)
                continue
            if (
                key in {"brightness", "contrast", "saturation", "sharpness", "gain", "exposure", "white_balance"}
                and controls.get(key) == DEFAULT_CAMERA_CONTROLS.get(key)
            ):
                try:
                    readback[key] = round(float(cap.get(prop)), 3)
                except Exception:
                    pass
                continue
            if controls.get("auto_exposure") and key in {"exposure", "gain"}:
                try:
                    readback[key] = round(float(cap.get(prop)), 3)
                except Exception:
                    pass
                continue
            if controls.get("auto_white_balance") and key == "white_balance":
                try:
                    readback[key] = round(float(cap.get(prop)), 3)
                except Exception:
                    pass
                continue
            if key == "auto_exposure":
                # Windows DShow wants 1 for auto. Linux V4L2 commonly uses 0.75 for auto and 0.25 for manual.
                value = (1.0 if controls.get(key) else 0.0) if windows_driver else (0.75 if controls.get(key) else 0.25)
            elif key == "auto_white_balance":
                value = 1 if controls.get(key) else 0
            else:
                value = controls.get(key)
            try:
                ok = bool(cap.set(prop, float(value)))
                current_value = cap.get(prop)
                readback[key] = round(float(current_value), 3)
                if ok:
                    applied[key] = controls.get(key) if key in controls else value
                else:
                    unsupported.append(key)
            except Exception:
                unsupported.append(key)

        status = {
            "applied": applied,
            "readback": readback,
            "unsupported": sorted(set(unsupported)),
            "last_updated": now_ts(),
        }
        with self._lock:
            self.camera_control_status = status
            self._status["camera_controls"] = dict(self.camera_controls)
            self._status["camera_control_status"] = dict(status)
        return status

    def _load_face_detector(self, cv2: Any):
        if self._face_detector is not None:
            return self._face_detector
        cascade_path = ""
        try:
            cascade_path = str(Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml")
        except Exception:
            cascade_path = ""
        if cascade_path and Path(cascade_path).exists():
            detector = cv2.CascadeClassifier(cascade_path)
            if not detector.empty():
                self._face_detector = detector
                return detector
        return None

    def _process_frame(self, frame: Any) -> None:
        cv2 = self._cv2
        if cv2 is None:
            return
        self._frame_count += 1
        timestamp = now_ts()

        needs_brightness = timestamp - self._last_brightness_at >= self.brightness_interval
        needs_motion = self._last_gray is None or timestamp - self._last_motion_at >= self.motion_interval
        needs_face = timestamp - self._last_face_at >= self.face_interval

        if needs_brightness or needs_motion or needs_face:
            gray_full = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray_full, (self.process_width, self.process_height), interpolation=cv2.INTER_AREA)
            if needs_brightness:
                self._process_brightness(gray, timestamp)
                self._last_brightness_at = timestamp
            if needs_motion:
                self._process_motion(cv2, gray, timestamp)
                self._last_motion_at = timestamp
            if needs_face:
                self._process_face(cv2, gray, timestamp)
                self._last_face_at = timestamp

        with self._lock:
            self._status["last_frame_time"] = timestamp
            self._frame_times.append(timestamp)
            if len(self._frame_times) >= 2:
                elapsed = self._frame_times[-1] - self._frame_times[0]
                if elapsed > 0:
                    self._status["actual_fps"] = round((len(self._frame_times) - 1) / elapsed, 1)

        if self._frame_count % self.jpeg_every_n_frames == 0:
            with self._lock:
                connected_age = timestamp - float(self._connected_at or timestamp)
                brightness_percent = int(self._brightness.get("brightness") or 0)
                look_mode = self.look_mode
            if look_mode == "normal" and connected_age < 2.5 and brightness_percent < 8:
                return
            live_frame = cv2.resize(frame, (self.live_width, self.live_height), interpolation=cv2.INTER_AREA)
            live_frame = self._enhance_live_frame(cv2, live_frame)
            ok, encoded = cv2.imencode(".jpg", live_frame, [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality])
            if ok:
                with self._lock:
                    self._latest_jpeg = encoded.tobytes()
                    self._latest_jpeg_sequence += 1

    def _enhance_live_frame(self, cv2: Any, frame: Any) -> Any:
        with self._lock:
            brightness_percent = int(self._brightness.get("brightness") or 0)
            look_mode = self.look_mode
        if brightness_percent <= 0:
            return frame

        if look_mode in {"normal", "manual"}:
            return self._normal_room_balance(cv2, frame)

        if look_mode == "bright-room":
            if brightness_percent > 55:
                return cv2.convertScaleAbs(frame, alpha=0.78, beta=-24)
            return cv2.convertScaleAbs(frame, alpha=0.9, beta=-8)

        if brightness_percent < 20:
            enhanced = self._gray_world_balance(cv2, frame)
            try:
                lab = cv2.cvtColor(enhanced, cv2.COLOR_BGR2LAB)
                l_channel, a_channel, b_channel = cv2.split(lab)
                l_channel = self._clahe(cv2).apply(l_channel)
                enhanced = cv2.cvtColor(cv2.merge((l_channel, a_channel, b_channel)), cv2.COLOR_LAB2BGR)
            except Exception:
                enhanced = frame

            gamma = 0.56 if look_mode == "night-vision" and brightness_percent < 8 else 0.72
            enhanced = self._apply_gamma(cv2, enhanced, gamma)
            if brightness_percent < 12:
                enhanced = cv2.bilateralFilter(enhanced, 5, 24, 24)
            alpha = 1.08 if look_mode == "night-vision" else 1.02
            beta = 10 if look_mode == "night-vision" else 4
            return cv2.convertScaleAbs(enhanced, alpha=alpha, beta=beta)

        if brightness_percent < 40:
            enhanced = self._apply_gamma(cv2, frame, 0.94)
            return cv2.convertScaleAbs(enhanced, alpha=1.01, beta=2)

        if brightness_percent > 62:
            return cv2.convertScaleAbs(frame, alpha=0.84, beta=-16)

        return frame

    def _normal_room_balance(self, cv2: Any, frame: Any) -> Any:
        """Balance harsh ceiling light against a darker foreground subject."""
        try:
            import numpy as np  # type: ignore

            with self._lock:
                camera_index = int(self.camera_index)

            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            l_channel, a_channel, b_channel = cv2.split(lab)

            l_float = l_channel.astype("float32") / 255.0
            if camera_index == 0:
                # The HD/laptop camera underexposes the subject when the ceiling
                # light is bright. Lift shadows/midtones while compressing only
                # the strongest highlights.
                compressed = np.where(
                    l_float > 0.78,
                    0.78 + (l_float - 0.78) * 0.50,
                    np.power(np.maximum(l_float, 0.0), 0.72),
                )
                l_channel = np.clip(compressed * 255.0 + 3.0, 0, 255).astype("uint8")
                merged = cv2.cvtColor(cv2.merge((l_channel, a_channel, b_channel)), cv2.COLOR_LAB2BGR)
                merged = merged.astype("float32")
                merged[:, :, 0] *= 0.92
                merged[:, :, 1] *= 1.0
                merged[:, :, 2] *= 1.08
                merged = np.clip(merged, 0, 255).astype("uint8")
                hsv = cv2.cvtColor(merged, cv2.COLOR_BGR2HSV).astype("float32")
                hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.04, 0, 255)
                merged = cv2.cvtColor(hsv.astype("uint8"), cv2.COLOR_HSV2BGR)
            else:
                # Lenovo/FHD path: keep the tested balanced look.
                compressed = np.where(
                    l_float > 0.76,
                    0.76 + (l_float - 0.76) * 0.58,
                    np.power(np.maximum(l_float, 0.0), 0.9),
                )
                l_channel = np.clip(compressed * 255.0, 0, 255).astype("uint8")
                merged = cv2.cvtColor(cv2.merge((l_channel, a_channel, b_channel)), cv2.COLOR_LAB2BGR)
                merged = merged.astype("float32")
                # The Lenovo USB camera skews cool in this room. Add a tiny
                # warm correction without making whites yellow.
                merged[:, :, 0] *= 0.965
                merged[:, :, 1] *= 1.0
                merged[:, :, 2] *= 1.035
                merged = np.clip(merged, 0, 255).astype("uint8")

            # Light crispness only; heavy filters made the stream slow and smeared.
            blurred = cv2.GaussianBlur(merged, (0, 0), 0.55)
            sharpened = cv2.addWeighted(merged, 1.06, blurred, -0.06, 0)
            return cv2.convertScaleAbs(sharpened, alpha=1.0, beta=0)
        except Exception:
            return frame

    def _clahe(self, cv2: Any) -> Any:
        if self._clahe_filter is None:
            self._clahe_filter = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8))
        return self._clahe_filter

    def _apply_gamma(self, cv2: Any, frame: Any, gamma: float) -> Any:
        try:
            import numpy as np  # type: ignore

            safe_gamma = max(0.35, min(1.6, float(gamma)))
            table = np.array([((index / 255.0) ** safe_gamma) * 255 for index in range(256)]).astype("uint8")
            return cv2.LUT(frame, table)
        except Exception:
            return frame

    def _gray_world_balance(self, cv2: Any, frame: Any) -> Any:
        try:
            import numpy as np  # type: ignore

            balanced = frame.astype("float32")
            means = balanced.reshape(-1, 3).mean(axis=0)
            target = float(means.mean())
            scales = np.clip(target / np.maximum(means, 1.0), 0.72, 1.28)
            balanced *= scales
            return np.clip(balanced, 0, 255).astype("uint8")
        except Exception:
            return frame

    def _process_brightness(self, gray: Any, timestamp: float) -> None:
        raw = int(gray.mean())
        self._brightness_samples.append(raw)
        smoothed_raw = int(sum(self._brightness_samples) / max(1, len(self._brightness_samples)))
        percent = int(round((smoothed_raw / 255) * 100))
        with self._lock:
            self._brightness = {
                "brightness": percent,
                "raw": smoothed_raw,
                "level": brightness_level(percent),
                "last_updated": timestamp,
            }

    def _process_motion(self, cv2: Any, gray: Any, timestamp: float) -> None:
        blurred = cv2.GaussianBlur(gray, (21, 21), 0)
        if self._last_gray is None:
            self._last_gray = blurred
            return

        frame_delta = cv2.absdiff(self._last_gray, blurred)
        self._last_gray = blurred
        threshold = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
        threshold = cv2.dilate(threshold, None, iterations=2)
        contours, _ = cv2.findContours(threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = [contour for contour in contours if cv2.contourArea(contour) >= self.motion_area_threshold]

        if not contours:
            with self._lock:
                last_seen = self._motion.get("last_seen")
                if last_seen and timestamp - float(last_seen) <= 1.7:
                    self._motion["motion"] = True
                else:
                    self._motion = empty_motion()
            return

        total_area = sum(float(cv2.contourArea(contour)) for contour in contours)
        moments_x = 0.0
        moments_y = 0.0
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = float(w * h)
            moments_x += (x + w / 2) * area
            moments_y += (y + h / 2) * area
        height, width = gray.shape[:2]
        x_norm = max(0.0, min(1.0, moments_x / max(1.0, total_area) / width))
        y_norm = max(0.0, min(1.0, moments_y / max(1.0, total_area) / height))
        strength = max(0.0, min(1.0, total_area / float(width * height * 0.18)))
        with self._lock:
            self._motion = {
                "motion": True,
                "x": round(x_norm, 3),
                "y": round(y_norm, 3),
                "zone": motion_zone(x_norm),
                "strength": round(strength, 3),
                "last_seen": timestamp,
            }

    def _process_face(self, cv2: Any, gray: Any, timestamp: float) -> None:
        detector = self._load_face_detector(cv2)
        detected_face = None
        if detector is not None:
            try:
                faces = detector.detectMultiScale(gray, scaleFactor=1.16, minNeighbors=5, minSize=(32, 32))
                if len(faces):
                    detected_face = max(faces, key=lambda item: item[2] * item[3])
            except Exception as error:
                self._log.add("warning", f"Face presence detector failed: {error}")

        if detected_face is None:
            with self._lock:
                if self._face_last_seen and timestamp - self._face_last_seen <= 8:
                    self._face["face_detected"] = False
                    self._face["stable"] = True
                else:
                    self._face = empty_face()
                    self._face_first_seen = None
            return

        x, y, w, h = [float(value) for value in detected_face]
        height, width = gray.shape[:2]
        x_norm = max(0.0, min(1.0, x / width))
        y_norm = max(0.0, min(1.0, y / height))
        w_norm = max(0.0, min(1.0, w / width))
        h_norm = max(0.0, min(1.0, h / height))
        if self._face_first_seen is None:
            self._face_first_seen = timestamp
        self._face_last_seen = timestamp
        stable = timestamp - self._face_first_seen >= 1.0
        with self._lock:
            self._face = {
                "face_detected": True,
                "confidence": 0.75,
                "x": round(x_norm, 3),
                "y": round(y_norm, 3),
                "w": round(w_norm, 3),
                "h": round(h_norm, 3),
                "position": face_position(x_norm, w_norm),
                "distance": face_distance(w_norm),
                "stable": stable,
                "last_seen": timestamp,
            }

    def _set_error(self, message: str) -> None:
        with self._lock:
            self._status.update({
                "connected": False,
                "camera_index": self.camera_index,
                "width": self.width,
                "height": self.height,
                "fps": self.fps,
                "stream_profile": self.stream_profile,
                "stream_width": self.live_width,
                "stream_height": self.live_height,
                "stream_quality": self.jpeg_quality,
                "camera_controls": dict(self.camera_controls),
                "camera_control_status": dict(self.camera_control_status),
                "sensor_active": False,
                "mode": self.mode,
                "error": message,
            })
            self._log.add("error", message, camera_index=self.camera_index)
            self._latest_jpeg = None
            self._latest_jpeg_sequence = 0

    def _release_capture_locked(self) -> None:
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:
                pass
        self._cap = None


_MANAGER = CameraSensorManager()


def get_camera_sensor_manager() -> CameraSensorManager:
    return _MANAGER
