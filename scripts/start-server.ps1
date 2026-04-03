param([string]$CommandLine)
$ErrorActionPreference = 'Stop'
$serviceName = $env:ASA_SERVER_SERVICE_NAME
if ($serviceName) {
  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) {
    Start-Service -Name $serviceName
    Write-Output 'service start triggered'
    exit 0
  }
}
if (-not $CommandLine) { throw 'Keine Startzeile übergeben.' }
$cmdPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
$argumentList = @('/c', 'start', '"ARK ASA"', '/min', $CommandLine)
Start-Process -FilePath $cmdPath -ArgumentList $argumentList -WindowStyle Hidden
Write-Output "process start triggered: $CommandLine"
