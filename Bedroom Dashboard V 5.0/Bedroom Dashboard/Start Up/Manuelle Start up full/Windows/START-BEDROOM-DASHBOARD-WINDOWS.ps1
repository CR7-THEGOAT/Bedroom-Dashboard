$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\saeed\OneDrive\Documents\Bedroom Dashboard"
Set-Location $ProjectRoot

Write-Host "Starting Bedroom Dashboard manually on Windows..."
Write-Host "HTTP:  http://localhost:5173"
Write-Host "HTTPS: https://localhost:5174"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ProjectRoot\run_local_windows.ps1"
