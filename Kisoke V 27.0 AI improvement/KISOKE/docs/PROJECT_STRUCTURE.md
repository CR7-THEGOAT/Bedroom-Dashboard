# KISOKE Folder Layout

```text
KISOKE/
  START UP.py                 One-command Windows/Ubuntu startup
  SETUP FILE.bat              Windows one-click setup + startup
  SETUP FILE.sh               Ubuntu full setup + startup
  README.md                   Main setup and usage guide
  package.json                Frontend commands
  vite.config.mjs             Vite dev server and local API helpers

  backend/                    FastAPI backend, camera sensor, device controls, AI bridge
  src/                        React frontend source
  public/                     Static frontend assets
  dist/                       Production build output
  frontend/                   Reserved frontend folder

  scripts/
    ai/                       Ollama model download scripts
    install/                  Full dependency install scripts
    setup/                    One-click setup wrappers for Windows/Ubuntu
    linux/                    Ubuntu startup/autostart scripts
    windows/                  Windows startup/autostart/restart/watchdog scripts

  docs/                       Extra help files and project notes
  logs/                       Runtime logs
  qa-screenshots/             QA screenshots
  music/                      Local music
  Custome Alarm Sounds/       Alarm sounds
  Custome Video Intro/        Custom startup videos
  Custom Start up audio/      Custom startup audio
  ollama/                     Local Ollama model folder
  models/                     Optional model configs
  Dashboard copybackup/       Dashboard backup
  Start Up/                   User-facing manual/auto startup copies
```

## Main Commands

One command startup:

```powershell
py "START UP.py"
```

Windows manual startup:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run_local_windows.ps1
```

Ubuntu manual startup:

```bash
bash scripts/linux/start-kiosk.sh
```

Download AI models:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ai\download-ai-models-windows.ps1
```

```bash
bash scripts/ai/download-ai-models.sh
```
