$ErrorActionPreference = "Continue"

$tasks = @(
  "KISOKE Autostart",
  "KISOKE Wake Recover",
  "KISOKE Watchdog"
)

foreach ($task in $tasks) {
  & schtasks.exe /Delete /TN $task /F 2>$null | Out-Null
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$WatchdogScript = Join-Path $ProjectRoot "watchdog_kisoke_windows.ps1"
$startupDir = [Environment]::GetFolderPath("Startup")
$vbsPath = Join-Path $startupDir "KISOKE-Watchdog.vbs"
Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match [regex]::Escape($WatchdogScript) } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Write-Host "Removed KISOKE Windows auto-restart scheduled tasks and Startup watchdog."
