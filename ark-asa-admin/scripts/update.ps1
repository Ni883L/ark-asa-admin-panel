param([string]$InstallPath = (Split-Path -Parent $PSScriptRoot), [string]$Branch = 'master')
$ErrorActionPreference = 'Stop'
Set-Location $InstallPath
$backupRoot = Join-Path $InstallPath 'runtime\backups\panel'
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupRoot "panel-$stamp.zip"
Compress-Archive -Path (Join-Path $InstallPath '*') -DestinationPath $backup -Force
$previousCommit = (git rev-parse HEAD).Trim()
git fetch origin
git checkout $Branch
git pull origin $Branch
npm install
Write-Output "update complete from $previousCommit"
