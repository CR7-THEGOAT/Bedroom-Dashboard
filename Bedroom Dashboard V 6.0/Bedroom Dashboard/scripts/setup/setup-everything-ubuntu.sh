#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo
echo "Bedroom Dashboard Ubuntu setup"
echo "Project: $PROJECT_ROOT"

echo
echo "== Install Ubuntu packages"
bash "$PROJECT_ROOT/scripts/install/code-needed-to-download.sh"

echo
echo "== Start Bedroom Dashboard servers"
export ALLOW_DEVICE_CONTROL="${ALLOW_DEVICE_CONTROL:-true}"
export OLLAMA_MODELS="$PROJECT_ROOT/ollama"
python3 "START UP.py"
