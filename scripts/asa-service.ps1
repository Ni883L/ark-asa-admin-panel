param(
  [ValidateSet('Status', 'Install', 'Uninstall', 'Start', 'Stop', 'Restart')]
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
    exists = [bool]$service
    status = if ($service) { $service.Status.ToString() } else { 'NotInstalled' }
    autoStartEnabled = [bool]($wmi -and $wmi.StartMode -eq 'Auto')
    serviceName = $ServiceName
    displayName = if ($wmi) { $wmi.DisplayName } else { $DisplayName }
    installPath = $InstallPath
    binaryPath = if ($wmi) { $wmi.PathName } else { '' }
  }
}

if ($Mode -eq 'Status') {
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
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
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
  }
  $binaryPath = '"' + $AsaExe + '" ' + $CommandLine
  & sc.exe create $ServiceName binPath= $binaryPath DisplayName= '"' + $DisplayName + '"' start= auto | Out-Null
  & sc.exe description $ServiceName 'ARK Survival Ascended dedicated server' | Out-Null
  Start-Service -Name $ServiceName
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Uninstall') {
  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
    & sc.exe delete $ServiceName | Out-Null
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
