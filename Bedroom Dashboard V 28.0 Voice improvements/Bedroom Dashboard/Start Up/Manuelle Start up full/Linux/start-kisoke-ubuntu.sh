#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/Documents/KISOKE"

echo "Starting KISOKE manually on Ubuntu..."
echo "HTTP:  http://localhost:5173"
echo "HTTPS: https://localhost:5174"

ALLOW_DEVICE_CONTROL=true bash scripts/linux/start-kiosk.sh
