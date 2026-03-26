param(
  [string]$RepoUrl = 'https://github.com/Ni883L/ark-asa-admin-panel.git',
  [string]$InstallPath = 'C:\ark-asa-admin',
  [string]$Branch = 'main',
  [switch]$CreateStartupTask
)

$ErrorActionPreference = 'Stop'

function Require-Command([string]$Name, [string]$Label = $Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Label ist nicht installiert."
  }
}

function New-RandomSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer)
}

Require-Command git 'Git'
Require-Command node 'Node.js'
Require-Command npm 'npm'

$installPathExists = Test-Path $InstallPath
$gitDir = Join-Path $InstallPath '.git'

if ($installPathExists -and -not (Test-Path $gitDir)) {
  $entries = Get-ChildItem -Force -Path $InstallPath -ErrorAction SilentlyContinue
  if ($entries -and $entries.Count -gt 0) {
    throw "Installationspfad existiert bereits und ist kein Git-Repo: $InstallPath"
  }
}

if (-not $installPathExists) {
  New-Item -ItemType Directory -Path $InstallPath | Out-Null
}

if (-not (Test-Path $gitDir)) {
  git clone --branch $Branch $RepoUrl $InstallPath
}

Set-Location $InstallPath

git fetch origin
if (git show-ref --verify --quiet "refs/remotes/origin/$Branch") {
  git checkout $Branch
  git reset --hard "origin/$Branch"
} else {
  throw "Remote-Branch '$Branch' wurde nicht gefunden."
}

npm install

if (-not (Test-Path '.env') -and (Test-Path '.env.example')) {
  Copy-Item '.env.example' '.env'
}

if (Test-Path '.env') {
  $envContent = Get-Content '.env' -Raw
  if ($envContent -match 'SESSION_SECRET=change-this-session-secret') {
    $secret = New-RandomSecret
    $envContent = $envContent -replace 'SESSION_SECRET=change-this-session-secret', ("SESSION_SECRET=$secret")
    Set-Content '.env' $envContent
  }
}

$dirs = @('runtime', 'runtime\data', 'runtime\logs', 'runtime\backups', 'runtime\temp')
foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

if ($CreateStartupTask) {
  $action = New-ScheduledTaskAction -Execute 'node' -Argument 'src/server.js' -WorkingDirectory $InstallPath
  $trigger = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask -TaskName 'ArkAsaAdminPanel' -Action $action -Trigger $trigger -RunLevel Highest -Force | Out-Null
}

Write-Output "Installation abgeschlossen: $InstallPath"
