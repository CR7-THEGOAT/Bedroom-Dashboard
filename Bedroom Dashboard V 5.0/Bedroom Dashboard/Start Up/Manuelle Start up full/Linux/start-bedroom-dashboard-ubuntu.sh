#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/Documents/Bedroom Dashboard"

echo "Starting Bedroom Dashboard manually on Ubuntu..."
echo "HTTP:  http://localhost:5173"
echo "HTTPS: https://localhost:5174"

ALLOW_DEVICE_CONTROL=true bash start-kiosk.sh
