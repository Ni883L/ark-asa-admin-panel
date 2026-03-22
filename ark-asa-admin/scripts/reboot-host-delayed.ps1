param([int]$DelaySeconds = 60)
$ErrorActionPreference = 'Stop'
shutdown.exe /r /t $DelaySeconds /c "ARK ASA Admin Panel hat einen Neustart geplant."
Write-Output "reboot scheduled in $DelaySeconds seconds"
