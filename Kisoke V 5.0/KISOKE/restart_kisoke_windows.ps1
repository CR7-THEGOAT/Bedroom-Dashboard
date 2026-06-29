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

function Write-KisokeLog {
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
      Write-KisokeLog "Stopping stale process $owner on port $Port"
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
    Write-KisokeLog "Creating backend virtual environment"
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
    Write-KisokeLog "Installing backend Python requirements"
    & $VenvPython -m pip install -r $Requirements | Out-Null
    Set-Content -Path $Marker -Value (Get-Date -Format o)
  }

  return $VenvPython
}

function Start-KisokeBackend {
  $VenvPython = Ensure-BackendEnvironment
  $command = "set ALLOW_DEVICE_CONTROL=true&& `"$VenvPython`" -m uvicorn main:app --host 0.0.0.0 --port 8787"

  Write-KisokeLog "Starting backend on 0.0.0.0:8787"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", $command `
    -WorkingDirectory $BackendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $BackendOut `
    -RedirectStandardError $BackendErr

  Start-Sleep -Seconds 3
}

function Ensure-KisokeBackend {
  if ($ForceRestart) {
    Write-KisokeLog "Force restarting backend"
    if (Test-PortListening -Port 8787) {
      Stop-PortListener -Port 8787
      Start-Sleep -Seconds 1
    }
    Start-KisokeBackend
    if (Test-BackendHealth) {
      Write-KisokeLog "Backend force restart recovered"
    } else {
      Write-KisokeLog "Backend still failed after force restart. Check $BackendErr"
    }
    return
  }

  if (Test-BackendHealth) {
    Write-KisokeLog "Backend is healthy"
    return
  }

  if (Test-PortListening -Port 8787) {
    Write-KisokeLog "Backend port is occupied but health check failed"
    Stop-PortListener -Port 8787
    Start-Sleep -Seconds 1
  }

  Start-KisokeBackend

  if (Test-BackendHealth) {
    Write-KisokeLog "Backend recovered"
  } else {
    Write-KisokeLog "Backend still failed after restart. Check $BackendErr"
  }
}

function Ensure-KisokeFrontend {
  if (Test-PortListening -Port 5173) {
    Write-KisokeLog "Frontend port 5173 is already listening"
    return
  }

  if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    Write-KisokeLog "Installing frontend npm packages"
    Push-Location $ProjectRoot
    try {
      & npm install | Out-Null
    } finally {
      Pop-Location
    }
  }

  $command = "set KISOKE_HTTPS=true&& npm run dev -- --host 0.0.0.0 --port 5173"
  Write-KisokeLog "Starting frontend on 0.0.0.0:5173"
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

Write-KisokeLog "Auto-recover check started"
Ensure-KisokeBackend
if (-not $BackendOnly) {
  Ensure-KisokeFrontend
}
Write-KisokeLog "Auto-recover check finished"
