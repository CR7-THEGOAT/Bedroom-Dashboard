#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

HTTP_PORT="${KISOKE_HTTP_PORT:-5173}"
HTTPS_PORT="${KISOKE_HTTPS_PORT:-5174}"

BACKEND_PID=""
HTTP_FRONTEND_PID=""
HTTPS_FRONTEND_PID=""

if [ -f "backend/main.py" ]; then
  if [ ! -x "backend/.venv/bin/python" ]; then
    python3 -m venv backend/.venv
  fi

  if [ -f "backend/requirements.txt" ]; then
    backend/.venv/bin/pip install -r backend/requirements.txt >/dev/null
  fi

  if ! command -v ss >/dev/null 2>&1 || ! ss -ltn 2>/dev/null | grep -q ':8787 '; then
    ALLOW_DEVICE_CONTROL="${ALLOW_DEVICE_CONTROL:-true}" \
      backend/.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8787 \
      > logs/backend-linux.out.log 2> logs/backend-linux.err.log &
    BACKEND_PID=$!
  fi
fi

if [ ! -d "node_modules" ]; then
  npm install
fi

KISOKE_HTTPS= VITE_HTTPS= npm run dev -- --host 0.0.0.0 --port "$HTTP_PORT" \
  > logs/vite-http-linux.out.log 2> logs/vite-http-linux.err.log &
HTTP_FRONTEND_PID=$!

KISOKE_HTTPS=true VITE_HTTPS=true npm run dev -- --host 0.0.0.0 --port "$HTTPS_PORT" \
  > logs/vite-https-linux.out.log 2> logs/vite-https-linux.err.log &
HTTPS_FRONTEND_PID=$!

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "${HTTP_FRONTEND_PID:-}" ]; then kill "$HTTP_FRONTEND_PID" 2>/dev/null || true; fi
  if [ -n "${HTTPS_FRONTEND_PID:-}" ]; then kill "$HTTPS_FRONTEND_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

# Give Vite time to start
sleep 3

BROWSER_URL="${KISOKE_KIOSK_URL:-http://localhost:$HTTP_PORT/}"

echo "KISOKE HTTP:  http://localhost:$HTTP_PORT"
echo "KISOKE HTTPS: https://localhost:$HTTPS_PORT"
echo "Phone HTTPS:  https://YOUR-LAPTOP-IP:$HTTPS_PORT"

if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --kiosk --no-first-run --disable-session-crashed-bubble "$BROWSER_URL"
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --kiosk --no-first-run --disable-session-crashed-bubble "$BROWSER_URL"
elif command -v chromium >/dev/null 2>&1; then
  chromium --kiosk --no-first-run --disable-session-crashed-bubble "$BROWSER_URL"
else
  echo "Chrome/Chromium not found."
  echo "Install it with: sudo apt install chromium-browser"
  exit 1
fi
