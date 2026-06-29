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
  start-kiosk.sh               Ubuntu launcher for frontend + backend
  run_local_windows.ps1        Windows local test launcher
  Start Up/                    Manual and auto-start launchers split by OS
  code-needed-to-download.sh   One full Ubuntu installer script
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

cat > code-needed-to-download.sh <<'KISOKE_INSTALL'
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

echo ""
echo "Install finished."
echo "Log out and back in once if brightness permissions do not work."
echo "Start KISOKE with:"
echo "  ALLOW_DEVICE_CONTROL=true bash start-kiosk.sh"
KISOKE_INSTALL

chmod +x code-needed-to-download.sh
./code-needed-to-download.sh
ALLOW_DEVICE_CONTROL=true bash start-kiosk.sh
```

Windows local testing:

```powershell
cd C:\Users\saeed\OneDrive\Documents\KISOKE
powershell -ExecutionPolicy Bypass -File .\run_local_windows.ps1
```

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
powershell -ExecutionPolicy Bypass -File .\install-autostart-windows.ps1
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
- On Windows it runs `restart_kisoke_windows.ps1 -BackendOnly`; on Ubuntu it starts the Python backend directly.
- This requires running KISOKE through `run_local_windows.ps1`, `start-kiosk.sh`, or `npm run dev`. A static `dist` folder alone cannot start Python.

Windows remove auto restart:

```powershell
cd C:\Users\saeed\OneDrive\Documents\KISOKE
powershell -ExecutionPolicy Bypass -File .\uninstall-autostart-windows.ps1
```

Auto restart logs:

```text
C:\Users\saeed\OneDrive\Documents\KISOKE\logs\auto-restart.log
```

Ubuntu install once:

```bash
cd ~/Documents/KISOKE
chmod +x install-autostart.sh
./install-autostart.sh
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

If you need old HTTP mode for debugging, start Windows with:

```powershell
$env:KISOKE_HTTP="true"
powershell -ExecutionPolicy Bypass -File .\run_local_windows.ps1
```

Private remote access through Tailscale:

```bash
sudo tailscale up
sudo tailscale serve --bg 5173
```
