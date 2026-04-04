param(
  [ValidateSet('Status', 'Install', 'Uninstall', 'Start', 'Stop', 'Restart')]
  [string]$Mode = 'Status',
  [string]$ServiceName = 'ArkAsaAdminPanel',
  [string]$DisplayName = 'ARK ASA Admin Panel',
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
  throw 'Node.js (node.exe) wurde nicht gefunden.'
}

function Get-ServiceInfo {
  $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  $wmi = Get-CimInstance Win32_Service -Filter "Name='$ServiceName'" -ErrorAction SilentlyContinue
  return @{
    exists = [bool]$service
    status = if ($service) { $service.Status.ToString() } else { 'NotInstalled' }
    startMode = if ($wmi) { $wmi.StartMode } else { 'Unknown' }
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

if (-not (Test-IsAdmin)) {
  throw 'Administratorrechte erforderlich.'
}

$nodePath = Resolve-NodePath
$serverScript = Join-Path $InstallPath 'src\server.js'
if (-not (Test-Path $serverScript)) {
  throw "Panel-Startdatei nicht gefunden: $serverScript"
}

if ($Mode -eq 'Install') {
  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
  }
  $binaryPath = '"' + $nodePath + '" "' + $serverScript + '"'
  & sc.exe create $ServiceName binPath= $binaryPath DisplayName= '"' + $DisplayName + '"' start= auto | Out-Null
  & sc.exe description $ServiceName 'ARK ASA Admin Panel Node service' | Out-Null
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
  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
    Start-Sleep -Seconds 1
    Start-Service -Name $ServiceName
  }
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}
