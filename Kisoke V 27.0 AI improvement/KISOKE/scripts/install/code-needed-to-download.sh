#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

sudo apt update
sudo apt install -y \
  ca-certificates gnupg git \
  python3 python3-venv python3-pip \
  nodejs npm \
  ffmpeg espeak-ng \
  brightnessctl \
  network-manager \
  bluetooth bluez blueman \
  pulseaudio-utils wireplumber \
  libglib2.0-bin x11-xserver-utils \
  v4l-utils \
  power-profiles-daemon upower \
  rtl-sdr dump1090-mutability \
  curl git

if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

if [ -d "backend" ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/python -m pip install --upgrade pip
  backend/.venv/bin/pip install -r backend/requirements.txt
fi

if [ -f "scripts/ai/download-vosk-model.sh" ]; then
  bash scripts/ai/download-vosk-model.sh
fi

if [ -f "package.json" ]; then
  npm install
fi

sudo usermod -aG video "$USER" || true

export OLLAMA_MODELS="$(pwd)/ollama"
mkdir -p "$OLLAMA_MODELS"
if [ -f "scripts/ai/download-ai-models.sh" ]; then
  bash scripts/ai/download-ai-models.sh
else
  ollama pull llama3.2 || true
  ollama pull gemma2:2b || true
  ollama pull phi3.5 || true
  ollama pull qwen2.5:3b || true
  ollama pull llama3.2:1b || true
  ollama pull qwen3:4b || true
fi

echo "KISOKE dependencies installed."
echo "Log out and back in once if brightness permissions do not work."
echo "Start with: ALLOW_DEVICE_CONTROL=true bash scripts/linux/start-kiosk.sh"
