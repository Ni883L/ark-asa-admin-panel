$ErrorActionPreference = 'Stop'

$serviceName = $env:ASA_SERVER_SERVICE_NAME
$exePath = $env:ASA_SERVER_EXE
$logPath = $env:ASA_LOG_PATH
$configDir = $env:ASA_CONFIG_DIR
$asaRoot = $env:ASA_SERVER_ROOT

$status = 'stopped'
$lastStart = ''
$crashDetected = 'false'
$currentRunCrashDetected = 'false'
$ports = 'unknown'
$portsRaw = ''
$udpPorts = 'unknown'
$udpPortsRaw = ''
$cpu = 'unknown'
$memory = 'unknown'
$disk = 'unknown'
$mapLoaded = 'false'
$mapName = ''
$loadedMap = ''
$version = ''
$buildId = ''

function Get-EnvOrDefault([string]$Value, [string]$Fallback) {
  if ($Value) { return $Value }
  return $Fallback
}

function Get-ServerProcess {
  param([string]$PathHint)

  $candidates = @()
  if ($PathHint) {
    $name = [System.IO.Path]::GetFileNameWithoutExtension($PathHint)
    if ($name) {
      $candidates += Get-Process -Name $name -ErrorAction SilentlyContinue
    }
  }

  $candidates += Get-Process -Name 'ArkAscendedServer' -ErrorAction SilentlyContinue

  foreach ($proc in ($candidates | Sort-Object StartTime -Descending -ErrorAction SilentlyContinue)) {
    if ($proc) { return $proc }
  }

  $cimProc = Get-CimInstance Win32_Process -Filter "Name='ArkAscendedServer.exe'" -ErrorAction SilentlyContinue |
    Sort-Object CreationDate -Descending |
    Select-Object -First 1
  if ($cimProc) {
    return Get-Process -Id $cimProc.ProcessId -ErrorAction SilentlyContinue
  }

  return $null
}

function Get-InstalledBuildId {
  param([string]$RootPath)

  if (-not $RootPath) { return $null }
  $manifestPath = Join-Path $RootPath 'steamapps\appmanifest_2430930.acf'
  if (-not (Test-Path $manifestPath)) { return $null }
  $content = Get-Content -Path $manifestPath -Raw -ErrorAction SilentlyContinue
  $match = [regex]::Match($content, '"buildid"\s+"(?<build>\d+)"')
  if ($match.Success) { return $match.Groups['build'].Value }
  return $null
}

function Get-RecentLogTail {
  param([string]$Path)
  if (-not $Path -or -not (Test-Path $Path)) { return @() }
  return Get-Content -Path $Path -Tail 400 -ErrorAction SilentlyContinue
}

$proc = Get-ServerProcess -PathHint $exePath
if ($proc) {
  $status = 'running'
  try {
    $lastStart = $proc.StartTime.ToString('s')
  } catch {
    $lastStart = ''
  }
}

if ($serviceName) {
  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) {
    $serviceState = $service.Status.ToString().ToLower()
    if ($serviceState -ne 'stopped' -or -not $proc) {
      $status = $serviceState
    }
  }
}

$logTail = Get-RecentLogTail -Path $logPath
$recentLogLines = $logTail
if ($lastStart) {
  $recentLogLines = $logTail | Where-Object { $_ -match [regex]::Escape(($lastStart -replace 'T', ' ')) }
  if (-not $recentLogLines -or $recentLogLines.Count -eq 0) {
    $recentLogLines = $logTail | Select-Object -Last 120
  }
}
$lowerLog = ($logTail -join "`n").ToLowerInvariant()
$lowerCurrentRunLog = ($recentLogLines -join "`n").ToLowerInvariant()
if ($lowerLog -match 'unhandled exception|fatal error!|fatal error:|access violation') {
  $crashDetected = 'true'
}
if ($lowerCurrentRunLog -match 'unhandled exception|fatal error!|fatal error:|access violation') {
  $currentRunCrashDetected = 'true'
}
if ($lowerLog -match 'the island|scorchedearth|aberration|extinction|forbiddenreach|thecenter|astraeos|bobsm') {
  $mapLoaded = 'true'
}
if ($lowerLog -match 'server map.*?:\s*(?<map>[A-Za-z0-9_\-]+)') {
  $mapName = $Matches['map']
}
if ($lowerLog -match 'loaded map\s*(?<map>[A-Za-z0-9_\-]+)') {
  $loadedMap = $Matches['map']
  $mapLoaded = 'true'
}
if ($lowerLog -match 'asa version\s+(?<ver>[^\r\n]+)') {
  $version = $Matches['ver'].Trim()
}
if ($lowerLog -match 'buildid\D+(?<build>\d{5,})') {
  $buildId = $Matches['build']
}

if (-not $buildId) {
  $buildId = Get-InstalledBuildId -RootPath $asaRoot
}

if ($proc) {
  try {
    $connections = Get-NetTCPConnection -OwningProcess $proc.Id -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
      $entries = @($connections | Sort-Object LocalPort | ForEach-Object { "TCP:$($_.LocalPort)" })
      $portsRaw = ($entries -join ',')
      $ports = $portsRaw
    }
  } catch {
    $portsRaw = ''
  }

  try {
    $udpEndpoints = Get-NetUDPEndpoint -OwningProcess $proc.Id -ErrorAction SilentlyContinue
    if ($udpEndpoints) {
      $udpEntries = @($udpEndpoints | Sort-Object LocalPort | ForEach-Object { "UDP:$($_.LocalPort)" })
      $udpPortsRaw = ($udpEntries -join ',')
      $udpPorts = $udpPortsRaw
    }
  } catch {
    $udpPortsRaw = ''
  }
}

try {
  $cpuCounter = Get-Counter '\Processor Information(_Total)\% Processor Utility' -ErrorAction SilentlyContinue
  if (-not $cpuCounter -or -not $cpuCounter.CounterSamples.Count) {
    $cpuCounter = Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction Stop
  }
  $cpuValue = [math]::Round($cpuCounter.CounterSamples[0].CookedValue, 1)
  $cpu = "$cpuValue %"
} catch {
  try {
    $cpuFallback = Get-CimInstance Win32_Processor -ErrorAction Stop | Measure-Object -Property LoadPercentage -Average
    if ($cpuFallback.Average -ne $null) {
      $cpu = "$([math]::Round([double]$cpuFallback.Average, 1)) %"
    } else {
      $cpu = 'unknown'
    }
  } catch {
    $cpu = 'unknown'
  }
}

try {
  $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $totalMemGb = [math]::Round($osInfo.TotalVisibleMemorySize / 1MB, 1)
  $freeMemGb = [math]::Round($osInfo.FreePhysicalMemory / 1MB, 1)
  $usedMemGb = [math]::Round(($osInfo.TotalVisibleMemorySize - $osInfo.FreePhysicalMemory) / 1MB, 1)
  $memory = "$usedMemGb / $totalMemGb GB"
} catch {
  $memory = 'unknown'
}

try {
  $drive = if ($asaRoot) { Split-Path -Qualifier $asaRoot } else { 'C:' }
  if (-not $drive) { $drive = 'C:' }
  $driveName = $drive.TrimEnd('\')
  $diskInfo = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$driveName'" | Select-Object -First 1
  if ($diskInfo) {
    $free = [Math]::Round($diskInfo.FreeSpace / 1GB, 1)
    $size = [Math]::Round($diskInfo.Size / 1GB, 1)
    $disk = "$free GB frei / $size GB"
  }
} catch {
  $disk = 'unknown'
}

Write-Output "status=$status"
Write-Output "lastStart=$lastStart"
Write-Output "crashDetected=$crashDetected"
Write-Output "cpu=$cpu"
Write-Output "currentRunCrashDetected=$currentRunCrashDetected"
Write-Output "memory=$memory"
Write-Output "disk=$disk"
Write-Output "ports=$ports"
Write-Output "portsRaw=$portsRaw"
Write-Output "udpPorts=$udpPorts"
Write-Output "udpPortsRaw=$udpPortsRaw"
Write-Output "mapLoaded=$mapLoaded"
Write-Output "mapName=$mapName"
Write-Output "loadedMap=$loadedMap"
Write-Output "version=$version"
Write-Output "buildId=$buildId"
