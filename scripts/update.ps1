param([string]$InstallPath = (Split-Path -Parent $PSScriptRoot), [string]$Branch = 'main')
$ErrorActionPreference = 'Stop'

function Ensure-FreeDiskSpace([string]$TargetPath, [int]$MinFreeGb) {
  $resolvedPath = [System.IO.Path]::GetFullPath($TargetPath)
  $root = [System.IO.Path]::GetPathRoot($resolvedPath)
  if (-not $root) {
    throw "Unable to determine drive for install path: $TargetPath"
  }

  $driveName = $root.TrimEnd('\\').TrimEnd(':')
  $drive = Get-PSDrive -Name $driveName -PSProvider FileSystem -ErrorAction SilentlyContinue
  if (-not $drive) {
    throw "Unable to check free disk space on drive $root."
  }

  $freeGb = [Math]::Floor($drive.Free / 1GB)
  if ($freeGb -lt $MinFreeGb) {
    throw "Not enough free disk space on $root. Available: $freeGb GB, required: at least $MinFreeGb GB."
  }

  Write-Output "Free disk space check passed: $freeGb GB on $root (minimum: $MinFreeGb GB)."
}

function New-MinimalPanelBackup([string]$InstallPath, [string]$BackupRoot, [string]$BackupFile) {
  $itemsToBackup = @(
    '.env',
    '.env.example',
    'package.json',
    'package-lock.json',
    'public',
    'src',
    'scripts',
    'runtime\data'
  )

  $stagingDir = Join-Path $BackupRoot "staging-$([System.Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

  try {
    foreach ($relativePath in $itemsToBackup) {
      $sourcePath = Join-Path $InstallPath $relativePath
      if (-not (Test-Path $sourcePath)) {
        continue
      }

      $destinationPath = Join-Path $stagingDir $relativePath
      $destinationParent = Split-Path -Parent $destinationPath
      if ($destinationParent) {
        New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
      }

      if ((Get-Item $sourcePath) -is [System.IO.DirectoryInfo]) {
        Copy-Item -Path $sourcePath -Destination $destinationPath -Recurse -Force
      } else {
        Copy-Item -Path $sourcePath -Destination $destinationPath -Force
      }
    }

    Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $BackupFile -Force
  }
  finally {
    if (Test-Path $stagingDir) {
      Remove-Item -Path $stagingDir -Recurse -Force
    }
  }
}


function Get-EnvSettings([string]$EnvFilePath) {
  $settings = @{}
  if (-not (Test-Path $EnvFilePath)) {
    return $settings
  }

  foreach ($line in Get-Content $EnvFilePath) {
    if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) {
      continue
    }

    $parts = $line -split '=', 2
    $settings[$parts[0].Trim()] = $parts[1].Trim()
  }

  return $settings
}

function Resolve-PanelConnection([hashtable]$EnvSettings) {
  $port = 3000
  if ($EnvSettings.ContainsKey('PORT')) {
    $parsedPort = 0
    if ([int]::TryParse($EnvSettings['PORT'], [ref]$parsedPort) -and $parsedPort -gt 0) {
      $port = $parsedPort
    }
  }

  $panelHost = '127.0.0.1'
  if ($EnvSettings.ContainsKey('HOST') -and $EnvSettings['HOST']) {
    $configuredHost = $EnvSettings['HOST']
    if ($configuredHost -notin @('0.0.0.0', '::')) {
      $panelHost = $configuredHost
    }
  }

  $httpsEnabled = $false
  if ($EnvSettings.ContainsKey('HTTPS_ENABLED')) {
    $httpsEnabled = $EnvSettings['HTTPS_ENABLED'] -in @('1', 'true', 'True')
  }

  $scheme = if ($httpsEnabled) { 'https' } else { 'http' }
  $url = "${scheme}://${panelHost}:$port"
  return @{ Url = $url }
}

Ensure-FreeDiskSpace -TargetPath $InstallPath -MinFreeGb 1

Set-Location $InstallPath
$backupRoot = Join-Path $InstallPath 'runtime\backups\panel'
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupRoot "panel-minimal-$stamp.zip"
New-MinimalPanelBackup -InstallPath $InstallPath -BackupRoot $backupRoot -BackupFile $backup
$previousCommit = (git rev-parse HEAD).Trim()
git fetch origin
git checkout $Branch
git pull origin $Branch
npm install --omit=dev --no-audit --no-fund
Write-Output "update complete from $previousCommit"
Write-Output "minimal backup created: $backup"
$panelConnection = Resolve-PanelConnection (Get-EnvSettings (Join-Path $InstallPath '.env'))
Write-Output "Install location: $InstallPath"
Write-Output "Start panel with: cd '$InstallPath' ; npm start"
Write-Output "Configuration website: $($panelConnection.Url)"
