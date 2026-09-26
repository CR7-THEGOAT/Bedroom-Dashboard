# Project Nexora Help Sheet

This kiosk can be opened on the laptop itself or from another phone, tablet, or computer on the same Wi-Fi.

## Start The Kiosk

Fastest full setup:

```text
Windows: double-click SETUP FILE.bat
Ubuntu:  chmod +x "SETUP FILE.sh" && "./SETUP FILE.sh"
```

This installs/checks Node, Python, backend dependencies, Ollama, the local AI models, then starts the backend plus HTTP and HTTPS servers.

Open a terminal in the `KISOKE` folder:

```bash
cd ~/KISOKE
npm install
npm run dev
```

Then open this on the kiosk laptop:

```text
http://localhost:5173
```

## Open It From Another Device

1. Keep the kiosk laptop and the other device on the same Wi-Fi.
2. Start the kiosk with `npm run dev`.
3. On the kiosk Settings page, open `Help / Other Devices`.
4. On the other device, open the shown link, for example:

```text
http://192.168.1.25:5173
```

You can also open the direct access page:

```text
http://localhost:5173/access.html
```

On Windows, start the kiosk with:

```powershell
cd "C:\Users\saeed\OneDrive\Documents\KISOKE"
.\scripts\windows\run_local_windows.ps1
```

You can also use the organized startup folder:

```text
KISOKE\Start Up\
  Manuelle Start up full\
    Windows\START-KISOKE-WINDOWS.ps1
    Linux\start-kisoke-ubuntu.sh
  Auto Start up full\
    Windows\INSTALL-AUTO-START-WINDOWS.ps1
    Linux\install-auto-start-ubuntu.sh
```

Use `Manuelle Start up full` when you want to start KISOKE yourself.
Use `Auto Start up full` once when you want KISOKE to start after login and recover after sleep.

Windows manual start:

```powershell
cd "C:\Users\saeed\OneDrive\Documents\KISOKE\Start Up\Manuelle Start up full\Windows"
powershell -ExecutionPolicy Bypass -File .\START-KISOKE-WINDOWS.ps1
```

Windows auto-start install:

```powershell
cd "C:\Users\saeed\OneDrive\Documents\KISOKE\Start Up\Auto Start up full\Windows"
powershell -ExecutionPolicy Bypass -File .\INSTALL-AUTO-START-WINDOWS.ps1
```

Ubuntu manual start:

```bash
cd ~/Documents/KISOKE
chmod +x "Start Up/Manuelle Start up full/Linux/start-kisoke-ubuntu.sh"
"Start Up/Manuelle Start up full/Linux/start-kisoke-ubuntu.sh"
```

Ubuntu auto-start install:

```bash
cd ~/Documents/KISOKE
chmod +x "Start Up/Auto Start up full/Linux/install-auto-start-ubuntu.sh"
"Start Up/Auto Start up full/Linux/install-auto-start-ubuntu.sh"
```

If the link does not open, allow the port through the laptop firewall:

```bash
sudo ufw allow 5173/tcp
```

## Stable Production Mode

For normal daily use:

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:4173
```

Other devices should use the IP version shown in Settings, for example:

```text
http://192.168.1.25:4173
```

If needed:

```bash
sudo ufw allow 4173/tcp
```

## Kiosk Fullscreen On Linux

After the server is running:

```bash
chromium --kiosk http://localhost:5173
```

For production mode:

```bash
chromium --kiosk http://localhost:4173
```

## Music Folder

Put music files here:

```text
KISOKE/music
```

The dashboard scans the folder automatically.

## Health Repair

Open Settings, then run:

```text
Core Console > Run Health Check
```

If something is broken, use:

```text
Fix now
```

The Health page can repair common local issues:

- restart/check the backend helper
- restart the camera loop
- reset camera streams and camera page clients
- start Ollama
- launch the local AI model downloader
- rescan the `KISOKE/music` folder

Model downloads run in the background because they can take a long time.

## Nexora Voice/Text Commands

Useful commands:

```text
open settings
open dashboard
open clock
open radar
open camera
switch to camera 0
use Lenovo camera
play music
pause music
next song
summarize health
fix health
download AI models
set AI name to Jarvis
call me Saeed
voice replies off
voice replies on
easy model
hard model
auto model
```

If Nexora does not understand a command, it asks the local Ollama model. If Ollama is offline, run Health Check and press `Fix now`.

## Offline 24/7 Voice

Chrome voice can stop when the tab is inactive. For real offline wake-word listening, use the backend Vosk listener.

Windows:

```powershell
cd C:\Users\saeed\OneDrive\Documents\KISOKE
powershell -ExecutionPolicy Bypass -File .\scripts\install\code-needed-to-download-windows.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run_local_windows.ps1
```

Ubuntu:

```bash
cd ~/Documents/KISOKE
chmod +x scripts/install/code-needed-to-download.sh
./scripts/install/code-needed-to-download.sh
ALLOW_DEVICE_CONTROL=true bash scripts/linux/start-kiosk.sh
```

Then open:

```text
Settings > AI Names & Voice
```

Use:

- `Start Vosk listener` to start backend offline hearing
- `Vosk autostart on` to start it with the backend
- `Scan mics` to pick a microphone device
- `http://localhost:8787/api/voice/offline/status` to inspect status

## Athan Voice

Open:

```text
Settings > AI Names & Voice > Athan Voice
```

You can:

- disable athan completely
- keep athan enabled but silent
- disable specific prayers like Fajr
- choose English, Arabic, or both
- test the athan voice

Voice commands:

```text
turn off athan
turn on athan
disable Fajr athan
enable Fajr athan
silent athan
athan voice
```

## Notes

- Live weather uses Open-Meteo.
- News refreshes from Gulf News.
- Gold and fuel prices are fetched by the local server.
- System info works only when the Node/Vite server is running.
- Opening `index.html` directly will not run the live local APIs.
- Camera switching now uses the shared backend camera loop. If the backend stops responding or camera frames stop updating, the camera page asks the local Vite helper to force-restart the backend and retry.

## Download AI Models

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

Models included:

```text
gemma2:2b
phi3.5
llama3.2
qwen2.5:3b
llama3.2:1b
qwen3:4b
```

## Radar Camera

Open Radar:

```text
https://localhost:5174/radar
```

Radar can use the built-in laptop camera or a plugged USB webcam. It uses Chrome camera access first, so any camera Chrome can see can be selected from the Radar page.

Press `Refresh cameras`, select the camera, and keep Radar open while you want scanning. The camera stops automatically when you leave Radar.

If browser camera access is unavailable, KISOKE falls back to backend camera slots:

```text
Device 0 through Device 12
```

Browser Radar does not record video and does not identify faces. It uses the frame only for motion position and room brightness.

If a camera is connected but missing:

```text
Windows: check Settings > Privacy & security > Camera
Ubuntu:  run v4l2-ctl --list-devices
```

The setup file installs normal camera tooling, but it cannot safely download every brand-specific webcam driver automatically.

## One Command Full Startup

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

This installs/checks frontend dependencies, backend Python dependencies, Ollama models, then starts:

```text
Backend: http://localhost:8787
HTTP:    http://localhost:5173
HTTPS:   https://localhost:5174
```

Fast restart without model downloads:

```text
KISOKE_SKIP_AI_MODELS=true
```
