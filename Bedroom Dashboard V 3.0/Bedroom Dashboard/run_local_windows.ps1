$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

if (-not (Test-Path "node_modules")) {
  npm install
}

$BackendDir = Join-Path $ProjectRoot "backend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (Test-Path (Join-Path $BackendDir "main.py")) {
  if (-not (Test-Path $VenvPython)) {
    if (Test-Path $BundledPython) {
      & $BundledPython -m venv (Join-Path $BackendDir ".venv")
    } else {
      python -m venv (Join-Path $BackendDir ".venv")
    }
  }

  & $VenvPython -m pip install fastapi "uvicorn[standard]" requests pyttsx3 | Out-Null
}

$backendExisting = Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ((Test-Path $VenvPython) -and -not $backendExisting) {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c set ALLOW_DEVICE_CONTROL=true&& `"$VenvPython`" -m uvicorn main:app --host 0.0.0.0 --port 8787" -WorkingDirectory $BackendDir -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

$existing = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if (-not $existing) {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $ProjectRoot -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

$ip = ""
try {
  $ip = (Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } |
    Select-Object -First 1 -ExpandProperty IPv4Address |
    Select-Object -First 1 -ExpandProperty IPAddress)
} catch {
  $ip = ""
}

Write-Host ""
Write-Host "Project Nexora Bedroom Dashboard is running"
Write-Host "================================"
Write-Host "This device:     http://localhost:5173"
Write-Host "Backend:         http://localhost:8787/api/status"
Write-Host "Access page:     http://localhost:5173/access.html"
if ($ip) {
  Write-Host "Other devices:   http://$ip`:5173"
  Write-Host "Other access:    http://$ip`:5173/access.html"
}
