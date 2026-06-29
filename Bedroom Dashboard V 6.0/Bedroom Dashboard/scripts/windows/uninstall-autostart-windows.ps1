$ErrorActionPreference = "Continue"

$tasks = @(
  "Bedroom Dashboard Autostart",
  "Bedroom Dashboard Wake Recover",
  "Bedroom Dashboard Watchdog"
)

foreach ($task in $tasks) {
  & schtasks.exe /Delete /TN $task /F 2>$null | Out-Null
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$WatchdogScript = Join-Path $ProjectRoot "watchdog_BEDROOM_DASHBOARD_windows.ps1"
$startupDir = [Environment]::GetFolderPath("Startup")
$vbsPath = Join-Path $startupDir "Bedroom-Dashboard-Watchdog.vbs"
Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match [regex]::Escape($WatchdogScript) } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Write-Host "Removed Bedroom Dashboard Windows auto-restart scheduled tasks and Startup watchdog."
