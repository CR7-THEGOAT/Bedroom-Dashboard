#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8787}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-$ROOT_DIR/ollama}"

cd "$ROOT_DIR"
mkdir -p "$OLLAMA_MODELS"

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting KISOKE..."
if [ "${ALLOW_DEVICE_CONTROL:-false}" != "true" ]; then
  echo "Device Controls are disabled. Start with ALLOW_DEVICE_CONTROL=true bash start-kiosk.sh to enable local device controls."
fi

if [ -f "$ROOT_DIR/backend/main.py" ]; then
  echo "Starting backend on http://0.0.0.0:${BACKEND_PORT}"
  (
    cd "$ROOT_DIR/backend"
    "$PYTHON_BIN" -m uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT"
  ) &
else
  echo "No backend/main.py found, skipping backend."
fi

echo "Starting frontend on http://0.0.0.0:${FRONTEND_PORT}"
npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" &

IP_ADDRESS="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "Local URLs:"
echo "  Frontend: http://localhost:${FRONTEND_PORT}"
echo "  Backend:  http://localhost:${BACKEND_PORT}/api/status"
echo "  Ollama models folder: ${OLLAMA_MODELS}"
if [ -n "${IP_ADDRESS:-}" ]; then
  echo "  Wi-Fi:    http://${IP_ADDRESS}:${FRONTEND_PORT}"
fi
echo ""
echo "Tailscale reminder:"
echo "  sudo tailscale up"
echo "  sudo tailscale serve --bg ${FRONTEND_PORT}"
echo ""

wait
