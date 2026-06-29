#!/usr/bin/env bash
set -euo pipefail

sudo apt update
sudo apt install -y \
  python3 python3-venv python3-pip \
  ffmpeg espeak-ng \
  brightnessctl \
  network-manager \
  bluetooth bluez blueman \
  pulseaudio-utils wireplumber \
  power-profiles-daemon upower \
  curl git

if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

ollama pull llama3.2:1b
ollama pull qwen3:4b
ollama pull qwen2.5:3b

echo "Bedroom Dashboard dependencies installed. Start with: ALLOW_DEVICE_CONTROL=true bash start-kiosk.sh"
