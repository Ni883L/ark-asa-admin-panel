param(
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot),
  [string]$Branch = 'main',
  [string]$RepoUrl = 'https://github.com/Ni883L/ark-asa-admin-panel.git'
)
$ErrorActionPreference = 'Stop'

function Resolve-CommandPath([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Path) {
    return $cmd.Path
  }

  $candidates = switch ($Name.ToLowerInvariant()) {
    'git' { @(
      "${env:ProgramFiles}\Git\cmd\git.exe",
      "${env:ProgramFiles}\Git\bin\git.exe"
    ) }
    'node' { @(
      "${env:ProgramFiles}\nodejs\node.exe",
      "${env:ProgramFiles(x86)}\nodejs\node.exe",
      "${env:LOCALAPPDATA}\Programs\nodejs\node.exe"
    ) }
    'npm' { @(
      "${env:ProgramFiles}\nodejs\npm.cmd",
      "${env:ProgramFiles(x86)}\nodejs\npm.cmd",
      "${env:LOCALAPPDATA}\Programs\nodejs\npm.cmd"
    ) }
    default { @() }
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  return $null
}

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

function Install-ProjectFromArchive([string]$RepoUrl, [string]$Branch, [string]$InstallPath) {
  $repoBaseUrl = $RepoUrl -replace '\.git$', ''
  $archiveUrl = "$repoBaseUrl/archive/refs/heads/$Branch.zip"
  $tempZip = Join-Path $env:TEMP "ark-panel-update-$Branch-$([System.Guid]::NewGuid().ToString('N')).zip"
  $extractRoot = Join-Path $env:TEMP "ark-panel-update-extract-$([System.Guid]::NewGuid().ToString('N'))"

  try {
    Invoke-WebRequest -Uri $archiveUrl -OutFile $tempZip -UseBasicParsing
    Expand-Archive -Path $tempZip -DestinationPath $extractRoot -Force
    $sourceDir = Get-ChildItem -Path $extractRoot -Directory | Select-Object -First 1
    if (-not $sourceDir) {
      throw "Archiv konnte nicht entpackt werden."
    }

    Copy-Item -Path (Join-Path $sourceDir.FullName '*') -Destination $InstallPath -Recurse -Force
  }
  finally {
    if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
    if (Test-Path $extractRoot) { Remove-Item $extractRoot -Recurse -Force }
  }
}

Ensure-FreeDiskSpace -TargetPath $InstallPath -MinFreeGb 1

Set-Location $InstallPath
$backupRoot = Join-Path $InstallPath 'runtime\backups\panel'
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupRoot "panel-minimal-$stamp.zip"
New-MinimalPanelBackup -InstallPath $InstallPath -BackupRoot $backupRoot -BackupFile $backup
$gitCommand = Resolve-CommandPath 'git'
$npmCommand = Resolve-CommandPath 'npm'
$nodePath = Resolve-CommandPath 'node'
$nodeDir = if ($nodePath) { Split-Path -Parent $nodePath } else { $null }
if ($nodeDir) {
  $env:Path = "$nodeDir;$env:Path"
  if (-not $npmCommand) {
    $npmCandidate = Join-Path $nodeDir 'npm.cmd'
    if (Test-Path $npmCandidate) { $npmCommand = $npmCandidate }
  }
}
$previousCommit = 'unknown'
if ($gitCommand -and (Test-Path (Join-Path $InstallPath '.git'))) {
  $previousCommit = (& $gitCommand rev-parse HEAD).Trim()
  & $gitCommand fetch origin
  & $gitCommand checkout $Branch
  & $gitCommand pull origin $Branch
} else {
  if (-not $gitCommand) {
    Write-Warning 'git wurde nicht gefunden. Update erfolgt ueber ZIP-Download.'
  } else {
    Write-Warning '.git-Ordner wurde nicht gefunden. Update erfolgt ueber ZIP-Download.'
  }
  Install-ProjectFromArchive -RepoUrl $RepoUrl -Branch $Branch -InstallPath $InstallPath
}
if (-not $npmCommand) {
  throw 'npm wurde nicht gefunden. Bitte Node.js installieren oder PATH aktualisieren.'
}
& $npmCommand install --omit=dev --no-audit --no-fund
Write-Output "update complete from $previousCommit"
Write-Output "minimal backup created: $backup"
$panelConnection = Resolve-PanelConnection (Get-EnvSettings (Join-Path $InstallPath '.env'))
Write-Output "Install location: $InstallPath"
Write-Output "Start panel with: cd '$InstallPath' ; npm start"
Write-Output "Configuration website: $($panelConnection.Url)"
