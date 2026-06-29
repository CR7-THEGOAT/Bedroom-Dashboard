$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $ProjectRoot

$HttpPort = 5173
$HttpsPort = 5174

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

  $Requirements = Join-Path $BackendDir "requirements.txt"
  if (Test-Path $Requirements) {
    & $VenvPython -m pip install -r $Requirements | Out-Null
  } else {
    & $VenvPython -m pip install fastapi "uvicorn[standard]" requests pyttsx3 opencv-python-headless | Out-Null
  }
}

$backendExisting = Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ((Test-Path $VenvPython) -and -not $backendExisting) {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c set ALLOW_DEVICE_CONTROL=true&& `"$VenvPython`" -m uvicorn main:app --host 0.0.0.0 --port 8787" -WorkingDirectory $BackendDir -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

function Start-FrontendIfNeeded {
  param(
    [int]$Port,
    [bool]$Https
  )

  $existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
  if ($existing) {
    return
  }

  if ($Https) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c set BEDROOM_DASHBOARD_HTTPS=true&& set VITE_HTTPS=true&& npm run dev -- --host 0.0.0.0 --port $Port" -WorkingDirectory $ProjectRoot -WindowStyle Hidden
  } else {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c set BEDROOM_DASHBOARD_HTTPS=&& set VITE_HTTPS=&& npm run dev -- --host 0.0.0.0 --port $Port" -WorkingDirectory $ProjectRoot -WindowStyle Hidden
  }
  Start-Sleep -Seconds 3
}

Start-FrontendIfNeeded -Port $HttpPort -Https $false
Start-FrontendIfNeeded -Port $HttpsPort -Https $true

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
Write-Host "HTTP local:      http://localhost:$HttpPort"
Write-Host "HTTPS local:     https://localhost:$HttpsPort"
Write-Host "Backend:         http://localhost:8787/api/status"
Write-Host "HTTP access:     http://localhost:$HttpPort/access.html"
Write-Host "HTTPS access:    https://localhost:$HttpsPort/access.html"
if ($ip) {
  Write-Host "Phone HTTP:      http://$ip`:$HttpPort"
  Write-Host "Phone HTTPS:     https://$ip`:$HttpsPort"
  Write-Host "Camera HTTP:     http://$ip`:$HttpPort/localhost-camera"
  Write-Host "Camera HTTPS:    https://$ip`:$HttpsPort/localhost-camera"
}
Write-Host ""
Write-Host "HTTPS note: accept the local certificate warning once on your phone."
Write-Host "For a trusted HTTPS certificate, use Tailscale Serve instead."
