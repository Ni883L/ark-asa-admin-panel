$serviceName = $env:ARK_SERVER_SERVICE_NAME
$exePath = $env:ARK_SERVER_EXE

if ($serviceName) {
  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) {
    Write-Output $service.Status.ToString().ToLower()
    exit 0
  }
}

if ($exePath) {
  $processName = [System.IO.Path]::GetFileNameWithoutExtension($exePath)
  $proc = Get-Process -Name $processName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($proc) {
    Write-Output "running"
    exit 0
  }
}

Write-Output "stopped"
