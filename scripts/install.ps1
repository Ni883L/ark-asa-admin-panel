param(
  [string]$RepoUrl = 'https://github.com/Ni883L/ark-asa-admin-panel.git',
  [string]$InstallPath = 'C:\ark-asa-admin-panel',
  [string]$Branch = 'master',
  [switch]$CreateStartupTask
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git ist nicht installiert.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js ist nicht installiert.' }
if (-not (Test-Path $InstallPath)) { New-Item -ItemType Directory -Path $InstallPath | Out-Null }
if (-not (Test-Path (Join-Path $InstallPath '.git'))) {
  git clone --branch $Branch $RepoUrl $InstallPath
}
Set-Location $InstallPath
npm install
if (-not (Test-Path '.env') -and (Test-Path '.env.example')) { Copy-Item '.env.example' '.env' }
$dirs = @('runtime', 'runtime\data', 'runtime\logs', 'runtime\backups', 'runtime\temp')
foreach ($dir in $dirs) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
if ($CreateStartupTask) {
  $action = New-ScheduledTaskAction -Execute 'node' -Argument 'src/server.js' -WorkingDirectory $InstallPath
  $trigger = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask -TaskName 'ArkAsaAdminPanel' -Action $action -Trigger $trigger -RunLevel Highest -Force | Out-Null
}
Write-Output "Installation abgeschlossen: $InstallPath"
