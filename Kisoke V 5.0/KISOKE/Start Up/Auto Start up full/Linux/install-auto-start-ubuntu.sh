#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/Documents/KISOKE"

echo "Installing KISOKE auto-start on Ubuntu/Linux..."
chmod +x install-autostart.sh start-kiosk.sh
ALLOW_DEVICE_CONTROL=true bash install-autostart.sh
