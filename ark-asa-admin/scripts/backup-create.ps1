param([string]$Type = 'manual')
$ErrorActionPreference = 'Stop'
$backupDir = $env:BACKUP_DIR
$tempDir = $env:TEMP_DIR
$savedArks = $env:ASA_SAVEDARKS_PATH
$configDir = $env:ASA_CONFIG_DIR
$clusterDir = $env:ASA_CLUSTER_PATH
$logPath = $env:ASA_LOG_PATH
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$work = Join-Path $tempDir "backup-$stamp"
$zip = Join-Path $backupDir "asa-$stamp-$Type.zip"
New-Item -ItemType Directory -Force -Path $backupDir, $tempDir, $work | Out-Null
if (Test-Path $savedArks) { Copy-Item $savedArks -Destination (Join-Path $work 'SavedArks') -Recurse -Force }
if (Test-Path $configDir) { Copy-Item $configDir -Destination (Join-Path $work 'Config') -Recurse -Force }
if ($clusterDir -and (Test-Path $clusterDir)) { Copy-Item $clusterDir -Destination (Join-Path $work 'Cluster') -Recurse -Force }
if (Test-Path $logPath) { Copy-Item $logPath -Destination (Join-Path $work 'ShooterGame.log') -Force }
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $zip -Force
Remove-Item $work -Recurse -Force
Write-Output $zip
