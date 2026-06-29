#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODEL_DIR="$PROJECT_ROOT/ollama"
MODELS=(
  "gemma2:2b"
  "phi3.5"
  "llama3.2"
  "qwen2.5:3b"
  "llama3.2:1b"
  "qwen3:4b"
)

mkdir -p "$MODEL_DIR"
export OLLAMA_MODELS="$MODEL_DIR"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is missing. Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

if ! pgrep -x ollama >/dev/null 2>&1; then
  echo "Starting Ollama server..."
  nohup ollama serve >/tmp/Bedroom Dashboard-ollama.log 2>&1 &
  sleep 4
fi

echo "Using model folder: $OLLAMA_MODELS"
for model in "${MODELS[@]}"; do
  echo
  echo "Pulling $model ..."
  ollama pull "$model"
done

echo
echo "Installed models:"
ollama list
echo
echo "Done. If Bedroom Dashboard still says models are missing, restart Ollama or reboot so OLLAMA_MODELS is picked up."
