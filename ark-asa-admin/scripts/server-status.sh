#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${ARK_SERVICE_NAME:-ark-asa}"

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active "$SERVICE_NAME" || true
else
  echo "unknown"
fi
