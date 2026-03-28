param(
  [string]$RepoUrl = 'https://github.com/Ni883L/ark-asa-admin-panel.git',
  [string]$InstallPath = 'C:\ark-asa-admin',
  [string]$Branch = 'main',
  [switch]$CreateStartupTask,
  [switch]$SkipDependencyAutoRelaunch
)

$ErrorActionPreference = 'Stop'
$script:IsGerman = ([System.Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'de')
$script:GitCommand = $null
$script:NodeCommand = $null
$script:NpmCommand = $null
$script:IsInstallPathUserProvided = $PSBoundParameters.ContainsKey('InstallPath')
$script:InstallerScriptUrl = 'https://raw.githubusercontent.com/Ni883L/ark-asa-admin-panel/main/scripts/install.ps1'
$script:InstallerVersion = '2026-03-28.1'

function T([string]$German, [string]$English) {
  if ($script:IsGerman) { return $German }
  return $English
}

Write-Host (T "Installer-Version: $($script:InstallerVersion)" "Installer version: $($script:InstallerVersion)")
Assert-NoReservedVariableConflicts

function Assert-NoReservedVariableConflicts() {
  $scriptSource = $null
  if ($PSCommandPath -and (Test-Path $PSCommandPath)) {
    $scriptSource = Get-Content -Path $PSCommandPath -Raw
  } elseif ($MyInvocation.MyCommand.ScriptBlock) {
    $scriptSource = $MyInvocation.MyCommand.ScriptBlock.ToString()
  }

  if (-not $scriptSource) {
    return
  }

  $tokens = $null
  $parseErrors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseInput($scriptSource, [ref]$tokens, [ref]$parseErrors)
  $conflicts = $ast.FindAll({
      param($node)
      if ($node -is [System.Management.Automation.Language.ParameterAst]) {
        return ($node.Name.VariablePath.UserPath -ieq 'Host')
      }

      if ($node -is [System.Management.Automation.Language.AssignmentStatementAst]) {
        $left = $node.Left
        return ($left -is [System.Management.Automation.Language.VariableExpressionAst] -and $left.VariablePath.UserPath -ieq 'Host')
      }

      return $false
    }, $true)

  if ($conflicts.Count -gt 0) {
    throw (T "Installer-Guard: reservierter Variablenname 'Host' im Script gefunden. Bitte neueste Installer-Version verwenden." "Installer guard: reserved variable name 'Host' detected in script. Please use the latest installer version.")
  }
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

function Wait-ForDependencies([array]$Dependencies, [int]$Attempts = 20, [int]$DelaySeconds = 2) {
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    Refresh-ProcessPath
    $remaining = @($Dependencies | Where-Object { -not (Resolve-CommandPath $_.Name) })
    if (-not $remaining.Count) {
      return @()
    }

    Start-Sleep -Seconds $DelaySeconds
  }

  return @($Dependencies | Where-Object { -not (Resolve-CommandPath $_.Name) })
}

function Start-InstallerInNewTerminal() {
  $argumentParts = @(
    "& ([ScriptBlock]::Create((iwr '$($script:InstallerScriptUrl)' -UseBasicParsing).Content))",
    "-RepoUrl '$RepoUrl'",
    "-InstallPath '$InstallPath'",
    "-Branch '$Branch'",
    "-SkipDependencyAutoRelaunch"
  )

  if ($CreateStartupTask) {
    $argumentParts += '-CreateStartupTask'
  }

  $command = $argumentParts -join ' '
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $command) | Out-Null
}

function Ensure-Dependencies() {
  $dependencies = @(
    @{ Name = 'node'; Label = 'Node.js'; WingetId = 'OpenJS.NodeJS.LTS' },
    @{ Name = 'npm'; Label = 'npm'; WingetId = 'OpenJS.NodeJS.LTS' }
  )

  $missing = @($dependencies | Where-Object { -not (Resolve-CommandPath $_.Name) })
  if (-not $missing.Count) {
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

  $stillMissing = Wait-ForDependencies -Dependencies $dependencies
  if ($stillMissing.Count) {
    Write-Warning (T "Abhaengigkeiten noch nicht vollstaendig erkannt. Zweiter Installationsversuch startet..." "Dependencies are still not fully detected. Starting a second installation pass...")
    $retryInstall = @($stillMissing | Group-Object WingetId | ForEach-Object { $_.Group[0] })
    foreach ($dep in $retryInstall) {
      Install-DependencyWithWinget $dep.WingetId $dep.Label
    }

    $stillMissing = Wait-ForDependencies -Dependencies $dependencies -Attempts 30 -DelaySeconds 2
  }

  if ($stillMissing.Count) {
    if (-not $SkipDependencyAutoRelaunch) {
      Write-Warning (T "Abhaengigkeiten wurden installiert, aber noch nicht in der aktuellen Shell erkannt. Installer wird in neuem Terminal fortgesetzt..." "Dependencies were installed but are not fully visible in the current shell yet. Continuing installer in a new terminal...")
      Start-InstallerInNewTerminal
      throw (T "Installer in neuem Terminal gestartet. Dieses Fenster kann geschlossen werden." "Installer started in a new terminal. You can close this window.")
    }

    throw (T "Installation unvollstaendig. Weiterhin fehlend: $(($stillMissing | ForEach-Object { $_.Label }) -join ', ')." "Installation incomplete. Still missing: $(($stillMissing | ForEach-Object { $_.Label }) -join ', ').")
  }

  $script:NodeCommand = Resolve-CommandPath 'node'
  $script:NpmCommand = Resolve-CommandPath 'npm'
}



function Install-ProjectFromArchive([string]$RepoUrl, [string]$Branch, [string]$InstallPath) {
  $repoBaseUrl = $RepoUrl -replace '\.git$', ''
  $archiveUrl = "$repoBaseUrl/archive/refs/heads/$Branch.zip"
  $tempZip = Join-Path $env:TEMP "ark-panel-$Branch-$([System.Guid]::NewGuid().ToString('N')).zip"
  $extractRoot = Join-Path $env:TEMP "ark-panel-extract-$([System.Guid]::NewGuid().ToString('N'))"

  try {
    Invoke-WebRequest -Uri $archiveUrl -OutFile $tempZip -UseBasicParsing
    Expand-Archive -Path $tempZip -DestinationPath $extractRoot -Force
    $sourceDir = Get-ChildItem -Path $extractRoot -Directory | Select-Object -First 1
    if (-not $sourceDir) {
      throw (T "Archiv konnte nicht entpackt werden." "Archive could not be extracted.")
    }

    Copy-Item -Path (Join-Path $sourceDir.FullName '*') -Destination $InstallPath -Recurse -Force
  }
  finally {
    if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
    if (Test-Path $extractRoot) { Remove-Item $extractRoot -Recurse -Force }
  }
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
  return @{ Host = $panelHost; Port = $port; HttpsEnabled = $httpsEnabled; Url = $url }
}

function Test-TcpPortOpen([string]$PanelHost, [int]$Port, [int]$TimeoutMs = 4000) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($PanelHost, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
      return $false
    }

    $client.EndConnect($async)
    return $true
  }
  catch {
    return $false
  }
  finally {
    $client.Close()
  }
}

function Start-PanelNow([string]$InstallPath, [string]$NodeCommand, [string]$PanelHost, [int]$Port) {
  $process = Start-Process -FilePath $NodeCommand -ArgumentList 'src/server.js' -WorkingDirectory $InstallPath -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 3

  $portOpen = Test-TcpPortOpen -PanelHost $PanelHost -Port $Port
  return @{ Process = $process; PortOpen = $portOpen }
}

function New-RandomSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer)
}

Ensure-Dependencies
$script:GitCommand = Resolve-CommandPath 'git'
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

if ($script:GitCommand) {
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
} else {
  if ($installPathExists -and (Get-ChildItem -Force -Path $InstallPath | Measure-Object).Count -gt 0) {
    throw (T "Ohne Git muss der Installationsordner leer sein: $InstallPath" "Without Git the install directory must be empty: $InstallPath")
  }

  Install-ProjectFromArchive -RepoUrl $RepoUrl -Branch $Branch -InstallPath $InstallPath
  Set-Location $InstallPath
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


$envSettings = Get-EnvSettings (Join-Path $InstallPath '.env')
$panelConnection = Resolve-PanelConnection $envSettings
$defaultUrl = $panelConnection.Url
$startAnswer = Read-Host (T "Panel jetzt direkt starten? [J/n]" "Start panel now? [Y/n]")
if (-not $startAnswer -or $startAnswer.ToLowerInvariant() -in @('j', 'ja', 'y', 'yes')) {
  $startResult = Start-PanelNow -InstallPath $InstallPath -NodeCommand $script:NodeCommand -PanelHost $panelConnection.Host -Port $panelConnection.Port
  if ($startResult.PortOpen) {
    Write-Output (T "Panel wurde gestartet (PID: $($startResult.Process.Id)). Port $($panelConnection.Port) ist erreichbar." "Panel started (PID: $($startResult.Process.Id)). Port $($panelConnection.Port) is reachable.")
  } else {
    Write-Warning (T "Panel-Prozess gestartet, aber Port $($panelConnection.Port) ist nicht erreichbar. Bitte pruefe mit 'cd '$InstallPath'; npm start'." "Panel process started, but port $($panelConnection.Port) is not reachable yet. Please verify with 'cd '$InstallPath'; npm start'.")
  }
}

Write-Output (T "Installation abgeschlossen: $InstallPath" "Installation completed: $InstallPath")
Write-Output (T "Installationsort: $InstallPath" "Install location: $InstallPath")
Write-Output (T "Starten: cd '$InstallPath' und npm start" "Start: cd '$InstallPath' and npm start")
Write-Output (T "Konfiguration im Browser: $defaultUrl (beim ersten Start /setup)." "Open configuration website in browser: $defaultUrl (first start uses /setup).")
Write-Output (T "Wenn HTTP/HTTPS nicht passt: HTTPS_ENABLED, HOST und PORT in .env pruefen." "If HTTP/HTTPS does not match: check HTTPS_ENABLED, HOST and PORT in .env.")
Write-Output (T "Bei Remote-Zugriff HOST in .env auf 0.0.0.0 setzen und Port freigeben." "For remote access set HOST in .env to 0.0.0.0 and open the port in firewall.")
