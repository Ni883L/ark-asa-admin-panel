param(
  [ValidateSet('Status', 'Enable', 'Disable')]
  [string]$Mode = 'Status',
  [string]$TaskName = 'ArkAsaAdminPanel',
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'

function Resolve-NodePath {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node -and $node.Source) { return $node.Source }
  $candidates = @(
    "${env:ProgramFiles}\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "${env:LOCALAPPDATA}\Programs\nodejs\node.exe"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  throw 'Node.js (node.exe) wurde nicht gefunden. Bitte Node.js installieren oder PATH korrigieren.'
}

function Get-Task([string]$Name) {
  return Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
}

$task = Get-Task -Name $TaskName

if ($Mode -eq 'Status') {
  $state = if ($task) { $task.State.ToString() } else { 'NotInstalled' }
  Write-Output (@{
      ok = $true
      enabled = [bool]$task
      state = $state
      taskName = $TaskName
      installPath = $InstallPath
    } | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Enable') {
  $nodePath = Resolve-NodePath
  $action = New-ScheduledTaskAction -Execute $nodePath -Argument 'src/server.js' -WorkingDirectory $InstallPath
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Write-Output (@{
      ok = $true
      enabled = $true
      taskName = $TaskName
      installPath = $InstallPath
      nodePath = $nodePath
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
