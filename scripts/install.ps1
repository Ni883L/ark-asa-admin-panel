param(
  [string]$RepoUrl = 'https://github.com/Ni883L/ark-asa-admin-panel.git',
  [string]$InstallPath = 'C:\ark-asa-admin',
  [string]$Branch = 'main',
  [switch]$CreateStartupTask
)

$ErrorActionPreference = 'Stop'
$script:IsGerman = ([System.Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'de')
$script:GitCommand = $null
$script:NodeCommand = $null
$script:NpmCommand = $null
$script:IsInstallPathUserProvided = $PSBoundParameters.ContainsKey('InstallPath')

function T([string]$German, [string]$English) {
  if ($script:IsGerman) { return $German }
  return $English
}

function Test-CommandAvailable([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

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
      "${env:ProgramFiles}\nodejs\node.exe"
    ) }
    'npm' { @(
      "${env:ProgramFiles}\nodejs\npm.cmd"
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

function Install-DependencyWithWinget([string]$WingetId, [string]$Label) {
  Write-Host (T "Installiere $Label ueber winget..." "Installing $Label via winget...")
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

  $missing = @($dependencies | Where-Object { -not (Resolve-CommandPath $_.Name) })
  if (-not $missing.Count) {
    $script:GitCommand = Resolve-CommandPath 'git'
    $script:NodeCommand = Resolve-CommandPath 'node'
    $script:NpmCommand = Resolve-CommandPath 'npm'
    return
  }

  Write-Warning (T "Fehlende Abhaengigkeiten: $(($missing | ForEach-Object { $_.Label }) -join ', ')" "Missing dependencies: $(($missing | ForEach-Object { $_.Label }) -join ', ')")
  if (-not (Test-CommandAvailable 'winget')) {
    throw (T "winget ist nicht verfuegbar. Bitte installiere die fehlenden Abhaengigkeiten manuell und starte das Setup erneut." "winget is not available. Please install missing dependencies manually and rerun setup.")
  }

  $answer = Read-Host (T "Fehlende Abhaengigkeiten jetzt automatisch installieren? [J/n]" "Install missing dependencies automatically now? [Y/n]")
  if ($answer -and $answer.ToLowerInvariant() -notin @('j', 'ja', 'y', 'yes')) {
    throw (T "Setup abgebrochen. Bitte installiere zuerst: $(($missing | ForEach-Object { $_.Label }) -join ', ')" "Setup aborted. Please install first: $(($missing | ForEach-Object { $_.Label }) -join ', ')")
  }

  $toInstall = @($missing | Group-Object WingetId | ForEach-Object { $_.Group[0] })
  foreach ($dep in $toInstall) {
    Install-DependencyWithWinget $dep.WingetId $dep.Label
  }

  Refresh-ProcessPath
  $stillMissing = @($dependencies | Where-Object { -not (Resolve-CommandPath $_.Name) })
  if ($stillMissing.Count) {
    throw (T "Installation unvollstaendig. Weiterhin fehlend: $(($stillMissing | ForEach-Object { $_.Label }) -join ', '). Bitte neues Terminal oeffnen und Setup erneut starten." "Installation incomplete. Still missing: $(($stillMissing | ForEach-Object { $_.Label }) -join ', '). Please open a new terminal and rerun setup.")
  }

  $script:GitCommand = Resolve-CommandPath 'git'
  $script:NodeCommand = Resolve-CommandPath 'node'
  $script:NpmCommand = Resolve-CommandPath 'npm'
}



function Resolve-InstallPath([string]$CurrentInstallPath) {
  if ($script:IsInstallPathUserProvided) {
    return [System.IO.Path]::GetFullPath($CurrentInstallPath)
  }

  $useDifferentPathAnswer = Read-Host (T "Standard-Installationspfad ist '$CurrentInstallPath'. Anderen Pfad waehlen? [j/N]" "Default install path is '$CurrentInstallPath'. Choose a different path? [y/N]")
  if ($useDifferentPathAnswer -and $useDifferentPathAnswer.ToLowerInvariant() -in @('j', 'ja', 'y', 'yes')) {
    $customPath = Read-Host (T "Bitte Installationspfad eingeben" "Please enter the install path")
    if (-not $customPath) {
      throw (T "Kein Installationspfad angegeben." "No install path provided.")
    }

    return [System.IO.Path]::GetFullPath($customPath)
  }

  return [System.IO.Path]::GetFullPath($CurrentInstallPath)
}

function Test-RemoteBranchExists([string]$BranchName) {
  & $script:GitCommand ls-remote --exit-code --heads origin $BranchName *> $null
  return ($LASTEXITCODE -eq 0)
}

function Ensure-FreeDiskSpace([string]$TargetPath, [int]$MinFreeGb) {
  $resolvedPath = [System.IO.Path]::GetFullPath($TargetPath)
  $root = [System.IO.Path]::GetPathRoot($resolvedPath)
  if (-not $root) {
    throw (T "Konnte Laufwerk fuer Installationspfad nicht ermitteln: $TargetPath" "Unable to determine drive for install path: $TargetPath")
  }

  $driveName = $root.TrimEnd('\\').TrimEnd(':')
  $drive = Get-PSDrive -Name $driveName -PSProvider FileSystem -ErrorAction SilentlyContinue
  if (-not $drive) {
    throw (T "Konnte freigegebenen Speicher auf Laufwerk $root nicht pruefen." "Unable to check free disk space on drive $root.")
  }

  $freeGb = [Math]::Floor($drive.Free / 1GB)
  if ($freeGb -lt $MinFreeGb) {
    throw (T "Zu wenig freier Speicher auf $root. Verfuegbar: $freeGb GB, benoetigt: mindestens $MinFreeGb GB." "Not enough free disk space on $root. Available: $freeGb GB, required: at least $MinFreeGb GB.")
  }

  Write-Host (T "Freier Speicher geprueft: $freeGb GB auf $root (Minimum: $MinFreeGb GB)." "Free disk space check passed: $freeGb GB on $root (minimum: $MinFreeGb GB).")
}

function New-RandomSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer)
}

Ensure-Dependencies
$InstallPath = Resolve-InstallPath $InstallPath
Ensure-FreeDiskSpace -TargetPath $InstallPath -MinFreeGb 2

$installPathExists = Test-Path $InstallPath
$gitDir = Join-Path $InstallPath '.git'

if ($installPathExists -and -not (Test-Path $gitDir)) {
  $entries = Get-ChildItem -Force -Path $InstallPath -ErrorAction SilentlyContinue
  if ($entries -and $entries.Count -gt 0) {
    throw (T "Installationspfad existiert bereits und ist kein Git-Repo: $InstallPath" "Install path already exists and is not a Git repository: $InstallPath")
  }
}

if (-not $installPathExists) {
  New-Item -ItemType Directory -Path $InstallPath | Out-Null
}

if (-not (Test-Path $gitDir)) {
  & $script:GitCommand clone --depth 1 --branch $Branch $RepoUrl $InstallPath
}

Set-Location $InstallPath

& $script:GitCommand fetch origin
if (Test-RemoteBranchExists $Branch) {
  & $script:GitCommand checkout $Branch
  & $script:GitCommand reset --hard "origin/$Branch"
} else {
  throw (T "Remote-Branch '$Branch' wurde nicht gefunden." "Remote branch '$Branch' was not found.")
}

& $script:NpmCommand install --omit=dev --no-audit --no-fund

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

$defaultUrl = 'http://127.0.0.1:3000'
Write-Output (T "Installation abgeschlossen: $InstallPath" "Installation completed: $InstallPath")
Write-Output (T "Installationsort: $InstallPath" "Install location: $InstallPath")
Write-Output (T "Starten: cd '$InstallPath' und npm start" "Start: cd '$InstallPath' and npm start")
Write-Output (T "Konfiguration im Browser: $defaultUrl (beim ersten Start /setup)." "Open configuration website in browser: $defaultUrl (first start uses /setup).")
