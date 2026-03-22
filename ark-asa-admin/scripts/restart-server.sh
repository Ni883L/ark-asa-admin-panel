#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${ARK_SERVICE_NAME:-ark-asa}"

if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart "$SERVICE_NAME"
else
  echo "systemctl nicht gefunden. Bitte Restartlogik anpassen."
  exit 1
fi
