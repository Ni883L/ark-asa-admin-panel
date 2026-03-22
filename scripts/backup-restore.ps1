param([string]$ZipPath, [string]$Mode = 'full')
$ErrorActionPreference = 'Stop'
$tempDir = $env:TEMP_DIR
$savedArks = $env:ASA_SAVEDARKS_PATH
$configDir = $env:ASA_CONFIG_DIR
$clusterDir = $env:ASA_CLUSTER_PATH
if (-not (Test-Path $ZipPath)) { throw "Backup nicht gefunden: $ZipPath" }
$extract = Join-Path $tempDir ("restore-" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $extract | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $extract -Force
if ($Mode -eq 'full' -or $Mode -eq 'save') {
  if (Test-Path (Join-Path $extract 'SavedArks')) { Copy-Item (Join-Path $extract 'SavedArks\*') -Destination $savedArks -Recurse -Force }
}
if ($Mode -eq 'full' -or $Mode -eq 'config') {
  if (Test-Path (Join-Path $extract 'Config')) { Copy-Item (Join-Path $extract 'Config\*') -Destination $configDir -Recurse -Force }
}
if (($Mode -eq 'full' -or $Mode -eq 'cluster') -and $clusterDir) {
  if (Test-Path (Join-Path $extract 'Cluster')) { Copy-Item (Join-Path $extract 'Cluster\*') -Destination $clusterDir -Recurse -Force }
}
Remove-Item $extract -Recurse -Force
Write-Output 'restore complete'
