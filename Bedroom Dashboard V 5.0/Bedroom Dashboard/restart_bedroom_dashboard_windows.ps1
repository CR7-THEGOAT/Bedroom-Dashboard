param(
  [string]$Reason = "Manual",
  [switch]$BackendOnly,
  [switch]$QuietHealthy,
  [switch]$ForceRestart
)

$ErrorActionPreference = "Continue"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "backend"
$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$LogFile = Join-Path $LogDir "auto-restart.log"
$BackendOut = Join-Path $LogDir "backend-auto.out.log"
$BackendErr = Join-Path $LogDir "backend-auto.err.log"
$FrontendOut = Join-Path $LogDir "frontend-auto.out.log"
$FrontendErr = Join-Path $LogDir "frontend-auto.err.log"

function Write-Bedroom DashboardLog {
  param([string]$Message)
  $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Reason, $Message
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Test-BackendHealth {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/status" -TimeoutSec 3
    return [bool]$response.ok
  } catch {
    return $false
  }
}

function Test-PortListening {
  param([int]$Port)
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return [bool]$listener
}

function Stop-PortListener {
  param([int]$Port)
  $owners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($owner in $owners) {
    if ($owner -and $owner -ne $PID) {
      Write-Bedroom DashboardLog "Stopping stale process $owner on port $Port"
      Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }
  }
}

function Ensure-BackendEnvironment {
  $VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
  $Requirements = Join-Path $BackendDir "requirements.txt"
  $Marker = Join-Path $BackendDir ".requirements-installed"
  $BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

  if (-not (Test-Path (Join-Path $BackendDir "main.py"))) {
    throw "backend\main.py was not found."
  }

  if (-not (Test-Path $VenvPython)) {
    Write-Bedroom DashboardLog "Creating backend virtual environment"
    if (Test-Path $BundledPython) {
      & $BundledPython -m venv (Join-Path $BackendDir ".venv")
    } else {
      & python -m venv (Join-Path $BackendDir ".venv")
    }
  }

  $requirementsNeedInstall = $false
  if (Test-Path $Requirements) {
    if (-not (Test-Path $Marker)) {
      $requirementsNeedInstall = $true
    } elseif ((Get-Item $Requirements).LastWriteTimeUtc -gt (Get-Item $Marker).LastWriteTimeUtc) {
      $requirementsNeedInstall = $true
    }
  }

  if ($requirementsNeedInstall) {
    Write-Bedroom DashboardLog "Installing backend Python requirements"
    & $VenvPython -m pip install -r $Requirements | Out-Null
    Set-Content -Path $Marker -Value (Get-Date -Format o)
  }

  return $VenvPython
}

function Start-Bedroom DashboardBackend {
  $VenvPython = Ensure-BackendEnvironment
  $command = "set ALLOW_DEVICE_CONTROL=true&& `"$VenvPython`" -m uvicorn main:app --host 0.0.0.0 --port 8787"

  Write-Bedroom DashboardLog "Starting backend on 0.0.0.0:8787"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", $command `
    -WorkingDirectory $BackendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $BackendOut `
    -RedirectStandardError $BackendErr

  Start-Sleep -Seconds 3
}

function Ensure-Bedroom DashboardBackend {
  if ($ForceRestart) {
    Write-Bedroom DashboardLog "Force restarting backend"
    if (Test-PortListening -Port 8787) {
      Stop-PortListener -Port 8787
      Start-Sleep -Seconds 1
    }
    Start-Bedroom DashboardBackend
    if (Test-BackendHealth) {
      Write-Bedroom DashboardLog "Backend force restart recovered"
    } else {
      Write-Bedroom DashboardLog "Backend still failed after force restart. Check $BackendErr"
    }
    return
  }

  if (Test-BackendHealth) {
    Write-Bedroom DashboardLog "Backend is healthy"
    return
  }

  if (Test-PortListening -Port 8787) {
    Write-Bedroom DashboardLog "Backend port is occupied but health check failed"
    Stop-PortListener -Port 8787
    Start-Sleep -Seconds 1
  }

  Start-Bedroom DashboardBackend

  if (Test-BackendHealth) {
    Write-Bedroom DashboardLog "Backend recovered"
  } else {
    Write-Bedroom DashboardLog "Backend still failed after restart. Check $BackendErr"
  }
}

function Ensure-Bedroom DashboardFrontend {
  if (Test-PortListening -Port 5173) {
    Write-Bedroom DashboardLog "Frontend port 5173 is already listening"
    return
  }

  if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    Write-Bedroom DashboardLog "Installing frontend npm packages"
    Push-Location $ProjectRoot
    try {
      & npm install | Out-Null
    } finally {
      Pop-Location
    }
  }

  $command = "set BEDROOM_DASHBOARD_HTTPS=true&& npm run dev -- --host 0.0.0.0 --port 5173"
  Write-Bedroom DashboardLog "Starting frontend on 0.0.0.0:5173"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", $command `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $FrontendOut `
    -RedirectStandardError $FrontendErr

  Start-Sleep -Seconds 3
}

if ($QuietHealthy -and (Test-BackendHealth) -and ($BackendOnly -or (Test-PortListening -Port 5173))) {
  exit 0
}

Write-Bedroom DashboardLog "Auto-recover check started"
Ensure-Bedroom DashboardBackend
if (-not $BackendOnly) {
  Ensure-Bedroom DashboardFrontend
}
Write-Bedroom DashboardLog "Auto-recover check finished"
