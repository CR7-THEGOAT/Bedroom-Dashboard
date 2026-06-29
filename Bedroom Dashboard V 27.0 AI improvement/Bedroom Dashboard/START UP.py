#!/usr/bin/env python3
"""
Bedroom Dashboard one-command startup for Windows and Ubuntu.

Run:
  Windows: py "START UP.py"
  Ubuntu:  python3 "START UP.py"

What it does:
  - installs npm packages if missing
  - creates backend Python venv and installs backend requirements
  - installs Ollama when possible
  - downloads Bedroom Dashboard AI models into ./ollama when possible
  - starts backend on 8787
  - starts frontend HTTP on 5173
  - starts frontend HTTPS on 5174
"""

from __future__ import annotations

import os
import platform
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
OLLAMA_DIR = ROOT / "ollama"
LOGS = ROOT / "logs"
HTTP_PORT = int(os.environ.get("BEDROOM_DASHBOARD_HTTP_PORT", "5173"))
HTTPS_PORT = int(os.environ.get("BEDROOM_DASHBOARD_HTTPS_PORT", "5174"))
BACKEND_PORT = int(os.environ.get("BEDROOM_DASHBOARD_BACKEND_PORT", "8787"))
SKIP_MODELS = os.environ.get("BEDROOM_DASHBOARD_SKIP_AI_MODELS", "").lower() in {"1", "true", "yes", "on"}
MODELS = [
    "gemma2:2b",
    "phi3.5",
    "llama3.2",
    "qwen2.5:3b",
    "llama3.2:1b",
    "qwen3:4b",
]


def is_windows() -> bool:
    return platform.system().lower() == "windows"


def is_ubuntu_like() -> bool:
    return platform.system().lower() == "linux"


def print_step(message: str) -> None:
    print(f"\n== {message}", flush=True)


def run(command: list[str], cwd: Path | None = None, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess:
    print("+ " + " ".join(f'"{item}"' if " " in item else item for item in command), flush=True)
    return subprocess.run(command, cwd=str(cwd or ROOT), env=env, check=check)


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.35)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return ""


def find_python() -> str:
    return sys.executable or shutil.which("python3") or shutil.which("python") or "python"


def backend_python() -> Path:
    if is_windows():
        return BACKEND / ".venv" / "Scripts" / "python.exe"
    return BACKEND / ".venv" / "bin" / "python"


def ensure_windows_tooling() -> None:
    if not is_windows():
        return

    if not command_exists("npm"):
        if command_exists("winget"):
            print_step("Installing Node.js LTS with winget")
            run(["winget", "install", "--id", "OpenJS.NodeJS.LTS", "-e", "--accept-package-agreements", "--accept-source-agreements"], check=False)
        else:
            print("npm is missing. Install Node.js LTS from https://nodejs.org/ then run this again.")


def ensure_ubuntu_tooling() -> None:
    if not is_ubuntu_like():
        return

    if not command_exists("apt"):
        return

    packages = [
        "python3",
        "python3-venv",
        "python3-pip",
        "nodejs",
        "npm",
        "curl",
        "git",
        "ffmpeg",
        "espeak-ng",
        "brightnessctl",
        "network-manager",
        "bluetooth",
        "bluez",
        "pulseaudio-utils",
        "wireplumber",
    ]

    missing_basic = not command_exists("npm") or not command_exists("curl")
    if not missing_basic:
        return

    print_step("Installing Ubuntu system packages")
    sudo = ["sudo"] if command_exists("sudo") else []
    run(sudo + ["apt", "update"], check=False)
    run(sudo + ["apt", "install", "-y", *packages], check=False)


def ensure_node_dependencies() -> None:
    print_step("Checking frontend npm dependencies")
    if not command_exists("npm"):
        raise RuntimeError("npm is missing. Install Node.js LTS, then rerun START UP.py.")
    if not (ROOT / "node_modules").exists():
        run(["npm", "install"], cwd=ROOT)
    else:
        print("node_modules exists, skipping npm install.")


def ensure_backend_dependencies() -> Path:
    print_step("Checking backend Python dependencies")
    if not BACKEND.exists():
        raise RuntimeError("backend folder is missing.")

    py = backend_python()
    if not py.exists():
        run([find_python(), "-m", "venv", str(BACKEND / ".venv")], cwd=ROOT)

    requirements = BACKEND / "requirements.txt"
    if requirements.exists():
        run([str(py), "-m", "pip", "install", "-r", str(requirements)], cwd=BACKEND)
    else:
        run([str(py), "-m", "pip", "install", "fastapi", "uvicorn[standard]", "requests", "pyttsx3", "opencv-python-headless"], cwd=BACKEND)
    return py


def find_ollama() -> str | None:
    found = shutil.which("ollama")
    if found:
        return found
    if is_windows():
        candidates = [
            Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe",
            Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Ollama" / "ollama.exe",
        ]
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)
    return None


def ensure_ollama() -> str | None:
    print_step("Checking Ollama")
    ollama = find_ollama()
    if ollama:
        return ollama

    if is_windows() and command_exists("winget"):
        run(["winget", "install", "--id", "Ollama.Ollama", "-e", "--accept-package-agreements", "--accept-source-agreements"], check=False)
        return find_ollama()

    if is_ubuntu_like() and command_exists("curl"):
        run(["sh", "-c", "curl -fsSL https://ollama.com/install.sh | sh"], check=False)
        return find_ollama()

    print("Ollama is missing. Install it from https://ollama.com/download if model download fails.")
    return None


def start_ollama_if_needed(ollama: str, env: dict[str, str]) -> None:
    try:
        subprocess.run([ollama, "list"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=6, check=True)
        print("Ollama is running.")
        return
    except Exception:
        pass

    print_step("Starting Ollama")
    LOGS.mkdir(exist_ok=True)
    out = open(LOGS / "ollama-start.out.log", "ab")
    err = open(LOGS / "ollama-start.err.log", "ab")
    kwargs = {"cwd": str(ROOT), "env": env, "stdout": out, "stderr": err}
    if is_windows():
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    subprocess.Popen([ollama, "serve"], **kwargs)
    time.sleep(5)


def download_ai_models(env: dict[str, str]) -> None:
    if SKIP_MODELS:
        print("BEDROOM_DASHBOARD_SKIP_AI_MODELS is set, skipping model downloads.")
        return

    ollama = ensure_ollama()
    if not ollama:
        print("Skipping AI model downloads because Ollama is unavailable.")
        return

    start_ollama_if_needed(ollama, env)
    print_step("Downloading Ollama AI models")
    for model in MODELS:
        run([ollama, "pull", model], env=env, check=False)


def start_process(name: str, command: list[str], cwd: Path, env: dict[str, str], log_prefix: str) -> subprocess.Popen:
    LOGS.mkdir(exist_ok=True)
    print_step(f"Starting {name}")
    print("+ " + " ".join(command))
    out = open(LOGS / f"{log_prefix}.out.log", "ab")
    err = open(LOGS / f"{log_prefix}.err.log", "ab")
    kwargs = {"cwd": str(cwd), "env": env, "stdout": out, "stderr": err}
    if is_windows():
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    return subprocess.Popen(command, **kwargs)


def npm_command() -> str:
    return "npm.cmd" if is_windows() else "npm"


def start_servers(py: Path, env: dict[str, str]) -> list[subprocess.Popen]:
    processes: list[subprocess.Popen] = []

    if port_open(BACKEND_PORT):
        print(f"Backend already running on {BACKEND_PORT}.")
    else:
        processes.append(start_process(
            "backend",
            [str(py), "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(BACKEND_PORT)],
            BACKEND,
            env,
            "start-up-backend",
        ))
        time.sleep(2)

    if port_open(HTTP_PORT):
        print(f"HTTP frontend already running on {HTTP_PORT}.")
    else:
        http_env = dict(env)
        http_env["BEDROOM_DASHBOARD_HTTPS"] = ""
        http_env["VITE_HTTPS"] = ""
        processes.append(start_process(
            "frontend HTTP",
            [npm_command(), "run", "dev", "--", "--host", "0.0.0.0", "--port", str(HTTP_PORT)],
            ROOT,
            http_env,
            "start-up-vite-http",
        ))

    if port_open(HTTPS_PORT):
        print(f"HTTPS frontend already running on {HTTPS_PORT}.")
    else:
        https_env = dict(env)
        https_env["BEDROOM_DASHBOARD_HTTPS"] = "true"
        https_env["VITE_HTTPS"] = "true"
        processes.append(start_process(
            "frontend HTTPS",
            [npm_command(), "run", "dev", "--", "--host", "0.0.0.0", "--port", str(HTTPS_PORT)],
            ROOT,
            https_env,
            "start-up-vite-https",
        ))

    return processes


def print_urls() -> None:
    ip = local_ip()
    print("\nBedroom Dashboard is starting/running")
    print("=========================")
    print(f"Backend:       http://localhost:{BACKEND_PORT}/api/status")
    print(f"HTTP local:    http://localhost:{HTTP_PORT}")
    print(f"HTTPS local:   https://localhost:{HTTPS_PORT}")
    if ip:
        print(f"Phone HTTP:    http://{ip}:{HTTP_PORT}")
        print(f"Phone HTTPS:   https://{ip}:{HTTPS_PORT}")
        print(f"Camera HTTPS:  https://{ip}:{HTTPS_PORT}/localhost-camera")
        print(f"Radar HTTPS:   https://{ip}:{HTTPS_PORT}/radar")
    print("\nLeave this terminal open. Press Ctrl+C to stop processes started by this script.")
    print("Tip: set BEDROOM_DASHBOARD_SKIP_AI_MODELS=true to skip model downloads next time.")


def main() -> int:
    os.chdir(ROOT)
    OLLAMA_DIR.mkdir(exist_ok=True)
    LOGS.mkdir(exist_ok=True)

    env = dict(os.environ)
    env["OLLAMA_MODELS"] = str(OLLAMA_DIR)
    env["ALLOW_DEVICE_CONTROL"] = env.get("ALLOW_DEVICE_CONTROL", "true")

    try:
        ensure_windows_tooling()
        ensure_ubuntu_tooling()
        ensure_node_dependencies()
        py = ensure_backend_dependencies()
        download_ai_models(env)
        processes = start_servers(py, env)
        time.sleep(3)
        print_urls()

        while True:
            time.sleep(1)
            for process in processes:
                if process.poll() is not None:
                    print(f"Warning: a Bedroom Dashboard process exited with code {process.returncode}. Check logs folder.")
                    processes.remove(process)
                    break
    except KeyboardInterrupt:
        print("\nStopping Bedroom Dashboard processes started by this script...")
        return 0
    except Exception as error:
        print(f"\nSTART UP failed: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
