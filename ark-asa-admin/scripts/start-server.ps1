$serviceName = $env:ARK_SERVER_SERVICE_NAME
$startCommand = $env:ARK_START_COMMAND

if ($serviceName) {
  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) {
    Start-Service -Name $serviceName
    Write-Output "service start triggered"
    exit 0
  }
}

if ($startCommand) {
  Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -Command $startCommand"
  Write-Output "custom start command triggered"
  exit 0
}

Write-Error "Weder Windows-Dienst noch ARK_START_COMMAND konfiguriert."
exit 1
