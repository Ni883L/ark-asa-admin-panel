#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${ARK_SERVICE_NAME:-ark-asa}"

if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl start "$SERVICE_NAME"
else
  echo "systemctl nicht gefunden. Bitte Startlogik anpassen."
  exit 1
fi
