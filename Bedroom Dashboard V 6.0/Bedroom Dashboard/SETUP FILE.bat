@echo off
setlocal
cd /d "%~dp0"

echo Bedroom Dashboard full setup and startup
echo =============================
echo This installs/checks Node, Python, Ollama, AI models, backend packages,
echo then starts the backend plus HTTP and HTTPS kiosk servers.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup\setup-everything-windows.ps1"

echo.
echo If the window shows an error, read the line above it.
pause
