param(
  [string]$SteamCmdPath = $env:ASA_STEAMCMD_PATH,
  [string]$InstallDir = $env:ASA_SERVER_ROOT,
  [string]$AppId = $env:ASA_APP_ID
)

$ErrorActionPreference = 'Stop'

if (-not $SteamCmdPath) { $SteamCmdPath = 'C:\steamcmd\steamcmd.exe' }
if (-not $InstallDir) { $InstallDir = 'C:\ARK\ASA' }
if (-not $AppId) { $AppId = '2430930' }

if (-not (Test-Path $SteamCmdPath)) {
  Write-Output (@{ ok = $false; error = "SteamCMD nicht gefunden: $SteamCmdPath" } | ConvertTo-Json -Compress)
  exit 0
}

$manifestPath = Join-Path $InstallDir "steamapps\appmanifest_$AppId.acf"
$installedBuild = $null
if (Test-Path $manifestPath) {
  $manifestContent = Get-Content $manifestPath -Raw
  $manifestMatch = [regex]::Match($manifestContent, '"buildid"\s+"(?<build>\d+)"')
  if ($manifestMatch.Success) {
    $installedBuild = $manifestMatch.Groups['build'].Value
  }
}

$cmdOutput = & $SteamCmdPath +login anonymous +app_info_update 1 +app_info_print $AppId +quit 2>&1 | Out-String
$latestMatch = [regex]::Matches($cmdOutput, '"buildid"\s+"(?<build>\d+)"')
$latestBuild = $null
if ($latestMatch.Count -gt 0) {
  $latestBuild = $latestMatch[$latestMatch.Count - 1].Groups['build'].Value
}

$updateAvailable = $false
if ($installedBuild -and $latestBuild) {
  $updateAvailable = ($installedBuild -ne $latestBuild)
}

$result = @{
  ok = $true
  appId = $AppId
  installDir = $InstallDir
  installedBuild = $installedBuild
  latestBuild = $latestBuild
  updateAvailable = $updateAvailable
}

Write-Output ($result | ConvertTo-Json -Compress)
