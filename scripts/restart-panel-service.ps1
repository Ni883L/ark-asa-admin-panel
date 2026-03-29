param([int]$CurrentProcessId)
$ErrorActionPreference = 'Stop'

$taskName = 'ArkAsaAdminPanel'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
  throw "Kein geplanter Task '$taskName' gefunden. Bitte Panel manuell neu starten (npm start) oder zuerst scripts/panel-service-install.ps1 ausfuehren."
}

Start-ScheduledTask -TaskName $taskName
Write-Output "Scheduled task restart triggered: $taskName"

if ($CurrentProcessId -gt 0) {
  Start-Sleep -Seconds 1
  Stop-Process -Id $CurrentProcessId -Force
}
