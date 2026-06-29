#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/Documents/Bedroom Dashboard"

echo "Installing Bedroom Dashboard auto-start on Ubuntu/Linux..."
chmod +x install-autostart.sh start-kiosk.sh
ALLOW_DEVICE_CONTROL=true bash install-autostart.sh
