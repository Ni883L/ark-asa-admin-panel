param(
  [string]$RepoUrl = "https://github.com/REPLACE_ME/ark-asa-admin-panel.git",
  [string]$InstallPath = "C:\ark-asa-admin-panel",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git ist nicht installiert oder nicht im PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Node.js/npm ist nicht installiert oder nicht im PATH."
}

if (-not (Test-Path $InstallPath)) {
  New-Item -ItemType Directory -Path $InstallPath | Out-Null
}

if (-not (Test-Path (Join-Path $InstallPath ".git"))) {
  git clone --branch $Branch $RepoUrl $InstallPath
}

Set-Location $InstallPath
npm install

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
}

Write-Output "Installation abgeschlossen unter $InstallPath"
Write-Output "Starte das Panel mit: npm run dev"
