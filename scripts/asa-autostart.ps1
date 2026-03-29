param(
  [ValidateSet('Status', 'Enable', 'Disable')]
  [string]$Mode = 'Status'
)
$ErrorActionPreference = 'Stop'

$serviceName = $env:ASA_SERVER_SERVICE_NAME
if (-not $serviceName) {
  Write-Output (@{
      ok = $false
      error = 'ASA_SERVER_SERVICE_NAME ist nicht gesetzt. Für Auto-Start wird ein Windows-Dienst benötigt.'
    } | ConvertTo-Json -Compress)
  exit 0
}

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
  Write-Output (@{
      ok = $false
      error = "Dienst nicht gefunden: $serviceName"
      serviceName = $serviceName
    } | ConvertTo-Json -Compress)
  exit 0
}

if ($Mode -eq 'Enable') {
  Set-Service -Name $serviceName -StartupType Automatic
}

if ($Mode -eq 'Disable') {
  Set-Service -Name $serviceName -StartupType Manual
}

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
$wmi = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
$isAuto = $false
if ($wmi) { $isAuto = ($wmi.StartMode -eq 'Auto') }

Write-Output (@{
    ok = $true
    serviceName = $serviceName
    status = $service.Status.ToString()
    autoStartEnabled = $isAuto
  } | ConvertTo-Json -Compress)
