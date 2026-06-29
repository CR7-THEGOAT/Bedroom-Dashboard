# KISOKE

KISOKE is a local smart bedroom kiosk with a clock page, dashboard page, settings page, local command assistant, browser voice input, camera brightness theme switching, and an optional local FastAPI backend for Ollama.

## Structure

```text
KISOKE/
  frontend/          # Architecture marker; current Vite app remains at root
  backend/           # FastAPI backend for local AI, camera, TTS, commands
  models/            # Ollama model notes/configs
  public/            # Static help/access pages and media endpoints
  src/               # React/Vite frontend source
  start-kiosk.sh     # Ubuntu launcher for frontend + backend
```

## Install Frontend

The app also has a built-in **Software Needed** page in Settings. Open KISOKE, go to Settings, then tap **Software needed** to see the same checklist with copyable commands and backend status.

For Ubuntu, the fastest full install is the one-file installer:

```bash
cd ~/Documents/KISOKE
bash code-needed-to-download
```

```bash
cd ~/Documents/KISOKE
npm install
```

## Install Backend

```bash
sudo apt update
sudo apt install brightnessctl network-manager bluetooth bluez pulseaudio-utils wireplumber libglib2.0-bin x11-xserver-utils power-profiles-daemon upower

cd ~/Documents/KISOKE/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Device control notes:

- Brightness control prefers `brightnessctl`; it may require permissions such as adding your user to the `video` group.
- Wi-Fi control requires NetworkManager and `nmcli`.
- Bluetooth control requires BlueZ and `bluetoothctl`.
- Night Light commands use GNOME `gsettings`; they may not work on KDE/XFCE or non-GNOME sessions.
- Power mode uses `powerprofilesctl` from `power-profiles-daemon`.
- Battery status reads Linux `/sys/class/power_supply` first and falls back to `upower`.
- Tailscale controls require the `tailscale` CLI and may ask for login/admin permission.
- Some laptop panels, Wayland sessions, audio stacks, and Bluetooth adapters may not support every control.

## Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:1b
ollama pull qwen3:4b
```

Easy model: `llama3.2:1b`

Hard model: `qwen3:4b`

## Run Frontend

```bash
cd ~/Documents/KISOKE
npm run dev -- --host 0.0.0.0
```

Open:

```text
http://localhost:5173
```

## Run Backend

```bash
cd ~/Documents/KISOKE/backend
source .venv/bin/activate
ALLOW_DEVICE_CONTROL=true python -m uvicorn main:app --host 0.0.0.0 --port 8787
```

Check:

```text
http://localhost:8787/api/status
```

Security: device control endpoints are disabled unless `ALLOW_DEVICE_CONTROL=true` is set. They also reject non-private clients. Use them only on localhost, home Wi-Fi, or private Tailscale. Do not expose them through Tailscale Funnel or a public reverse proxy.

## Run Everything

```bash
cd ~/Documents/KISOKE
ALLOW_DEVICE_CONTROL=true bash start-kiosk.sh
```

On Windows for testing:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_local_windows.ps1
```

## Access From Another Device On Wi-Fi

Run the frontend with host mode:

```bash
npm run dev -- --host 0.0.0.0
```

Find your laptop IP:

```bash
hostname -I
```

Open this from your phone/tablet/laptop:

```text
http://LAPTOP-IP:5173
```

## Access With Tailscale

```bash
sudo tailscale up
sudo tailscale down
sudo tailscale serve --bg 5173
```

Camera access from another device may need HTTPS or Tailscale HTTPS because browser camera permissions are restricted on plain HTTP.

## What Works Locally

- Clock, dashboard, settings pages.
- Frontend command router for opening pages, switching themes, study/sleep modes, muting music, and starting timers.
- Layout looks in Settings: Natural, Glossy/Glassy, Hacker, Normal, Aurora, Ethereal, Pixel Art, Conceptual Sketch, Luxury Typography, Japandi, Memphis, and Bohemian.
- Browser text-to-speech replies.
- Browser speech recognition when the browser supports it, including an always-listening mode while the KISOKE tab is open.
- Browser camera brightness auto-theme when camera permission is granted.
- Optional FastAPI backend endpoints for settings, commands, Ollama, camera brightness, and TTS.
- Device Controls widget for brightness, volume, Night Light, Wi-Fi, Bluetooth, live battery, backend runtime, power mode, Do Not Disturb, Airplane Mode, and Tailscale when the backend is running with `ALLOW_DEVICE_CONTROL=true`.

## Placeholders / Hardware-Dependent

- Ollama replies require Ollama installed and running.
- Backend camera brightness requires OpenCV and a working camera.
- Browser camera from another device may require HTTPS.
- Microphone voice input depends on browser support. Chrome/Edge can pause or block listening in hidden tabs, minimized windows, locked screens, or after sleep. True 24/7 background wake-word listening needs a local microphone daemon outside the browser.
- Device controls depend on Linux tools and hardware support. If a tool is missing, the widget shows the package to install.

## Troubleshooting

- If `localhost:5173` does not open, run `npm run dev -- --host 0.0.0.0`.
- If backend AI says Ollama is unavailable, run `ollama serve` or install Ollama and pull the models.
- If the camera is blocked, allow camera permission in the browser and reload.
- If another device cannot open the site, check both devices are on the same Wi-Fi and use `http://LAPTOP-IP:5173`.
