param([string]$CommandLine)
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\stop-server.ps1"
Start-Sleep -Seconds 5
& "$PSScriptRoot\start-server.ps1" $CommandLine
Write-Output 'restart complete'
