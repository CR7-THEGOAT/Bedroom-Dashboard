$connections = @()
$connections += Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
$connections += Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue

foreach ($connection in $connections) {
  if ($connection.OwningProcess) {
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Stopped Project Nexora Bedroom Dashboard on ports 5173 and 8787."
