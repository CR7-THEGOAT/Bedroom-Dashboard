$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RestartScript = Join-Path $ProjectRoot "scripts\windows\restart_BEDROOM_DASHBOARD_windows.ps1"
$WatchdogScript = Join-Path $ProjectRoot "scripts\windows\watchdog_BEDROOM_DASHBOARD_windows.ps1"

if (-not (Test-Path $RestartScript)) {
  throw "Missing restart script: $RestartScript"
}
if (-not (Test-Path $WatchdogScript)) {
  throw "Missing watchdog script: $WatchdogScript"
}

function New-Bedroom DashboardTaskAction {
  param([string]$Reason)
  return "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$RestartScript`" -Reason $Reason"
}

function Invoke-Schtasks {
  param([string[]]$TaskArgs)
  $output = & schtasks.exe @TaskArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output -join "`n")
  }
  return $output
}

function Stop-ExistingWatchdog {
  $escaped = $WatchdogScript.Replace('\', '\\')
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match [regex]::Escape($WatchdogScript) } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Install-StartupWatchdog {
  $startupDir = [Environment]::GetFolderPath("Startup")
  New-Item -ItemType Directory -Force -Path $startupDir | Out-Null

  $vbsPath = Join-Path $startupDir "Bedroom-Dashboard-Watchdog.vbs"
  $command = ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $WatchdogScript)
  $escapedCommand = $command.Replace('"', '""')
  $vbs = "Set shell = CreateObject(""WScript.Shell"")`r`nshell.Run ""$escapedCommand"", 0, False`r`n"
  Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII

  Stop-ExistingWatchdog
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`"" `
    -WindowStyle Hidden

  Write-Host "Installed Startup-folder watchdog:"
  Write-Host "  $vbsPath"
  Write-Host "This starts on login and recovers Bedroom Dashboard after wake within about 30 seconds."
}

$tasks = @(
  "Bedroom Dashboard Autostart",
  "Bedroom Dashboard Wake Recover",
  "Bedroom Dashboard Watchdog"
)

foreach ($task in $tasks) {
  cmd.exe /c "schtasks /Delete /TN `"$task`" /F >nul 2>nul" | Out-Null
}

try {
  Invoke-Schtasks @(
    "/Create",
    "/TN", "Bedroom Dashboard Autostart",
    "/SC", "ONLOGON",
    "/TR", (New-Bedroom DashboardTaskAction "Logon"),
    "/F"
  ) | Out-Null

  Invoke-Schtasks @(
    "/Create",
    "/TN", "Bedroom Dashboard Watchdog",
    "/SC", "MINUTE",
    "/MO", "2",
    "/TR", (New-Bedroom DashboardTaskAction "Watchdog"),
    "/F"
  ) | Out-Null

  $wakeFilter = "*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]"
  Invoke-Schtasks @(
    "/Create",
    "/TN", "Bedroom Dashboard Wake Recover",
    "/SC", "ONEVENT",
    "/EC", "System",
    "/MO", $wakeFilter,
    "/RL", "LIMITED",
    "/TR", (New-Bedroom DashboardTaskAction "Wake"),
    "/F"
  ) | Out-Null

  Write-Host "Installed Bedroom Dashboard Windows Scheduled Tasks:"
  Write-Host "  - Bedroom Dashboard Autostart: starts Bedroom Dashboard when you log in"
  Write-Host "  - Bedroom Dashboard Watchdog: checks every 2 minutes and restarts backend/frontend if needed"
  Write-Host "  - Bedroom Dashboard Wake Recover: restarts backend/frontend after wake from sleep"
} catch {
  Write-Warning "Task Scheduler install was blocked by Windows permissions. Installing Startup watchdog fallback instead. Details: $($_.Exception.Message)"
  Install-StartupWatchdog
}

Write-Host ""
Write-Host "Starting Bedroom Dashboard now..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RestartScript -Reason Install
Write-Host ""
Write-Host "Done. Check logs here:"
Write-Host "  $ProjectRoot\logs\auto-restart.log"
Write-Host "  $ProjectRoot\logs\watchdog.log"
