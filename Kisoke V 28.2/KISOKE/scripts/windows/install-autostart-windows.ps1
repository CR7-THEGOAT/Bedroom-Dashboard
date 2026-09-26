$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RestartScript = Join-Path $ProjectRoot "scripts\windows\restart_kisoke_windows.ps1"
$WatchdogScript = Join-Path $ProjectRoot "scripts\windows\watchdog_kisoke_windows.ps1"

if (-not (Test-Path $RestartScript)) {
  throw "Missing restart script: $RestartScript"
}
if (-not (Test-Path $WatchdogScript)) {
  throw "Missing watchdog script: $WatchdogScript"
}

function New-KisokeTaskAction {
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

  $vbsPath = Join-Path $startupDir "KISOKE-Watchdog.vbs"
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
  Write-Host "This starts on login and recovers KISOKE after wake within about 30 seconds."
}

$tasks = @(
  "KISOKE Autostart",
  "KISOKE Wake Recover",
  "KISOKE Watchdog"
)

foreach ($task in $tasks) {
  cmd.exe /c "schtasks /Delete /TN `"$task`" /F >nul 2>nul" | Out-Null
}

try {
  Invoke-Schtasks @(
    "/Create",
    "/TN", "KISOKE Autostart",
    "/SC", "ONLOGON",
    "/TR", (New-KisokeTaskAction "Logon"),
    "/F"
  ) | Out-Null

  Invoke-Schtasks @(
    "/Create",
    "/TN", "KISOKE Watchdog",
    "/SC", "MINUTE",
    "/MO", "2",
    "/TR", (New-KisokeTaskAction "Watchdog"),
    "/F"
  ) | Out-Null

  $wakeFilter = "*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]"
  Invoke-Schtasks @(
    "/Create",
    "/TN", "KISOKE Wake Recover",
    "/SC", "ONEVENT",
    "/EC", "System",
    "/MO", $wakeFilter,
    "/RL", "LIMITED",
    "/TR", (New-KisokeTaskAction "Wake"),
    "/F"
  ) | Out-Null

  Write-Host "Installed KISOKE Windows Scheduled Tasks:"
  Write-Host "  - KISOKE Autostart: starts KISOKE when you log in"
  Write-Host "  - KISOKE Watchdog: checks every 2 minutes and restarts backend/frontend if needed"
  Write-Host "  - KISOKE Wake Recover: restarts backend/frontend after wake from sleep"
} catch {
  Write-Warning "Task Scheduler install was blocked by Windows permissions. Installing Startup watchdog fallback instead. Details: $($_.Exception.Message)"
  Install-StartupWatchdog
}

Write-Host ""
Write-Host "Starting KISOKE now..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RestartScript -Reason Install
Write-Host ""
Write-Host "Done. Check logs here:"
Write-Host "  $ProjectRoot\logs\auto-restart.log"
Write-Host "  $ProjectRoot\logs\watchdog.log"
