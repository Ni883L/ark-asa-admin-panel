param(
  [string]$SteamCmdPath = $env:ASA_STEAMCMD_PATH,
  [string]$InstallDir = $env:ASA_SERVER_ROOT,
  [string]$AppId = $env:ASA_APP_ID,
  [switch]$OnlyEnsureSteamCmd
)

$ErrorActionPreference = 'Stop'

if (-not $SteamCmdPath) {
  $SteamCmdPath = 'C:\steamcmd\steamcmd.exe'
}
if (-not $AppId) {
  $AppId = '2430930'
}
if (-not $InstallDir) {
  $InstallDir = 'C:\ARK\ASA'
}

function Ensure-SteamCmd([string]$ResolvedSteamCmdPath) {
  if (Test-Path $ResolvedSteamCmdPath) {
    return
  }

  $targetDir = Split-Path -Parent $ResolvedSteamCmdPath
  if (-not $targetDir) {
    throw "Ungueltiger SteamCMD-Pfad: $ResolvedSteamCmdPath"
  }

  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  $zipPath = Join-Path $env:TEMP "steamcmd-$([System.Guid]::NewGuid().ToString('N')).zip"
  $downloadUrl = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip'

  try {
    Write-Output "SteamCMD nicht gefunden. Lade SteamCMD herunter: $downloadUrl"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $targetDir -Force
  }
  finally {
    if (Test-Path $zipPath) {
      Remove-Item -Path $zipPath -Force
    }
  }

  if (-not (Test-Path $ResolvedSteamCmdPath)) {
    throw "SteamCMD konnte nicht installiert werden: $ResolvedSteamCmdPath"
  }
}

Ensure-SteamCmd -ResolvedSteamCmdPath $SteamCmdPath

if ($OnlyEnsureSteamCmd) {
  Write-Output "steamcmd ready: $SteamCmdPath"
  exit 0
}

if (-not (Test-Path $InstallDir)) {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

& $SteamCmdPath +force_install_dir $InstallDir +login anonymous +app_update $AppId validate +quit
Write-Output 'steamcmd update complete'
