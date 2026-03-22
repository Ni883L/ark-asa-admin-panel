#!/usr/bin/env bash
set -euo pipefail

if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -Command "Restart-Computer -Force"
else
  echo "Dieses Skript ist für Windows-/PowerShell-Umgebungen gedacht und muss an dein Setup angepasst werden."
  exit 1
fi
