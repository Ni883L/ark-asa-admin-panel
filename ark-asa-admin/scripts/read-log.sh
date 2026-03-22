#!/usr/bin/env bash
set -euo pipefail

LOG_PATH="${ARK_LOG_PATH:-/opt/ark-asa/ShooterGame/Saved/Logs/ShooterGame.log}"
LINES="${1:-200}"

if [[ -f "$LOG_PATH" ]]; then
  tail -n "$LINES" "$LOG_PATH"
else
  echo "Logdatei nicht gefunden: $LOG_PATH"
  exit 1
fi
