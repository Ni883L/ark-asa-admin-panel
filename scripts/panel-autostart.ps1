param(
  [ValidateSet('Status', 'Enable', 'Disable', 'ElevateEnable')]
  [string]$Mode = 'Status',
  [string]$TaskName = 'ArkAsaAdminPanel',
  [string]$InstallPath = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'

Write-Output (@{
  ok = $false
  migrated = $true
  error = 'Legacy-Taskpfad deaktiviert. Verwende stattdessen panel-service-launcher.ps1 bzw. panel-service.ps1.'
  recommendedScript = 'panel-service-launcher.ps1'
  installPath = $InstallPath
} | ConvertTo-Json -Compress)
exit 1
