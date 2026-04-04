param(
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot),
  [string]$Mode = 'Install'
)
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $InstallPath 'scripts\panel-service.ps1'
$logPath = Join-Path $InstallPath 'runtime\logs\panel-service-launcher.log'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
if (Test-Path $logPath) { Remove-Item $logPath -Force -ErrorAction SilentlyContinue }

$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', ('"' + $scriptPath + '"'),
  '-Mode', ('"' + $Mode + '"'),
  '-InstallPath', ('"' + $InstallPath + '"')
) -join ' '

Start-Process -Verb RunAs -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput $logPath -RedirectStandardError $logPath | Out-Null

Write-Output (@{
  ok = $true
  launched = $true
  installPath = $InstallPath
  mode = $Mode
  logPath = $logPath
} | ConvertTo-Json -Compress)
