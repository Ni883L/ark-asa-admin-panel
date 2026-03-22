$ErrorActionPreference = 'Stop'
$serviceName = $env:ASA_SERVER_SERVICE_NAME
$exePath = $env:ASA_SERVER_EXE
if ($serviceName) {
  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) {
    Stop-Service -Name $serviceName -Force
    Write-Output 'service stop triggered'
    exit 0
  }
}
$processName = [System.IO.Path]::GetFileNameWithoutExtension($exePath)
$proc = Get-Process -Name $processName -ErrorAction SilentlyContinue
if ($proc) {
  $proc | Stop-Process -Force
  Write-Output 'process stop triggered'
  exit 0
}
Write-Output 'nothing to stop'
