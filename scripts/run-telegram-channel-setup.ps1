# Upload channel icon + publish/pin launch post to @toplivo99
# Requires VPN if api.telegram.org is blocked on your network.
Set-Location $PSScriptRoot\..

if (-not (Test-Path "marketing\assets\bot-profile-512.png")) {
  py scripts\create-channel-icon.py
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

node scripts\setup-telegram-channel.mjs
exit $LASTEXITCODE
