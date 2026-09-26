$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\saeed\OneDrive\Documents\KISOKE"
Set-Location $ProjectRoot

Write-Host "Installing KISOKE auto-start on Windows..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ProjectRoot\install-autostart-windows.ps1"
