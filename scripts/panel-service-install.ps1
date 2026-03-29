param([string]$InstallPath = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($node -and $node.Source) { $node.Source } else { "${env:ProgramFiles}\nodejs\node.exe" }
if (-not (Test-Path $nodePath)) {
  throw "Node.js nicht gefunden (erwartet: $nodePath)."
}
$action = New-ScheduledTaskAction -Execute $nodePath -Argument 'src/server.js' -WorkingDirectory $InstallPath
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'ArkAsaAdminPanel' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Output "Scheduled task created: ArkAsaAdminPanel ($InstallPath, node=$nodePath, user=SYSTEM)"
