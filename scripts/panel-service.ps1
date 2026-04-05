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
    exists = [bool]$wmi
    status = if ($service) { $service.Status.ToString() } elseif ($wmi) { $wmi.State } else { 'NotInstalled' }
    startMode = if ($wmi) { $wmi.StartMode } else { 'Unknown' }
    serviceName = $ServiceName
    displayName = if ($wmi) { $wmi.DisplayName } else { $DisplayName }
    installPath = $InstallPath
    binaryPath = if ($wmi) { $wmi.PathName } else { '' }
  }
}

function Get-WinswFiles {
  $baseDir = Join-Path $InstallPath 'runtime\service-wrapper'
  $exePath = Join-Path $baseDir 'ArkAsaAdminPanel.exe'
  $xmlPath = Join-Path $baseDir 'ArkAsaAdminPanel.xml'
  return @{ baseDir = $baseDir; exePath = $exePath; xmlPath = $xmlPath }
}

function Ensure-WinswBinary {
  $files = Get-WinswFiles
  New-Item -ItemType Directory -Force -Path $files.baseDir | Out-Null
  $source = Join-Path $InstallPath 'third_party\winsw\WinSW-x64.exe'
  if (-not (Test-Path $source)) {
    throw "WinSW-Binary fehlt: $source"
  }
  Copy-Item -Path $source -Destination $files.exePath -Force
  return $files
}

function Write-WinswConfig([string]$nodePath, [string]$serverScript) {
  $files = Ensure-WinswBinary
  $logDir = Join-Path $InstallPath 'runtime\logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $xml = @"
<service>
  <id>$ServiceName</id>
  <name>$DisplayName</name>
  <description>ARK ASA Admin Panel Windows Service</description>
  <executable>$nodePath</executable>
  <arguments>$serverScript</arguments>
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
  }
  $files = Write-WinswConfig -nodePath $nodePath -serverScript $serverScript
  & $files.exePath uninstall | Out-Null
  & $files.exePath install | Out-Null
  Start-Sleep -Seconds 2
  $serviceInfo = Get-ServiceInfo
  if (-not $serviceInfo.exists) {
    throw 'Panel-Dienst konnte über WinSW nicht erstellt werden.'
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
  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    try { Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
    Start-Sleep -Seconds 1
    Start-Service -Name $ServiceName
  }
  Write-Output (Get-ServiceInfo | ConvertTo-Json -Compress)
  exit 0
}
