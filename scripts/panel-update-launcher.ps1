param(
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot),
  [string]$Branch = 'main'
)
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $InstallPath 'scripts\update.ps1'
$logPath = Join-Path $InstallPath 'runtime\logs\panel-update-launcher.log'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
if (Test-Path $logPath) { Remove-Item $logPath -Force -ErrorAction SilentlyContinue }

$tempScript = Join-Path $env:TEMP ("panel-update-elevated-" + [System.Guid]::NewGuid().ToString('N') + '.ps1')
$tempContent = @"
`$ErrorActionPreference = 'Stop'
& '$scriptPath' -InstallPath '$InstallPath' -Branch '$Branch' *>> '$logPath'
"@
Set-Content -Path $tempScript -Value $tempContent -Encoding UTF8

$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', ('"' + $tempScript + '"')
)

Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden | Out-Null

Write-Output (@{
  ok = $true
  launched = $true
  installPath = $InstallPath
  branch = $Branch
  logPath = $logPath
} | ConvertTo-Json -Compress)
