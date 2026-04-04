param(
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot),
  [string]$Mode = 'Install'
)
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $InstallPath 'scripts\panel-service.ps1'
$logPath = Join-Path $InstallPath 'runtime\logs\panel-service-launcher.log'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
if (Test-Path $logPath) { Remove-Item $logPath -Force -ErrorAction SilentlyContinue }

$command = @(
  '$ErrorActionPreference = ''Stop''',
  '&', ('"' + $scriptPath + '"'),
  '-Mode', ('"' + $Mode + '"'),
  '-InstallPath', ('"' + $InstallPath + '"'),
  '*>>', ('"' + $logPath + '"')
) -join ' '

$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-Command', $command
)

Start-Process -Verb RunAs -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden | Out-Null

Write-Output (@{
  ok = $true
  launched = $true
  installPath = $InstallPath
  mode = $Mode
  logPath = $logPath
} | ConvertTo-Json -Compress)
