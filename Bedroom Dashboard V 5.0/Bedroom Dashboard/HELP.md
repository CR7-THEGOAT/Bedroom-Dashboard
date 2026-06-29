# Project Nexora Help Sheet

This kiosk can be opened on the laptop itself or from another phone, tablet, or computer on the same Wi-Fi.

## Start The Kiosk

Open a terminal in the `Bedroom Dashboard` folder:

```bash
cd ~/Bedroom Dashboard
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
cd "C:\Users\saeed\OneDrive\Documents\Bedroom Dashboard"
.\run_local_windows.ps1
```

You can also use the organized startup folder:

```text
Bedroom Dashboard\Start Up\
  Manuelle Start up full\
    Windows\START-BEDROOM-DASHBOARD-WINDOWS.ps1
    Linux\start-bedroom-dashboard-ubuntu.sh
  Auto Start up full\
    Windows\INSTALL-AUTO-START-WINDOWS.ps1
    Linux\install-auto-start-ubuntu.sh
```

Use `Manuelle Start up full` when you want to start Bedroom Dashboard yourself.
Use `Auto Start up full` once when you want Bedroom Dashboard to start after login and recover after sleep.

Windows manual start:

```powershell
cd "C:\Users\saeed\OneDrive\Documents\Bedroom Dashboard\Start Up\Manuelle Start up full\Windows"
powershell -ExecutionPolicy Bypass -File .\START-BEDROOM-DASHBOARD-WINDOWS.ps1
```

Windows auto-start install:

```powershell
cd "C:\Users\saeed\OneDrive\Documents\Bedroom Dashboard\Start Up\Auto Start up full\Windows"
powershell -ExecutionPolicy Bypass -File .\INSTALL-AUTO-START-WINDOWS.ps1
```

Ubuntu manual start:

```bash
cd ~/Documents/Bedroom Dashboard
chmod +x "Start Up/Manuelle Start up full/Linux/start-bedroom-dashboard-ubuntu.sh"
"Start Up/Manuelle Start up full/Linux/start-bedroom-dashboard-ubuntu.sh"
```

Ubuntu auto-start install:

```bash
cd ~/Documents/Bedroom Dashboard
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
Bedroom Dashboard/music
```

The dashboard scans the folder automatically.

## Notes

- Live weather uses Open-Meteo.
- News refreshes from Gulf News.
- Gold and fuel prices are fetched by the local server.
- System info works only when the Node/Vite server is running.
- Opening `index.html` directly will not run the live local APIs.
- Camera switching now uses the shared backend camera loop. If the backend stops responding or camera frames stop updating, the camera page asks the local Vite helper to force-restart the backend and retry.
