param(
  [string]$TaskName = 'ArkAsaAdminPanel',
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot),
  [int]$Port = 3000,
  [int]$TimeoutSeconds = 20
)
$ErrorActionPreference = 'Stop'

function Test-PortOpen([string]$HostName, [int]$PortNumber, [int]$TimeoutMs = 1500) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $PortNumber, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
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

function Resolve-NodePath {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node -and $node.Source) { return $node.Source }
  $candidates = @(
    "${env:ProgramFiles}\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "${env:LOCALAPPDATA}\Programs\nodejs\node.exe"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  throw 'Node.js (node.exe) wurde nicht gefunden.'
}

function Get-PanelProcesses([int]$PortNumber) {
  $connections = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue
  $processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($pid in $processIds) {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) { $proc }
  }
}

function Stop-PanelProcesses([int]$PortNumber) {
  $processes = Get-PanelProcesses -PortNumber $PortNumber
  foreach ($proc in $processes) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch {}
  }
}

function Start-DetachedNode([string]$WorkingDirectory) {
  $nodePath = Resolve-NodePath
  $process = Start-Process -FilePath $nodePath -ArgumentList 'src/server.js' -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru
  return $process
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null } catch {}
  Stop-PanelProcesses -PortNumber $Port
  Start-ScheduledTask -TaskName $TaskName
} else {
  Stop-PanelProcesses -PortNumber $Port
  Start-DetachedNode -WorkingDirectory $InstallPath | Out-Null
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$reachable = $false
while ((Get-Date) -lt $deadline) {
  if (Test-PortOpen -HostName '127.0.0.1' -PortNumber $Port) {
    $reachable = $true
    break
  }
  Start-Sleep -Milliseconds 750
}

if (-not $reachable) {
  throw "Panel-Port $Port wurde nach Neustart nicht erreichbar."
}

Write-Output (@{
    ok = $true
    restarted = $true
    taskUsed = [bool]$task
    port = $Port
    installPath = $InstallPath
  } | ConvertTo-Json -Compress)
