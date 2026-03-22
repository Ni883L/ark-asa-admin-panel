param(
  [string]$InstallPath = "C:\ark-asa-admin-panel",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $InstallPath)) {
  throw "Installationspfad nicht gefunden: $InstallPath"
}

Set-Location $InstallPath

if (-not (Test-Path ".git")) {
  throw "Kein Git-Repository gefunden in $InstallPath"
}

git fetch origin

git checkout $Branch
git pull origin $Branch
npm install

Write-Output "Update abgeschlossen für $InstallPath"
