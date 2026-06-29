#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "KISOKE full setup and startup"
echo "============================="
echo "This installs/checks system packages, Ollama, AI models, backend packages,"
echo "then starts the backend plus HTTP and HTTPS kiosk servers."
echo

bash "$SCRIPT_DIR/scripts/setup/setup-everything-ubuntu.sh"
