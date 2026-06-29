param(
  [int]$IntervalSeconds = 30
)

$ErrorActionPreference = "Continue"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RestartScript = Join-Path $ProjectRoot "scripts\windows\restart_BEDROOM_DASHBOARD_windows.ps1"
$LogDir = Join-Path $ProjectRoot "logs"
$LogFile = Join-Path $LogDir "watchdog.log"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-WatchdogLog {
  param([string]$Message)
  Add-Content -Path $LogFile -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message)
}

if (-not (Test-Path $RestartScript)) {
  Write-WatchdogLog "Missing restart script: $RestartScript"
  exit 1
}

Write-WatchdogLog "Bedroom Dashboard watchdog started. Interval=${IntervalSeconds}s"

$lastTick = Get-Date
$firstRun = $true

while ($true) {
  try {
    $now = Get-Date
    $gapSeconds = ($now - $lastTick).TotalSeconds
    $lastTick = $now

    if ($firstRun) {
      $firstRun = $false
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RestartScript -Reason "WatchdogStart"
    } elseif ($gapSeconds -gt ($IntervalSeconds + 90)) {
      Write-WatchdogLog ("Wake/resume gap detected: {0:n0}s" -f $gapSeconds)
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RestartScript -Reason "WakeResume"
    } else {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RestartScript -Reason "Watchdog" -QuietHealthy
    }
  } catch {
    Write-WatchdogLog ("Watchdog error: " + $_.Exception.Message)
  }

  Start-Sleep -Seconds $IntervalSeconds
}
