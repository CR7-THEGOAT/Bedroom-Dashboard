$ErrorActionPreference = "Stop"

Write-Host "Installing Bedroom Dashboard Windows helpers..."

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host "winget is missing. Install App Installer from Microsoft Store, then rerun this file."
  exit 1
}

$packages = @(
  "OpenJS.NodeJS.LTS",
  "Python.Python.3.12",
  "Git.Git",
  "Ollama.Ollama",
  "Tailscale.Tailscale"
)

foreach ($package in $packages) {
  winget install --id $package --silent --accept-source-agreements --accept-package-agreements
}

if (Test-Path ".\backend\requirements.txt") {
  if (-not (Test-Path ".\backend\.venv\Scripts\python.exe")) {
    py -3 -m venv ".\backend\.venv"
  }
  .\backend\.venv\Scripts\python.exe -m pip install --upgrade pip
  .\backend\.venv\Scripts\python.exe -m pip install -r ".\backend\requirements.txt"
}

if (Test-Path ".\package.json") {
  npm install
}

$env:OLLAMA_MODELS = Join-Path (Get-Location) "ollama"
New-Item -ItemType Directory -Force -Path $env:OLLAMA_MODELS | Out-Null
ollama pull llama3.2
ollama pull gemma2:2b
ollama pull phi3.5
ollama pull qwen2.5:3b

Write-Host "Done. Start Bedroom Dashboard with:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\run_local_windows.ps1"
