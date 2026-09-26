#!/usr/bin/env bash
set -euo pipefail

MODEL_NAME="${1:-vosk-model-small-en-us-0.15}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODELS_DIR="$PROJECT_ROOT/models"
MODEL_DIR="$MODELS_DIR/$MODEL_NAME"
ZIP_PATH="$MODELS_DIR/$MODEL_NAME.zip"
MODEL_URL="https://alphacephei.com/vosk/models/$MODEL_NAME.zip"

mkdir -p "$MODELS_DIR"

if [ -d "$MODEL_DIR" ]; then
  echo "Vosk model already installed: $MODEL_DIR"
  exit 0
fi

echo "Downloading Vosk model: $MODEL_URL"
if command -v curl >/dev/null 2>&1; then
  curl -L "$MODEL_URL" -o "$ZIP_PATH"
else
  wget "$MODEL_URL" -O "$ZIP_PATH"
fi

echo "Extracting Vosk model..."
python3 - <<PY
from pathlib import Path
from zipfile import ZipFile

zip_path = Path("$ZIP_PATH")
models_dir = Path("$MODELS_DIR")
with ZipFile(zip_path) as archive:
    archive.extractall(models_dir)
zip_path.unlink(missing_ok=True)
PY

test -d "$MODEL_DIR"
echo "Done. Offline voice model installed at $MODEL_DIR"
