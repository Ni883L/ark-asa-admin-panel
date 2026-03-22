$ErrorActionPreference = 'Stop'

$serviceName = $env:ASA_SERVER_SERVICE_NAME
$exePath = $env:ASA_SERVER_EXE
$logPath = $env:ASA_LOG_PATH

$status = 'stopped'
$lastStart = ''
$crashDetected = 'false'
$ports = 'unknown'
$cpu = 'unknown'
$memory = 'unknown'
$disk = 'unknown'

$processName = [System.IO.Path]::GetFileNameWithoutExtension($exePath)
$proc = $null
if ($serviceName) {
  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) { $status = $service.Status.ToString().ToLower() }
}
if (-not $status -or $status -eq 'stopped') {
  $proc = Get-Process -Name $processName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($proc) { $status = 'running'; $lastStart = $proc.StartTime.ToString('s') }
}
if ($proc) {
  $cpu = [math]::Round($proc.CPU,2).ToString() + ' CPU-s'
  $memory = [math]::Round($proc.WorkingSet64 / 1MB,0).ToString() + ' MB'
}
$diskInfo = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object -First 1
if ($diskInfo) {
  $free = [math]::Round($diskInfo.FreeSpace / 1GB,1)
  $size = [math]::Round($diskInfo.Size / 1GB,1)
  $disk = "$free GB frei / $size GB"
}
if (Test-Path $logPath) {
  $tail = Get-Content -Path $logPath -Tail 50 -ErrorAction SilentlyContinue
  if ($tail -match 'crash|fatal|access violation') { $crashDetected = 'true' }
}
Write-Output "status=$status"
Write-Output "lastStart=$lastStart"
Write-Output "crashDetected=$crashDetected"
Write-Output "cpu=$cpu"
Write-Output "memory=$memory"
Write-Output "disk=$disk"
Write-Output "ports=$ports"
Write-Output "portsRaw=$portsRaw"
orAction SilentlyContinue
  if ($tail -match 'crash|fatal|access violation') { $crashDetected = 'true' }
}
Write-Output "status=$status"
Write-Output "lastStart=$lastStart"
Write-Output "crashDetected=$crashDetected"
Write-Output "cpu=$cpu"
Write-Output "memory=$memory"
Write-Output "disk=$disk"
Write-Output "ports=$ports"
