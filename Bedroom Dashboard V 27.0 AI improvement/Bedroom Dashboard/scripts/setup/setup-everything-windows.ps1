$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $ProjectRoot

Write-Host ""
Write-Host "Bedroom Dashboard Windows setup" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkCyan
$ModelsHandledByInstaller = $false

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "== $Name" -ForegroundColor Green
  & $Action
}

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Invoke-Step "Install Windows software helpers" {
  $installer = Join-Path $ProjectRoot "scripts\install\code-needed-to-download-windows.ps1"
  if (Test-Path $installer) {
    powershell -NoProfile -ExecutionPolicy Bypass -File $installer
    $script:ModelsHandledByInstaller = $true
  } else {
    if (-not (Test-CommandExists "winget")) {
      Write-Warning "winget is missing. Install App Installer from Microsoft Store if Node/Python/Ollama are missing."
    } else {
      foreach ($package in @("OpenJS.NodeJS.LTS", "Python.Python.3.12", "Git.Git", "Ollama.Ollama", "Tailscale.Tailscale")) {
        winget install --id $package -e --accept-source-agreements --accept-package-agreements
      }
    }
  }
}

Invoke-Step "Download local AI models" {
  if ($script:ModelsHandledByInstaller) {
    Write-Host "AI model download already handled by the installer script." -ForegroundColor DarkCyan
    return
  }
  $modelScript = Join-Path $ProjectRoot "scripts\ai\download-ai-models-windows.ps1"
  if (Test-Path $modelScript) {
    powershell -NoProfile -ExecutionPolicy Bypass -File $modelScript
  } else {
    Write-Warning "AI model download script is missing."
  }
}

Invoke-Step "Start Bedroom Dashboard servers" {
  $env:ALLOW_DEVICE_CONTROL = "true"
  $env:OLLAMA_MODELS = Join-Path $ProjectRoot "ollama"
  [Environment]::SetEnvironmentVariable("OLLAMA_MODELS", $env:OLLAMA_MODELS, "User")

  if (Test-CommandExists "py") {
    py "START UP.py"
  } elseif (Test-CommandExists "python") {
    python "START UP.py"
  } else {
    throw "Python is still missing. Install Python 3, reopen this terminal, then run SETUP FILE.bat again."
  }
}
