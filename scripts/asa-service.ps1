param(
  [ValidateSet('Status', 'Install', 'Uninstall', 'Start', 'Stop', 'Restart', 'ElevateInstall', 'ElevateUninstall')]
  [string]$Mode = 'Status',
  [string]$ServiceName = $env:ASA_SERVER_SERVICE_NAME,
  [string]$DisplayName = 'ARK ASA Server',
  [string]$InstallPath = $env:ASA_SERVER_ROOT,
  [string]$AsaExe = $env:ASA_SERVER_EXE,
  [string]$CommandLine = ''
)
$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ServiceInfo {
  $service = if ($ServiceName) { Get-Service -Name $ServiceName -ErrorAction SilentlyContinue } else { $null }
  $wmi = if ($ServiceName) { Get-CimInstance Win32_Service -Filter "Name='$ServiceName'" -ErrorAction SilentlyContinue } else { $null }
  return @{
    ok = [bool]$ServiceName
    exists = [bool]$wmi
    status = if ($service) { $service.Status.ToString() } elseif ($wmi) { $wmi.State } else { 'NotInstalled' }
    autoStartEnabled = [bool]($wmi -and $wmi.StartMode -eq 'Auto')
    serviceName = $ServiceName
    displayName = if ($wmi) { $wmi.DisplayName } else { $DisplayName }
    installPath = $InstallPath
    binaryPath = if ($wmi) { $wmi.PathName } else { '' }
  }
}

function Get-WinswFiles {
  $baseDir = Join-Path $InstallPath 'service-wrapper'
  $exePath = Join-Path $baseDir 'ArkAsaServerService.exe'
  $xmlPath = Join-Path $baseDir 'ArkAsaServerService.xml'
  return @{ baseDir = $baseDir; exePath = $exePath; xmlPath = $xmlPath }
}

function Ensure-WinswBinary {
  $files = Get-WinswFiles
  New-Item -ItemType Directory -Force -Path $files.baseDir | Out-Null
  $source = Join-Path (Split-Path -Parent $PSScriptRoot) 'third_party\winsw\WinSW-x64.exe'
  if (-not (Test-Path $source)) {
    throw "WinSW-Binary fehlt: $source"
  }
  Copy-Item -Path $source -Destination $files.exePath -Force
  return $files
}

function Write-WinswConfig([string]$targetExe, [string]$arguments) {
  $files = Ensure-WinswBinary
  $logDir = Join-Path $InstallPath 'ShooterGame\Saved\Logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $xml = @"
<service>
  <id>$ServiceName</id>
  <name>$DisplayName</name>
  <description>ARK ASA Windows Service</description>
  <executable>$targetExe</executable>
  <arguments>$arguments</arguments>
  <workingdirectory>$InstallPath</workingdirectory>
  <logpath>$logDir</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>8</keepFiles>
  </log>
  <onfailure action="restart" delay="10 sec" />
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>15sec</stoptimeout>
</service>
"@
  Set-Content -Path $files.xmlPath -Value $xml -Encoding UTF8
  return $files
}

if ($Mode -eq 'Status') {
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -in @('ElevateInstall', 'ElevateUninstall')) {
  $targetMode = if ($Mode -eq 'ElevateInstall') { 'Install' } else { 'Uninstall' }
  $scriptPath = $MyInvocation.MyCommand.Path
  $arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', ('"' + $scriptPath + '"'),
    '-Mode', $targetMode,
    '-ServiceName', ('"' + $ServiceName + '"'),
    '-DisplayName', ('"' + $DisplayName + '"'),
    '-InstallPath', ('"' + $InstallPath + '"'),
    '-AsaExe', ('"' + $AsaExe + '"'),
    '-CommandLine', ('"' + $CommandLine.Replace('"', '\"') + '"')
  ) -join ' '
  Start-Process -Verb RunAs -FilePath 'powershell.exe' -ArgumentList $arguments | Out-Null
  Write-Output (@{
    ok = $true
    elevated = $true
    launched = $true
    mode = $targetMode
    serviceName = $ServiceName
  } | ConvertTo-Json -Compress)
  exit 0
}

if (-not $ServiceName) {
  throw 'ASA_SERVER_SERVICE_NAME ist nicht gesetzt.'
}
if (-not (Test-IsAdmin)) {
  throw 'Administratorrechte erforderlich.'
}
if (-not $AsaExe) {
  throw 'ASA_SERVER_EXE ist nicht gesetzt.'
}
if (-not (Test-Path $AsaExe)) {
  throw "ASA_SERVER_EXE nicht gefunden: $AsaExe"
}
if (-not $CommandLine) {
  $CommandLine = 'TheIsland_WP?listen?SessionName=ASA Server?Port=7777?QueryPort=27015'
}

if ($Mode -eq 'Install') {
  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
  }
  $files = Write-WinswConfig -targetExe $AsaExe -arguments $CommandLine
  & $files.exePath uninstall | Out-Null
  & $files.exePath install | Out-Null
  Start-Sleep -Seconds 2
  $serviceInfo = Get-ServiceInfo
  if (-not $serviceInfo.exists) {
    throw 'ARK ASA Dienst konnte über WinSW nicht erstellt werden.'
  }
  Start-Service -Name $ServiceName -ErrorAction Stop
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Uninstall') {
  $files = Get-WinswFiles
  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
  }
  if (Test-Path $files.exePath) {
    & $files.exePath uninstall | Out-Null
  }
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Start') {
  Start-Service -Name $ServiceName
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Stop') {
  Stop-Service -Name $ServiceName -Force
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Restart') {
  try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Seconds 1
  Start-Service -Name $ServiceName
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}
