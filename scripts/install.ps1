param(
  [string]$RepoUrl = 'https://github.com/Ni883L/ark-asa-admin-panel.git',
  [string]$InstallPath = 'C:\ark-asa-admin',
  [string]$Branch = 'main',
  [switch]$CreateStartupTask
)

$ErrorActionPreference = 'Stop'

function Test-CommandAvailable([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-DependencyWithWinget([string]$WingetId, [string]$Label) {
  Write-Host "Installiere $Label ueber winget..."
  & winget install --id $WingetId -e --accept-package-agreements --accept-source-agreements
}

function Refresh-ProcessPath() {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $combined = @($machine, $user) -join ';'
  if ($combined) {
    $env:Path = $combined
  }
}

function Ensure-Dependencies() {
  $dependencies = @(
    @{ Name = 'git'; Label = 'Git'; WingetId = 'Git.Git' },
    @{ Name = 'node'; Label = 'Node.js'; WingetId = 'OpenJS.NodeJS.LTS' },
    @{ Name = 'npm'; Label = 'npm'; WingetId = 'OpenJS.NodeJS.LTS' }
  )

  $missing = @($dependencies | Where-Object { -not (Test-CommandAvailable $_.Name) })
  if (-not $missing.Count) {
    return
  }

  Write-Warning ("Fehlende Abhaengigkeiten: " + (($missing | ForEach-Object { $_.Label }) -join ', '))
  if (-not (Test-CommandAvailable 'winget')) {
    throw "winget ist nicht verfuegbar. Bitte installiere die fehlenden Abhaengigkeiten manuell und starte das Setup erneut."
  }

  $answer = Read-Host "Fehlende Abhaengigkeiten jetzt automatisch installieren? [J/n]"
  if ($answer -and $answer.ToLowerInvariant() -notin @('j', 'ja', 'y', 'yes')) {
    throw "Setup abgebrochen. Bitte installiere zuerst: $(($missing | ForEach-Object { $_.Label }) -join ', ')"
  }

  $toInstall = @($missing | Group-Object WingetId | ForEach-Object { $_.Group[0] })
  foreach ($dep in $toInstall) {
    Install-DependencyWithWinget $dep.WingetId $dep.Label
  }

  Refresh-ProcessPath
  $stillMissing = @($dependencies | Where-Object { -not (Test-CommandAvailable $_.Name) })
  if ($stillMissing.Count) {
    throw "Installation unvollstaendig. Weiterhin fehlend: $(($stillMissing | ForEach-Object { $_.Label }) -join ', '). Bitte neues Terminal oeffnen und Setup erneut starten."
  }
}

function New-RandomSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer)
}

Ensure-Dependencies

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
