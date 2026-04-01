param(
  [ValidateSet('Status', 'Enable', 'Disable', 'ElevateEnable')]
  [string]$Mode = 'Status',
  [string]$TaskName = 'ArkAsaAdminPanel',
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

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

if ($Mode -eq 'ElevateEnable') {
  $scriptPath = $MyInvocation.MyCommand.Path
  $arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', ('"' + $scriptPath + '"'),
    '-Mode', 'Enable',
    '-TaskName', ('"' + $TaskName + '"'),
    '-InstallPath', ('"' + $InstallPath + '"')
  ) -join ' '
  Start-Process -Verb RunAs -FilePath 'powershell.exe' -ArgumentList $arguments | Out-Null
  Write-Output (@{
      ok = $true
      elevated = $true
      launched = $true
      taskName = $TaskName
      installPath = $InstallPath
      message = 'Admin-PowerShell wurde zum Registrieren des Panel-Tasks gestartet.'
    } | ConvertTo-Json -Compress)
  exit 0
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
      isAdmin = (Test-IsAdmin)
    } | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Enable') {
  if (-not (Test-IsAdmin)) {
    throw 'Administratorrechte erforderlich. Starte stattdessen: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\panel-autostart.ps1 -Mode ElevateEnable -InstallPath "C:\ark-asa-admin"'
  }

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

if (-not (Test-IsAdmin)) {
  throw 'Administratorrechte erforderlich, um den Panel-Task zu entfernen.'
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
