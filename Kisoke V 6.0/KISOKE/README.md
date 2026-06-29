# KISOKE

Local smart bedroom kiosk for Ubuntu/Linux, with Windows testing support.

## Part 1 - Code And What It Does

### Project Structure

```text
KISOKE/
  src/                         React/Vite frontend code
  backend/                     FastAPI local backend
  public/                      Static files and public assets
  music/                       Local music folder
  Custome Alarm Sounds/        Custom alarm/countdown sounds
  ollama/                      Local Ollama model folder
  models/                      Optional model notes/configs
  SETUP FILE.bat               Windows one-click setup + startup
  SETUP FILE.sh                Ubuntu full setup + startup
  START UP.py                  One-command Windows/Ubuntu launcher
  scripts/                     Windows, Ubuntu, install, and AI helper scripts
  Start Up/                    Manual and auto-start launchers split by OS
  docs/                        Extra help and structure notes
  logs/                        Runtime logs
```

### Frontend

Main file:

```text
src/main.jsx
```

What it does:

- Opens on the Clock page by default.
- Swipe right from Clock opens Tools.
- Swipe left from Clock opens Dashboard.
- Swipe left again opens Signal Center.
- Tools page includes Alarm, Countdown, Stopwatch, World Clock, and Prayer Focus.
- Dashboard includes widgets, AI helper, weather, prayer, market, music, system status, and device controls.
- Settings includes health/debug pages, software-needed page, notification previews, voice settings, theme settings, names, presence mode, and Time Deck settings.
- Health includes `Run Health Check`, per-issue `Fix now`, and a global `Fix now` repair button for backend, Ollama, AI models, camera, music, and local dependencies.
- Nexora can run local actions directly: open pages, start timers, change camera, play/pause music, summarize health, repair health, change voice/name settings, and control athan reminders.
- Athan voice can be disabled globally, made silent, or disabled per prayer such as Fajr.
- Quick Control Drawer opens by swiping down from the top.
- Presence Mode uses camera brightness/motion only. It does not use face identity or face recognition.

Main style file:

```text
src/styles.css
```

What it does:

- Controls the glossy/glassy UI.
- Controls page transitions.
- Controls Signal Center layout.
- Controls small glossy notifications.
- Controls dashboard widgets, clock visuals, weather backgrounds, and quick drawer styling.

### Backend

Main backend:

```text
backend/main.py
```

What it does:

- Runs on port `8787`.
- Connects the kiosk to Ollama.
- Provides local AI endpoints.
- Provides device control endpoints for brightness, volume, Wi-Fi, Bluetooth, Night Light, power mode, battery, Tailscale, and backend status.
- Blocks device control unless `ALLOW_DEVICE_CONTROL=true`.
- Allows device control only from localhost/private Wi-Fi/private Tailscale.

SDR backend:

```text
backend/sdr_services.py
```

What it does:

- Detects RTL-SDR tools and receiver status.
- Provides FM radio status.
- Provides ADS-B aircraft tracking status from local `dump1090` or `readsb`.
- Gracefully shows missing hardware/software instead of crashing.

Backend install list:

```text
backend/requirements.txt
```

What it installs:

- FastAPI
- Uvicorn
- Requests
- pyttsx3
- Optional OpenCV headless for backend camera brightness

### Main Pages

```text
Left page:        Tools
Middle page:      Clock
Right page:       Dashboard
Extra right page: Signal Center
Settings:         Health, debug, software, AI, device, theme, presence
```

### Hardware-Dependent Features

These need the real hardware/software installed:

- RTL-SDR FM radio needs RTL-SDR Blog V4 or compatible receiver plus `rtl-sdr`.
- Aircraft tracking needs RTL-SDR plus `dump1090` or `readsb`.
- Brightness needs `brightnessctl` or supported display controls.
- Wi-Fi needs NetworkManager and `nmcli`.
- Bluetooth needs BlueZ and `bluetoothctl`.
- Night Light works best on GNOME through `gsettings`.
- Always-on voice in a locked/background browser is limited by Chrome. True 24/7 voice needs a backend microphone service.

### Important URLs

```text
Frontend:       https://localhost:5173
Backend:        http://localhost:8787/api/status
Signal Center:  https://localhost:5173/signal-center
Software page:  https://localhost:5173/software-needed
```

HTTPS is used by default because Chrome blocks microphone/camera permissions on normal LAN HTTP pages. On a phone, open `https://YOUR-LAPTOP-IP:5173` and accept the local certificate warning once. For a trusted certificate, use Tailscale Serve.

## Part 2 - One Full Code To Download And Run Everything

This is the single Ubuntu code block. Run it from the KISOKE folder:

```bash
cd ~/Documents/KISOKE

mkdir -p scripts/install
cat > scripts/install/code-needed-to-download.sh <<'KISOKE_INSTALL'
#!/usr/bin/env bash
set -euo pipefail

echo "Installing KISOKE software..."

sudo apt update
sudo apt install -y \
  curl \
  ca-certificates \
  gnupg \
  git \
  python3 \
  python3-venv \
  python3-pip \
  nodejs \
  npm \
  ffmpeg \
  espeak-ng \
  brightnessctl \
  network-manager \
  bluetooth \
  bluez \
  blueman \
  pulseaudio-utils \
  wireplumber \
  v4l-utils \
  libglib2.0-bin \
  x11-xserver-utils \
  power-profiles-daemon \
  upower \
  rtl-sdr \
  dump1090-mutability

if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

if [ -d "backend" ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/python -m pip install --upgrade pip
  backend/.venv/bin/pip install -r backend/requirements.txt
fi

if [ -f "package.json" ]; then
  npm install
fi

sudo usermod -aG video "$USER" || true

export OLLAMA_MODELS="$(pwd)/ollama"
mkdir -p "$OLLAMA_MODELS"
ollama pull llama3.2 || true
ollama pull gemma2:2b || true
ollama pull phi3.5 || true
ollama pull qwen2.5:3b || true
ollama pull llama3.2:1b || true
ollama pull qwen3:4b || true

echo ""
echo "Install finished."
echo "Log out and back in once if brightness permissions do not work."
echo "Start KISOKE with:"
echo "  ALLOW_DEVICE_CONTROL=true bash scripts/linux/start-kiosk.sh"
KISOKE_INSTALL

chmod +x scripts/install/code-needed-to-download.sh
./scripts/install/code-needed-to-download.sh
ALLOW_DEVICE_CONTROL=true bash scripts/linux/start-kiosk.sh
```

Windows local testing:

```powershell
cd C:\Users\saeed\OneDrive\Documents\KISOKE
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run_local_windows.ps1
```

One-click setup and startup:

```text
Windows: double-click SETUP FILE.bat
Ubuntu:  chmod +x "SETUP FILE.sh" && "./SETUP FILE.sh"
```

The setup file installs/checks Node, Python, backend packages, Ollama, the local AI models, then starts the backend plus HTTP and HTTPS frontend servers.

Organized startup scripts:

```text
Start Up/
  Manuelle Start up full/
    Windows/START-KISOKE-WINDOWS.ps1
    Linux/start-kisoke-ubuntu.sh
  Auto Start up full/
    Windows/INSTALL-AUTO-START-WINDOWS.ps1
    Linux/install-auto-start-ubuntu.sh
```

Manual startup means you run it yourself. Auto startup means it installs login/wake/watchdog recovery.

### Auto Restart On Startup And Wake

Windows install once:

```powershell
cd C:\Users\saeed\OneDrive\Documents\KISOKE
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-autostart-windows.ps1
```

This installs three Windows Scheduled Tasks:

- `KISOKE Autostart` starts KISOKE when you log in after shutdown/restart.
- `KISOKE Wake Recover` restarts KISOKE after the laptop wakes from sleep when Windows exposes the wake event.
- `KISOKE Watchdog` checks every 2 minutes and starts the backend/frontend if either one is down.

If Windows blocks Scheduled Task creation for this user, the installer automatically falls back to a Startup-folder watchdog:

```text
C:\Users\saeed\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\KISOKE-Watchdog.vbs
```

That fallback starts after login and checks KISOKE every 30 seconds. After sleep, it resumes with Windows and restarts the backend/frontend if they died during sleep.

Camera/Radar on-demand recovery:

- When `/localhost-camera` or `/radar` cannot reach the backend, the page calls the local Vite helper `POST /api/backend/autostart`.
- The helper only accepts localhost, private Wi-Fi, or private Tailscale clients.
- On Windows it runs `scripts/windows/restart_kisoke_windows.ps1 -BackendOnly`; on Ubuntu it starts the Python backend directly.
- This requires running KISOKE through `scripts/windows/run_local_windows.ps1`, `scripts/linux/start-kiosk.sh`, `START UP.py`, or `npm run dev`. A static `dist` folder alone cannot start Python.

Windows remove auto restart:

```powershell
cd C:\Users\saeed\OneDrive\Documents\KISOKE
powershell -ExecutionPolicy Bypass -File .\scripts\windows\uninstall-autostart-windows.ps1
```

Auto restart logs:

```text
C:\Users\saeed\OneDrive\Documents\KISOKE\logs\auto-restart.log
```

Ubuntu install once:

```bash
cd ~/Documents/KISOKE
chmod +x scripts/linux/install-autostart.sh
./scripts/linux/install-autostart.sh
```

Ubuntu status:

```bash
systemctl --user status kisoke.service
```

The Ubuntu launcher now starts both the backend on `8787` and the frontend on `5173`.

Access from another device on the same Wi-Fi:

```text
https://YOUR-LAPTOP-IP:5173
```

### Radar Camera Selection

Open:

```text
https://localhost:5174/radar
```

Radar now uses the browser camera first. Use `Refresh cameras` after plugging in a webcam, choose any camera Chrome can see, and it starts scanning while the Radar page is open.

Browser Radar does not record video and does not identify faces. It uses the camera frame only for motion position and room brightness, then stops the camera tracks when you leave Radar.

If browser camera access is unavailable, the backend fallback scans camera slots:

```text
Device 0 through Device 12
```

For browser camera access on another device, use `https://YOUR-LAPTOP-IP:5174/radar` and accept the local certificate warning once. If a camera is plugged in but does not appear, check Windows Camera privacy permissions or Linux `v4l2-ctl --list-devices`. Generic webcam drivers cannot be safely installed for every brand, but the setup file installs the normal camera tooling where possible.

If you need old HTTP mode for debugging, start Windows with:

```powershell
$env:KISOKE_HTTP="true"
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run_local_windows.ps1
```

Private remote access through Tailscale:

```bash
sudo tailscale up
sudo tailscale serve --bg 5173
```

### Download Local AI Models

Windows:

```powershell
cd C:\Users\saeed\OneDrive\Documents\KISOKE
powershell -ExecutionPolicy Bypass -File .\scripts\ai\download-ai-models-windows.ps1
```

Ubuntu:

```bash
cd ~/Documents/KISOKE
chmod +x scripts/ai/download-ai-models.sh
./scripts/ai/download-ai-models.sh
```

The scripts download these Ollama models into the project `ollama` folder when Ollama honors `OLLAMA_MODELS`:

- `gemma2:2b`
- `phi3.5`
- `llama3.2`
- `qwen2.5:3b`
- `llama3.2:1b`
- `qwen3:4b`

### One Command Full Startup

Use this when you want one command to install/check dependencies, download AI models, and start the backend plus HTTP/HTTPS frontend.

Windows:

```powershell
cd C:\Users\saeed\OneDrive\Documents\KISOKE
py "START UP.py"
```

Ubuntu:

```bash
cd ~/Documents/KISOKE
python3 "START UP.py"
```

To skip AI model downloads on a quick restart:

Windows:

```powershell
$env:KISOKE_SKIP_AI_MODELS="true"
py "START UP.py"
```

Ubuntu:

```bash
KISOKE_SKIP_AI_MODELS=true python3 "START UP.py"
```
