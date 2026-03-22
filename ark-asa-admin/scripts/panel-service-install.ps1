param([string]$InstallPath = 'C:\ark-asa-admin-panel')
$ErrorActionPreference = 'Stop'
$action = New-ScheduledTaskAction -Execute 'node' -Argument 'src/server.js' -WorkingDirectory $InstallPath
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName 'ArkAsaAdminPanel' -Action $action -Trigger $trigger -RunLevel Highest -Force | Out-Null
Write-Output 'Scheduled task created: ArkAsaAdminPanel'
