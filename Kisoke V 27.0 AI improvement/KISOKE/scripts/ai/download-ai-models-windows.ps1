param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ModelDir = Join-Path $ProjectRoot "ollama"
$Models = @(
  "gemma2:2b",
  "phi3.5",
  "llama3.2",
  "qwen2.5:3b",
  "llama3.2:1b",
  "qwen3:4b"
)

New-Item -ItemType Directory -Force -Path $ModelDir | Out-Null
$env:OLLAMA_MODELS = $ModelDir
[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", $ModelDir, "User")

function Find-Ollama {
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
    "$env:ProgramFiles\Ollama\ollama.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

$Ollama = Find-Ollama
if (-not $Ollama -and -not $SkipInstall) {
  Write-Host "Ollama is missing. Trying winget install..." -ForegroundColor Yellow
  winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
  $Ollama = Find-Ollama
}

if (-not $Ollama) {
  throw "Ollama is not installed. Install it from https://ollama.com/download, then run this script again."
}

Write-Host "Using Ollama: $Ollama" -ForegroundColor Cyan
Write-Host "Model folder: $ModelDir" -ForegroundColor Cyan

try {
  & $Ollama list | Out-Null
} catch {
  Write-Host "Starting Ollama server..." -ForegroundColor Yellow
  Start-Process -FilePath $Ollama -ArgumentList "serve" -WindowStyle Hidden
  Start-Sleep -Seconds 4
}

foreach ($model in $Models) {
  Write-Host ""
  Write-Host "Pulling $model ..." -ForegroundColor Green
  & $Ollama pull $model
}

Write-Host ""
Write-Host "Installed models:" -ForegroundColor Cyan
& $Ollama list
Write-Host ""
Write-Host "Done. If KISOKE still says models are missing, restart Ollama or restart the laptop so OLLAMA_MODELS is picked up." -ForegroundColor Green
