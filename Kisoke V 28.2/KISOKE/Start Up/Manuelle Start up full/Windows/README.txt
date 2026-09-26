KISOKE manual startup for Windows

Use this when you want to start the kiosk yourself.

Run:
powershell -ExecutionPolicy Bypass -File ".\START-KISOKE-WINDOWS.ps1"

It starts:
- backend on http://localhost:8787
- HTTP frontend on http://localhost:5173
- HTTPS frontend on https://localhost:5174

