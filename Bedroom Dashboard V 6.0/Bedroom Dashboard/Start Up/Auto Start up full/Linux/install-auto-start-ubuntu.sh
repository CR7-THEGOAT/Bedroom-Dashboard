#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/Documents/Bedroom Dashboard"

echo "Installing Bedroom Dashboard auto-start on Ubuntu/Linux..."
chmod +x scripts/linux/install-autostart.sh scripts/linux/start-kiosk.sh
ALLOW_DEVICE_CONTROL=true bash scripts/linux/install-autostart.sh
