param(
  [ValidateSet('Status', 'Enable', 'Disable')]
  [string]$Mode = 'Status',
  [string]$TaskName = 'ArkAsaAdminPanel',
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'

function Get-Task([string]$Name) {
  return Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
}

$task = Get-Task -Name $TaskName

if ($Mode -eq 'Status') {
  Write-Output (@{
      ok = $true
      enabled = [bool]$task
      taskName = $TaskName
      installPath = $InstallPath
    } | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Enable') {
  $action = New-ScheduledTaskAction -Execute 'node' -Argument 'src/server.js' -WorkingDirectory $InstallPath
  $trigger = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -RunLevel Highest -Force | Out-Null
  Write-Output (@{
      ok = $true
      enabled = $true
      taskName = $TaskName
      installPath = $InstallPath
    } | ConvertTo-Json -Compress)
  exit 0
}

if ($task) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Write-Output (@{
    ok = $true
    enabled = $false
    taskName = $TaskName
    installPath = $InstallPath
  } | ConvertTo-Json -Compress)
