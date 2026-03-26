param([string]$ZipPath)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ZipPath)) {
  throw "Backup nicht gefunden: $ZipPath"
}

$tempDir = $env:TEMP_DIR
$extract = Join-Path $tempDir ("validate-" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $extract | Out-Null

try {
  Expand-Archive -Path $ZipPath -DestinationPath $extract -Force

  $hasSavedArks = Test-Path (Join-Path $extract 'SavedArks')
  $hasConfig = Test-Path (Join-Path $extract 'Config')
  $hasCluster = Test-Path (Join-Path $extract 'Cluster')
  $hasLog = Test-Path (Join-Path $extract 'ShooterGame.log')

  $result = @{
    valid = ($hasSavedArks -or $hasConfig -or $hasCluster -or $hasLog)
    hasSavedArks = $hasSavedArks
    hasConfig = $hasConfig
    hasCluster = $hasCluster
    hasLog = $hasLog
  }

  ($result | ConvertTo-Json -Compress)
} finally {
  if (Test-Path $extract) {
    Remove-Item $extract -Recurse -Force
  }
}
