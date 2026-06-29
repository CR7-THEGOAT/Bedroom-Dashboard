$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\saeed\OneDrive\Documents\KISOKE"
Set-Location $ProjectRoot

Write-Host "Starting KISOKE manually on Windows..."
Write-Host "HTTP:  http://localhost:5173"
Write-Host "HTTPS: https://localhost:5174"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ProjectRoot\scripts\windows\run_local_windows.ps1"
