# Project Nexora Help Sheet

This kiosk can be opened on the laptop itself or from another phone, tablet, or computer on the same Wi-Fi.

## Start The Kiosk

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

## Notes

- Live weather uses Open-Meteo.
- News refreshes from Gulf News.
- Gold and fuel prices are fetched by the local server.
- System info works only when the Node/Vite server is running.
- Opening `index.html` directly will not run the live local APIs.
