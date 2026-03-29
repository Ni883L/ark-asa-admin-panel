param(
  [ValidateSet('Check', 'Open')]
  [string]$Mode = 'Check',
  [int]$Port = 3000
)
$ErrorActionPreference = 'Stop'

if ($Port -lt 1 -or $Port -gt 65535) {
  throw "Ungültiger Port: $Port"
}

$ruleName = "ArkAsaAdminPanel-$Port"
$existingByName = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
  Where-Object { $_.Direction -eq 'Inbound' -and $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' }
$existingByPort = Get-NetFirewallPortFilter | Where-Object { $_.Protocol -eq 'TCP' -and $_.LocalPort -eq "$Port" }
$isOpen = [bool]($existingByName -or $existingByPort)

if ($Mode -eq 'Check') {
  Write-Output (@{
      ok = $true
      port = $Port
      isOpen = $isOpen
      ruleName = $ruleName
    } | ConvertTo-Json -Compress)
  exit 0
}

if (-not $isOpen) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
  $isOpen = $true
}

Write-Output (@{
    ok = $true
    port = $Port
    isOpen = $isOpen
    ruleName = $ruleName
    changed = $true
  } | ConvertTo-Json -Compress)
