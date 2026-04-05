param(
  [string]$InstallPath = $env:ASA_SERVER_ROOT,
  [string]$AsaExe = $env:ASA_SERVER_EXE,
  [string]$ServiceName = $env:ASA_SERVER_SERVICE_NAME,
  [string]$DisplayName = 'ARK ASA Server',
  [string]$Mode = 'Install',
  [string]$CommandLine = ''
)
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'asa-service.ps1'
$logPath = Join-Path $env:TEMP 'asa-service-launcher.log'
if (Test-Path $logPath) { Remove-Item $logPath -Force -ErrorAction SilentlyContinue }

$tempScript = Join-Path $env:TEMP ("asa-service-elevated-" + [System.Guid]::NewGuid().ToString('N') + '.ps1')
$escapedCommandLine = $CommandLine.Replace("'", "''")
$tempContent = @"
`$ErrorActionPreference = 'Stop'
& '$scriptPath' -Mode '$Mode' -ServiceName '$ServiceName' -DisplayName '$DisplayName' -InstallPath '$InstallPath' -AsaExe '$AsaExe' -CommandLine '$escapedCommandLine' *>> '$logPath'
"@
Set-Content -Path $tempScript -Value $tempContent -Encoding UTF8

$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', ('"' + $tempScript + '"')
)

Start-Process -Verb RunAs -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden | Out-Null

Write-Output (@{
  ok = $true
  launched = $true
  installPath = $InstallPath
  serviceName = $ServiceName
  mode = $Mode
  logPath = $logPath
} | ConvertTo-Json -Compress)
