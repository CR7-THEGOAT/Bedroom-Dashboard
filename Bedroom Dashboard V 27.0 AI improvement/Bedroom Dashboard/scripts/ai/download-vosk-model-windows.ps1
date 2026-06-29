param(
  [string]$ModelName = "vosk-model-small-en-us-0.15"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ModelsDir = Join-Path $ProjectRoot "models"
$ModelDir = Join-Path $ModelsDir $ModelName
$ZipPath = Join-Path $ModelsDir "$ModelName.zip"
$ModelUrl = "https://alphacephei.com/vosk/models/$ModelName.zip"

New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null

if (Test-Path $ModelDir) {
  Write-Host "Vosk model already installed: $ModelDir" -ForegroundColor Green
  exit 0
}

Write-Host "Downloading Vosk model: $ModelUrl" -ForegroundColor Cyan
Invoke-WebRequest -Uri $ModelUrl -OutFile $ZipPath

Write-Host "Extracting Vosk model..." -ForegroundColor Cyan
Expand-Archive -LiteralPath $ZipPath -DestinationPath $ModelsDir -Force
Remove-Item -LiteralPath $ZipPath -Force

if (-not (Test-Path $ModelDir)) {
  throw "Vosk model extraction failed. Expected $ModelDir"
}

Write-Host "Done. Offline voice model installed at $ModelDir" -ForegroundColor Green
