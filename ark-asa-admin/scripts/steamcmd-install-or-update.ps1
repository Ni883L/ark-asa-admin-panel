$ErrorActionPreference = 'Stop'
$steamcmd = $env:ASA_STEAMCMD_PATH
$appId = $env:ASA_APP_ID
$installDir = $env:ASA_SERVER_ROOT
if (-not (Test-Path $steamcmd)) { throw "SteamCMD nicht gefunden: $steamcmd" }
if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Force -Path $installDir | Out-Null }
& $steamcmd +force_install_dir $installDir +login anonymous +app_update $appId validate +quit
Write-Output 'steamcmd update complete'
