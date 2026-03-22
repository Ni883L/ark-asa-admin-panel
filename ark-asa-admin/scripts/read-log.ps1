$logPath = $env:ARK_LOG_PATH
$lines = if ($args.Count -gt 0) { [int]$args[0] } else { 200 }

if (-not $logPath) {
  Write-Error "ARK_LOG_PATH ist nicht gesetzt."
  exit 1
}

if (-not (Test-Path $logPath)) {
  Write-Error "Logdatei nicht gefunden: $logPath"
  exit 1
}

Get-Content -Path $logPath -Tail $lines
