$serviceName = $env:ARK_SERVER_SERVICE_NAME

if ($serviceName) {
  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) {
    Restart-Service -Name $serviceName -Force
    Write-Output "service restart triggered"
    exit 0
  }
}

& "$PSScriptRoot\stop-server.ps1"
Start-Sleep -Seconds 5
& "$PSScriptRoot\start-server.ps1"
Write-Output "fallback restart triggered"
