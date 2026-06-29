$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\saeed\OneDrive\Documents\Bedroom Dashboard"
Set-Location $ProjectRoot

Write-Host "Installing Bedroom Dashboard auto-start on Windows..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ProjectRoot\install-autostart-windows.ps1"
